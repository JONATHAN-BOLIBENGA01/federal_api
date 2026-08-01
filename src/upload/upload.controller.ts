import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const uploadsDirectory = join(process.cwd(), 'uploads');

if (!existsSync(uploadsDirectory)) {
  mkdirSync(uploadsDirectory, { recursive: true });
}

const supabaseConfigured = Boolean(
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.SUPABASE_BUCKET,
);

const supabase = supabaseConfigured
  ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
  : null;

const r2Configured = Boolean(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET,
);

const r2Endpoint = process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const r2PublicBaseUrl = process.env.R2_PUBLIC_BASE_URL || `${r2Endpoint}/${process.env.R2_BUCKET}`;

function getStorage() {
  if (supabaseConfigured || r2Configured) {
    return memoryStorage();
  }

  return diskStorage({
    destination: uploadsDirectory,
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000_000)}`;
      cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
    },
  });
}

function supabasePublicUrl(key: string) {
  const rawBaseUrl =
    process.env.SUPABASE_PUBLIC_URL || `${process.env.SUPABASE_URL}/storage/v1/object/public`;
  const baseUrl = rawBaseUrl.replace(/\/$/, '');
  const bucket = process.env.SUPABASE_BUCKET?.replace(/^\/|\/$/g, '') ?? '';

  if (bucket && !baseUrl.endsWith(`/public/${bucket}`)) {
    return `${baseUrl}/${bucket}/${encodeURI(key)}`;
  }

  return `${baseUrl}/${encodeURI(key)}`;
}

function r2PublicUrl(key: string) {
  return `${r2PublicBaseUrl}/${encodeURIComponent(key)}`;
}

@Controller('upload')
export class UploadController {
  @UseGuards(JwtAuthGuard)
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: getStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new BadRequestException('Only image files are allowed!'), false);
        }

        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const filename = `${Date.now()}-${Math.round(Math.random() * 1_000_000_000)}${extname(file.originalname)}`;
    const key = `uploads/${filename}`;

    if (supabaseConfigured) {
      const { error } = await supabase!.storage.from(process.env.SUPABASE_BUCKET!).upload(key, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

      if (error) {
        throw new InternalServerErrorException('Failed to upload file to Supabase Storage');
      }

      return {
        url: supabasePublicUrl(key),
        filename,
        mimetype: file.mimetype,
        size: file.size,
      };
    }

    if (r2Configured) {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: 'auto',
        endpoint: r2Endpoint,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: true,
      });

      try {
        await client.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET!,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          }),
        );
      } catch (error) {
        throw new InternalServerErrorException('Failed to upload file to storage');
      }

      return {
        url: r2PublicUrl(key),
        filename,
        mimetype: file.mimetype,
        size: file.size,
      };
    }

    return {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
}
