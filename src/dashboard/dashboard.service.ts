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
}
