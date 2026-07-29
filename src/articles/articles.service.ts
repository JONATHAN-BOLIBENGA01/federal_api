import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { PublishArticleSocialsDto } from './dto/publish-article-socials.dto';
import { SocialPublishingService } from '../social/social-publishing.service';

const MAX_ARTICLE_WORDS = 1200;

@Injectable()
export class ArticlesService {
  constructor(
    private prisma: PrismaService,
    private socialPublishingService: SocialPublishingService,
  ) {}

  private buildSocialSelection(data: {
    shareOnFacebook?: boolean;
    shareOnInstagram?: boolean;
    shareOnX?: boolean;
  }) {
    return {
      ...(typeof data.shareOnFacebook === 'boolean'
        ? { shareOnFacebook: data.shareOnFacebook }
        : {}),
      ...(typeof data.shareOnInstagram === 'boolean'
        ? { shareOnInstagram: data.shareOnInstagram }
        : {}),
      ...(typeof data.shareOnX === 'boolean' ? { shareOnX: data.shareOnX } : {}),
    };
  }

  private baseArticleInclude() {
    return {
      category: true,
      tags: true,
      author: { select: { id: true, name: true, avatar: true } },
      socialPublications: {
        orderBy: { platform: 'asc' as const },
      },
    };
  }

  private countWords(content: string) {
    return content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  }

  private validateWordLimit(content: string) {
    const wordCount = this.countWords(content);

    if (wordCount > MAX_ARTICLE_WORDS) {
      throw new BadRequestException(
        `Article too long. Maximum allowed is ${MAX_ARTICLE_WORDS} words.`,
      );
    }
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  private buildTagConnectOrCreate(tags?: string[]) {
    const uniqueTags = [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];

    return uniqueTags.map((name) => ({
      where: { slug: this.slugify(name) },
      create: {
        name,
        slug: this.slugify(name),
      },
    }));
  }

  async create(createArticleDto: CreateArticleDto, authorId: string) {
    const { tags, categoryId, ...data } = createArticleDto;
    const tagConnections = this.buildTagConnectOrCreate(tags);
    const socialSelection = this.buildSocialSelection(data);

    this.validateWordLimit(data.content);

    const article = await this.prisma.article.create({
      data: {
        ...data,
        ...socialSelection,
        ...(data.status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
        author: { connect: { id: authorId } },
        ...(categoryId && { category: { connect: { id: categoryId } } }),
        ...(tagConnections.length > 0 && {
          tags: {
            connectOrCreate: tagConnections,
          }
        })
      },
      include: this.baseArticleInclude(),
    });

    if (article.status === 'PUBLISHED') {
      await this.socialPublishingService.publishArticle(article);
      return this.findOne(article.id);
    }

    return article;
  }

  async findAll(status?: string, search?: string, category?: string) {
    const searchTerm = search?.trim();
    const categorySlug = category?.trim();

    return this.prisma.article.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
        ...(searchTerm
          ? {
              OR: [
                { title: { contains: searchTerm, mode: 'insensitive' as const } },
                { excerpt: { contains: searchTerm, mode: 'insensitive' as const } },
                { content: { contains: searchTerm, mode: 'insensitive' as const } },
                { category: { name: { contains: searchTerm, mode: 'insensitive' as const } } },
                { tags: { some: { name: { contains: searchTerm, mode: 'insensitive' as const } } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        tags: true,
        author: { select: { id: true, name: true, avatar: true } },
        socialPublications: {
          orderBy: { platform: 'asc' as const },
        },
        _count: {
          select: { interactions: true, comments: true }
        }
      }
    });
  }

  async findOne(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        category: true,
        tags: true,
        author: { select: { id: true, name: true, avatar: true } },
        comments: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' }
        },
        socialPublications: {
          orderBy: { platform: 'asc' as const },
        },
        _count: {
          select: { interactions: true, comments: true }
        }
      }
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return article;
  }

  async findBySlug(slug: string) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: {
        category: true,
        tags: true,
        author: { select: { id: true, name: true, avatar: true } },
        socialPublications: {
          orderBy: { platform: 'asc' as const },
        },
        _count: {
          select: { interactions: true, comments: true }
        }
      }
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return article;
  }

  async update(id: string, updateArticleDto: UpdateArticleDto) {
    const existingArticle = await this.prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        content: true,
        status: true,
        publishedAt: true,
      },
    });

    if (!existingArticle) {
      throw new NotFoundException('Article not found');
    }

    const { tags, categoryId, ...data } = updateArticleDto;
    const nextStatus = data.status ?? existingArticle.status;
    const nextContent = data.content ?? existingArticle.content;
    const tagConnections = this.buildTagConnectOrCreate(tags);
    const socialSelection = this.buildSocialSelection(data);

    this.validateWordLimit(nextContent);

    const article = await this.prisma.article.update({
      where: { id },
      data: {
        ...data,
        ...socialSelection,
        ...(nextStatus === 'PUBLISHED' && !existingArticle.publishedAt
          ? { publishedAt: new Date() }
          : {}),
        ...(categoryId && { category: { connect: { id: categoryId } } }),
        ...(tags && {
          tags: {
            set: [],
            connectOrCreate: tagConnections,
          }
        })
      },
      include: this.baseArticleInclude(),
    });

    if (nextStatus === 'PUBLISHED' && !existingArticle.publishedAt) {
      await this.socialPublishingService.publishArticle(article);
      return this.findOne(article.id);
    }

    return article;
  }

  async publishToSocials(id: string, publishArticleSocialsDto: PublishArticleSocialsDto) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: this.baseArticleInclude(),
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    if (article.status !== 'PUBLISHED') {
      throw new BadRequestException(
        'Only published articles can be sent to social platforms.',
      );
    }

    await this.socialPublishingService.publishArticle(article, publishArticleSocialsDto);
    return this.findOne(id);
  }

  async remove(id: string) {
    return this.prisma.article.delete({
      where: { id },
    });
  }

  async incrementViews(id: string) {
    return this.prisma.article.update({
      where: { id },
      data: { views: { increment: 1 } },
    });
  }

  async interact(articleId: string, userId: string, type: 'LIKE' | 'LOVE' | 'SAVE') {
    if (!['LIKE', 'LOVE', 'SAVE'].includes(type)) {
      throw new BadRequestException('Invalid interaction type');
    }

    const existingInteraction = await this.prisma.interaction.findUnique({
      where: {
        articleId_userId_type: {
          articleId,
          userId,
          type
        }
      }
    });

    let action: 'added' | 'removed' = 'added';

    if (existingInteraction) {
      action = 'removed';
      await this.prisma.interaction.delete({
        where: { id: existingInteraction.id }
      });
    } else {
      await this.prisma.interaction.create({
        data: {
          type,
          article: { connect: { id: articleId } },
          user: { connect: { id: userId } }
        }
      });
    }

    const [totalInteractions, userInteractions] = await Promise.all([
      this.prisma.interaction.count({
        where: { articleId },
      }),
      this.prisma.interaction.findMany({
        where: { articleId, userId },
        select: { type: true },
      }),
    ]);

    return {
      action,
      type,
      counts: {
        interactions: totalInteractions,
      },
      activeTypes: userInteractions.map((interaction) => interaction.type),
    };
  }
}
