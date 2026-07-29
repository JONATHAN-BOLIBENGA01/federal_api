import { Module } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { ArticlesController } from './articles.controller';
import { PrismaService } from '../prisma/prisma.service';
import { SocialModule } from '../social/social.module';

@Module({
  imports: [SocialModule],
  controllers: [ArticlesController],
  providers: [ArticlesService, PrismaService],
})
export class ArticlesModule {}
