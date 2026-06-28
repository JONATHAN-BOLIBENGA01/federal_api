import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async create(createTagDto: { name: string; slug: string }) {
    const existing = await this.prisma.tag.findUnique({
      where: { slug: createTagDto.slug },
    });
    if (existing) throw new ConflictException('Tag slug already exists');

    return this.prisma.tag.create({
      data: createTagDto,
    });
  }

  async findAll() {
    return this.prisma.tag.findMany({
      include: {
        _count: {
          select: { articles: true }
        }
      }
    });
  }

  async findOne(id: string) {
    return this.prisma.tag.findUnique({
      where: { id },
      include: {
        articles: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  async update(id: string, updateTagDto: { name?: string; slug?: string }) {
    return this.prisma.tag.update({
      where: { id },
      data: updateTagDto,
    });
  }

  async remove(id: string) {
    return this.prisma.tag.delete({
      where: { id },
    });
  }
}
