import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const totalArticles = await this.prisma.article.count();
    
    // Sum of all views
    const viewsResult = await this.prisma.article.aggregate({
      _sum: {
        views: true
      }
    });
    const totalViews = viewsResult._sum.views || 0;

    const totalComments = await this.prisma.comment.count();
    const totalSubscribers = await this.prisma.newsletterSubscriber.count({
      where: { isActive: true }
    });

    // Recent articles for the dashboard table
    const recentArticles = await this.prisma.article.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        category: true
      }
    });

    return {
      stats: {
        totalArticles,
        totalViews,
        totalComments,
        totalSubscribers
      },
      recentArticles
    };
  }

  async getSubscribers(search?: string) {
    const searchTerm = search?.trim();

    const subscribers = await this.prisma.newsletterSubscriber.findMany({
      where: {
        ...(searchTerm
          ? {
              email: {
                contains: searchTerm,
                mode: 'insensitive' as const,
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });

    const [total, active] = await Promise.all([
      this.prisma.newsletterSubscriber.count(),
      this.prisma.newsletterSubscriber.count({ where: { isActive: true } }),
    ]);

    return {
      stats: {
        total,
        active,
        inactive: total - active,
      },
      subscribers,
    };
  }

  async getArticles(search?: string, status?: string) {
    const searchTerm = search?.trim();

    return this.prisma.article.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
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
        _count: {
          select: { interactions: true, comments: true },
        },
      },
    });
  }
}
