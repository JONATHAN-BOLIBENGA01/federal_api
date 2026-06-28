import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(createCategoryDto: { name: string; slug: string }) {
    const existing = await this.prisma.category.findUnique({
      where: { slug: createCategoryDto.slug },
    });
    if (existing) throw new ConflictException('Category slug already exists');

    return this.prisma.category.create({
      data: createCategoryDto,
    });
  }

  async findAll() {
    return this.prisma.category.findMany({
      include: {
        _count: {
          select: { articles: true }
        }
      }
    });
  }

  async findOne(id: string) {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        articles: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  async update(id: string, updateCategoryDto: { name?: string; slug?: string }) {
    return this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });
  }

  async remove(id: string) {
    return this.prisma.category.delete({
      where: { id },
    });
  }
}
