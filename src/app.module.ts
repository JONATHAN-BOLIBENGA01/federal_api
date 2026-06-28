import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ArticlesModule } from './articles/articles.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { TagsModule } from './tags/tags.module';
import { UploadModule } from './upload/upload.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    PrismaModule,
    ArticlesModule, 
    UsersModule, 
    AuthModule, 
    CategoriesModule, 
    TagsModule, 
    UploadModule, 
    DashboardModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
