import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import express, { json, urlencoded } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const uploadsDirectory = join(process.cwd(), 'uploads');

if (!existsSync(uploadsDirectory)) {
  mkdirSync(uploadsDirectory, { recursive: true });
}

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'https://federal-frontend-rosy.vercel.app',
  'https://federal-frontend-kwehgy6bw-jonathan-bolibenga01s-projects.vercel.app',
];

const defaultAllowedOriginPatterns = [
  '^https://federal-frontend-[a-z0-9-]+\\.vercel\\.app$',
];

const allowedOrigins = (process.env.CORS_ORIGINS || defaultAllowedOrigins.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOriginPatterns = (process.env.CORS_ORIGIN_PATTERNS || defaultAllowedOriginPatterns.join(','))
  .split(',')
  .map((pattern) => pattern.trim())
  .filter(Boolean)
  .map((pattern) => new RegExp(pattern));

async function ensureAdminUser() {
  const prisma = new PrismaClient();
  const email = process.env.ADMIN_EMAIL || 'admin@lefederal.cd';
  const name = process.env.ADMIN_NAME || 'Admin Le Federal';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true },
    });

    if (existingUser) {
      if (existingUser.role !== Role.ADMIN) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { role: Role.ADMIN, name },
        });
      }

      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: Role.ADMIN,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function createServer() {
  await ensureAdminUser();

  const expressApp = express();
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(expressApp),
  );

  expressApp.use(json({ limit: '10mb' }));
  expressApp.use(urlencoded({ limit: '10mb', extended: true }));

  app.enableCors({
    origin: (origin, callback) => {
      const isAllowedOrigin =
        !origin ||
        allowedOrigins.includes(origin) ||
        allowedOriginPatterns.some((pattern) => pattern.test(origin));

      if (isAllowedOrigin) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useStaticAssets(uploadsDirectory, {
    prefix: '/uploads/',
  });

  await app.init();

  return expressApp;
}

const serverPromise = createServer();

export default async function handler(req: any, res: any) {
  const server = await serverPromise;
  return server(req, res);
}

export const config = {
  runtime: 'nodejs',
};
