import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(createCategoryDto: { name: string; slug: string }) {
    const payload = {
      name: createCategoryDto.name.trim(),
      slug: createCategoryDto.slug.trim(),
    };

    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [{ slug: payload.slug }, { name: payload.name }],
      },
    });
    if (existing) {
      throw new ConflictException(
        existing.slug === payload.slug
          ? 'Category slug already exists'
          : 'Category name already exists',
      );
    }

    return this.prisma.category.create({
      data: payload,
    });
  }

  async findAll() {
    return this.prisma.category.findMany({
      orderBy: {
        createdAt: 'desc',
      },
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
    const payload = {
      ...(updateCategoryDto.name ? { name: updateCategoryDto.name.trim() } : {}),
      ...(updateCategoryDto.slug ? { slug: updateCategoryDto.slug.trim() } : {}),
    };

    if (payload.name || payload.slug) {
      const duplicate = await this.prisma.category.findFirst({
        where: {
          NOT: { id },
          OR: [
            ...(payload.slug ? [{ slug: payload.slug }] : []),
            ...(payload.name ? [{ name: payload.name }] : []),
          ],
        },
      });

      if (duplicate) {
        throw new ConflictException(
          duplicate.slug === payload.slug
            ? 'Category slug already exists'
            : 'Category name already exists',
        );
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: payload,
    });
  }

  async remove(id: string) {
    return this.prisma.category.delete({
      where: { id },
    });
  }
}
