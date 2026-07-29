import { IsBoolean, IsOptional } from 'class-validator';

export class PublishArticleSocialsDto {
  @IsBoolean()
  @IsOptional()
  shareOnFacebook?: boolean;

  @IsBoolean()
  @IsOptional()
  shareOnInstagram?: boolean;

  @IsBoolean()
  @IsOptional()
  shareOnX?: boolean;
}
