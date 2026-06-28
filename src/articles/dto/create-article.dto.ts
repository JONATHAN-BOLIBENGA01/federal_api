import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsArray } from 'class-validator';
import { ArticleStatus, Visibility } from '@prisma/client';

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  excerpt?: string;

  @IsString()
  @IsOptional()
  featuredImage?: string;

  @IsEnum(ArticleStatus)
  @IsOptional()
  status?: ArticleStatus;

  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  allowComments?: boolean;

  @IsBoolean()
  @IsOptional()
  allowShare?: boolean;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
