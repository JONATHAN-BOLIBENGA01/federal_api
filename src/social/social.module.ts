import { Module } from '@nestjs/common';
import { SocialPublishingService } from './social-publishing.service';

@Module({
  providers: [SocialPublishingService],
  exports: [SocialPublishingService],
})
export class SocialModule {}
