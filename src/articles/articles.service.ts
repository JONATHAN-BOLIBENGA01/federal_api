import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticlesService {
  constructor(private prisma: PrismaService) {}

  async create(createArticleDto: CreateArticleDto, authorId: string) {
    const { tags, categoryId, ...data } = createArticleDto;
    
    return this.prisma.article.create({
      data: {
        ...data,
        author: { connect: { id: authorId } },
        ...(categoryId && { category: { connect: { id: categoryId } } }),
        ...(tags && tags.length > 0 && {
          tags: {
            connect: tags.map(tagId => ({ id: tagId }))
          }
        })
      },
      include: {
        category: true,
        tags: true,
        author: { select: { id: true, name: true, avatar: true } }
      }
    });
  }

  async findAll(status?: string) {
    return this.prisma.article.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        tags: true,
        author: { select: { id: true, name: true, avatar: true } }
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
    const { tags, categoryId, ...data } = updateArticleDto;

    return this.prisma.article.update({
      where: { id },
      data: {
        ...data,
        ...(categoryId && { category: { connect: { id: categoryId } } }),
        ...(tags && {
          tags: {
            set: tags.map(tagId => ({ id: tagId }))
          }
        })
      },
      include: {
        category: true,
        tags: true
      }
    });
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
    const existingInteraction = await this.prisma.interaction.findUnique({
      where: {
        articleId_userId_type: {
          articleId,
          userId,
          type
        }
      }
    });

    if (existingInteraction) {
      // Toggle off (remove interaction)
      return this.prisma.interaction.delete({
        where: { id: existingInteraction.id }
      });
    }

    // Toggle on (add interaction)
    return this.prisma.interaction.create({
      data: {
        type,
        article: { connect: { id: articleId } },
        user: { connect: { id: userId } }
      }
    });
  }
}
