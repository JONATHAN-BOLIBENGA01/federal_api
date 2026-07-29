import { Injectable, Logger } from '@nestjs/common';
import {
  SocialPlatform,
  SocialPublicationStatus,
  type Prisma,
} from '@prisma/client';
import axios from 'axios';
import { createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

type SocialPublishRequest = {
  shareOnFacebook?: boolean;
  shareOnInstagram?: boolean;
  shareOnX?: boolean;
};

type SocialPublishableArticle = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  shareOnFacebook: boolean;
  shareOnInstagram: boolean;
  shareOnX: boolean;
  tags?: Array<{ name: string }>;
};

type SocialAttemptResult = {
  platform: SocialPlatform;
  status: SocialPublicationStatus;
  externalPostId?: string | null;
  externalUrl?: string | null;
  errorMessage?: string | null;
};

@Injectable()
export class SocialPublishingService {
  private readonly logger = new Logger(SocialPublishingService.name);
  private readonly metaApiVersion = process.env.SOCIAL_META_API_VERSION || 'v23.0';

  constructor(private readonly prisma: PrismaService) {}

  async publishArticle(
    article: SocialPublishableArticle,
    request?: SocialPublishRequest,
  ) {
    const targets = this.resolveTargets(article, request);
    const tasks: Promise<SocialAttemptResult>[] = [];

    if (targets.facebook) {
      tasks.push(this.publishToFacebook(article));
    }

    if (targets.instagram) {
      tasks.push(this.publishToInstagram(article));
    }

    if (targets.x) {
      tasks.push(this.publishToX(article));
    }

    if (tasks.length === 0) {
      return [];
    }

    return Promise.all(tasks);
  }

  private resolveTargets(article: SocialPublishableArticle, request?: SocialPublishRequest) {
    return {
      facebook: request?.shareOnFacebook ?? article.shareOnFacebook,
      instagram: request?.shareOnInstagram ?? article.shareOnInstagram,
      x: request?.shareOnX ?? article.shareOnX,
    };
  }

  private buildArticleUrl(slug: string) {
    const publicSiteUrl = this.getEnv('SOCIAL_PUBLIC_SITE_URL');

    if (!publicSiteUrl) {
      return null;
    }

    return `${publicSiteUrl.replace(/\/$/, '')}/article/${slug}`;
  }

  private resolvePublicImageUrl(featuredImage?: string | null) {
    const value = featuredImage?.trim();

    if (!value || /^data:/i.test(value)) {
      return null;
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    const assetBaseUrl =
      this.getEnv('SOCIAL_ASSET_BASE_URL') ||
      this.getEnv('PUBLIC_API_URL') ||
      this.getEnv('API_PUBLIC_URL');

    if (!assetBaseUrl) {
      return null;
    }

    const normalizedBase = assetBaseUrl.replace(/\/$/, '');
    const normalizedPath = value.startsWith('/') ? value : `/${value}`;
    return `${normalizedBase}${normalizedPath}`;
  }

  private buildHashtags(article: SocialPublishableArticle) {
    return (article.tags ?? [])
      .map((tag) => tag.name.trim())
      .filter(Boolean)
      .slice(0, 4)
      .map((tag) =>
        `#${tag
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9]+/g, '')}`,
      )
      .filter((tag) => tag.length > 1)
      .join(' ');
  }

  private buildSummary(article: SocialPublishableArticle) {
    const source = article.excerpt?.trim() || this.extractPlainText(article.content);
    return this.truncate(source, 260);
  }

  private buildFacebookMessage(article: SocialPublishableArticle) {
    const summary = this.buildSummary(article);
    const articleUrl = this.buildArticleUrl(article.slug);
    const hashtags = this.buildHashtags(article);

    return [
      article.title.trim(),
      summary,
      articleUrl ? `Lire l'article : ${articleUrl}` : null,
      hashtags || null,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private buildInstagramCaption(article: SocialPublishableArticle) {
    const summary = this.buildSummary(article);
    const articleUrl = this.buildArticleUrl(article.slug);
    const hashtags = this.buildHashtags(article);

    return [
      article.title.trim(),
      summary,
      articleUrl ? `Article complet : ${articleUrl}` : null,
      hashtags || null,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private buildXText(article: SocialPublishableArticle) {
    const summary = this.truncate(this.buildSummary(article), 140);
    const articleUrl = this.buildArticleUrl(article.slug);
    const hashtags = this.buildHashtags(article);

    const segments = [article.title.trim(), summary, hashtags || null, articleUrl];
    return this.truncate(
      segments.filter(Boolean).join('\n\n'),
      275,
    );
  }

  private extractPlainText(value: string) {
    return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private truncate(value: string, limit: number) {
    if (value.length <= limit) {
      return value;
    }

    return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
  }

  private async publishToFacebook(article: SocialPublishableArticle) {
    const pageId = this.getEnv('SOCIAL_FACEBOOK_PAGE_ID');
    const accessToken = this.getEnv('SOCIAL_FACEBOOK_PAGE_ACCESS_TOKEN');

    if (!pageId || !accessToken) {
      return this.recordResult(article.id, {
        platform: SocialPlatform.FACEBOOK,
        status: SocialPublicationStatus.FAILED,
        errorMessage:
          'Facebook is not configured. Set SOCIAL_FACEBOOK_PAGE_ID and SOCIAL_FACEBOOK_PAGE_ACCESS_TOKEN.',
      });
    }

    const articleUrl = this.buildArticleUrl(article.slug);
    const body = new URLSearchParams({
      message: this.buildFacebookMessage(article),
      access_token: accessToken,
    });

    if (articleUrl) {
      body.set('link', articleUrl);
    }

    try {
      const response = await axios.post<{ id: string }>(
        `https://graph.facebook.com/${this.metaApiVersion}/${pageId}/feed`,
        body,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const externalPostId = response.data.id;
      const externalUrl = this.buildFacebookPostUrl(pageId, externalPostId);

      return this.recordResult(article.id, {
        platform: SocialPlatform.FACEBOOK,
        status: SocialPublicationStatus.SUCCESS,
        externalPostId,
        externalUrl,
      });
    } catch (error) {
      return this.recordResult(article.id, {
        platform: SocialPlatform.FACEBOOK,
        status: SocialPublicationStatus.FAILED,
        errorMessage: this.describeHttpError(error),
      });
    }
  }

  private buildFacebookPostUrl(pageId: string, externalPostId?: string | null) {
    if (!externalPostId) {
      return null;
    }

    const [, postId] = externalPostId.split('_');

    if (!postId) {
      return `https://www.facebook.com/${pageId}`;
    }

    return `https://www.facebook.com/${pageId}/posts/${postId}`;
  }

  private async publishToInstagram(article: SocialPublishableArticle) {
    const igUserId = this.getEnv('SOCIAL_INSTAGRAM_IG_USER_ID');
    const accessToken =
      this.getEnv('SOCIAL_INSTAGRAM_PAGE_ACCESS_TOKEN') ||
      this.getEnv('SOCIAL_FACEBOOK_PAGE_ACCESS_TOKEN');
    const imageUrl = this.resolvePublicImageUrl(article.featuredImage);

    if (!igUserId || !accessToken) {
      return this.recordResult(article.id, {
        platform: SocialPlatform.INSTAGRAM,
        status: SocialPublicationStatus.FAILED,
        errorMessage:
          'Instagram is not configured. Set SOCIAL_INSTAGRAM_IG_USER_ID and SOCIAL_INSTAGRAM_PAGE_ACCESS_TOKEN.',
      });
    }

    if (!imageUrl) {
      return this.recordResult(article.id, {
        platform: SocialPlatform.INSTAGRAM,
        status: SocialPublicationStatus.FAILED,
        errorMessage:
          'Instagram requires a public featured image URL. Upload a featured image stored under /uploads or provide an https URL.',
      });
    }

    try {
      const createContainerBody = new URLSearchParams({
        image_url: imageUrl,
        caption: this.buildInstagramCaption(article),
        access_token: accessToken,
      });

      const containerResponse = await axios.post<{ id: string }>(
        `https://graph.facebook.com/${this.metaApiVersion}/${igUserId}/media`,
        createContainerBody,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const publishBody = new URLSearchParams({
        creation_id: containerResponse.data.id,
        access_token: accessToken,
      });

      const publishResponse = await axios.post<{ id: string }>(
        `https://graph.facebook.com/${this.metaApiVersion}/${igUserId}/media_publish`,
        publishBody,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return this.recordResult(article.id, {
        platform: SocialPlatform.INSTAGRAM,
        status: SocialPublicationStatus.SUCCESS,
        externalPostId: publishResponse.data.id,
      });
    } catch (error) {
      return this.recordResult(article.id, {
        platform: SocialPlatform.INSTAGRAM,
        status: SocialPublicationStatus.FAILED,
        errorMessage: this.describeHttpError(error),
      });
    }
  }

  private async publishToX(article: SocialPublishableArticle) {
    const accessToken = this.getEnv('SOCIAL_X_ACCESS_TOKEN');
    const apiKey = this.getEnv('SOCIAL_X_API_KEY');
    const apiSecret = this.getEnv('SOCIAL_X_API_SECRET');
    const accessTokenSecret = this.getEnv('SOCIAL_X_ACCESS_TOKEN_SECRET');

    if (!accessToken) {
      return this.recordResult(article.id, {
        platform: SocialPlatform.X,
        status: SocialPublicationStatus.FAILED,
        errorMessage:
          'X is not configured. Set SOCIAL_X_ACCESS_TOKEN and either OAuth 1.0a credentials or an OAuth 2.0 user token.',
      });
    }

    try {
      const authorization =
        apiKey && apiSecret && accessTokenSecret
          ? this.buildXOAuth1Authorization({
              apiKey,
              apiSecret,
              accessToken,
              accessTokenSecret,
            })
          : `Bearer ${accessToken}`;

      const response = await axios.post<{ data: { id: string; text: string } }>(
        'https://api.x.com/2/tweets',
        {
          text: this.buildXText(article),
        },
        {
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json',
          },
        },
      );

      const externalPostId = response.data.data.id;

      return this.recordResult(article.id, {
        platform: SocialPlatform.X,
        status: SocialPublicationStatus.SUCCESS,
        externalPostId,
        externalUrl: `https://x.com/i/web/status/${externalPostId}`,
      });
    } catch (error) {
      return this.recordResult(article.id, {
        platform: SocialPlatform.X,
        status: SocialPublicationStatus.FAILED,
        errorMessage: this.describeHttpError(error),
      });
    }
  }

  private buildXOAuth1Authorization(credentials: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  }) {
    const oauthParameters = {
      oauth_consumer_key: credentials.apiKey,
      oauth_nonce: randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: credentials.accessToken,
      oauth_version: '1.0',
    };
    const requestUrl = 'https://api.x.com/2/tweets';
    const normalizedParameters = Object.entries(oauthParameters)
      .map(([key, value]) => [this.oauthEncode(key), this.oauthEncode(value)] as const)
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
        const keyOrder = leftKey.localeCompare(rightKey);
        return keyOrder || leftValue.localeCompare(rightValue);
      })
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    const signatureBase = [
      'POST',
      this.oauthEncode(requestUrl),
      this.oauthEncode(normalizedParameters),
    ].join('&');
    const signingKey = `${this.oauthEncode(credentials.apiSecret)}&${this.oauthEncode(
      credentials.accessTokenSecret,
    )}`;
    const signature = createHmac('sha1', signingKey)
      .update(signatureBase)
      .digest('base64');
    const signedParameters = {
      ...oauthParameters,
      oauth_signature: signature,
    };

    return `OAuth ${Object.entries(signedParameters)
      .map(([key, value]) => `${this.oauthEncode(key)}="${this.oauthEncode(value)}"`)
      .join(', ')}`;
  }

  private oauthEncode(value: string) {
    return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }

  private async recordResult(articleId: string, result: SocialAttemptResult) {
    const now = new Date();

    const savedRecord = await this.prisma.socialPublication.upsert({
      where: {
        articleId_platform: {
          articleId,
          platform: result.platform,
        },
      },
      create: {
        articleId,
        platform: result.platform,
        status: result.status,
        externalPostId: result.externalPostId ?? null,
        externalUrl: result.externalUrl ?? null,
        errorMessage: result.errorMessage ?? null,
        attempts: 1,
        lastAttemptedAt: now,
        publishedAt:
          result.status === SocialPublicationStatus.SUCCESS ? now : null,
      },
      update: {
        status: result.status,
        externalPostId: result.externalPostId ?? null,
        externalUrl: result.externalUrl ?? null,
        errorMessage: result.errorMessage ?? null,
        lastAttemptedAt: now,
        publishedAt:
          result.status === SocialPublicationStatus.SUCCESS ? now : null,
        attempts: {
          increment: 1,
        },
      },
    });

    if (result.status === SocialPublicationStatus.FAILED) {
      this.logger.warn(
        `Social publish failed for article ${articleId} on ${result.platform}: ${result.errorMessage}`,
      );
    }

    return savedRecord;
  }

  private describeHttpError(error: unknown) {
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data as
        | { error?: { message?: string }; detail?: string; title?: string }
        | undefined;

      return (
        responseData?.error?.message ||
        responseData?.detail ||
        responseData?.title ||
        error.message
      );
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown social publishing error';
  }

  private getEnv(name: string) {
    const value = process.env[name]?.trim();
    return value ? value : null;
  }
}
