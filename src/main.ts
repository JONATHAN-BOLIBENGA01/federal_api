import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
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

const allowedOriginPatterns = (
  process.env.CORS_ORIGIN_PATTERNS || defaultAllowedOriginPatterns.join(',')
)
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
        console.log(`Admin role restored for ${email}`);
        return;
      }

      console.log(`Admin already exists: ${email}`);
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

    console.log(`Admin created: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function bootstrap() {
  await ensureAdminUser();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Enable CORS for frontend
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

  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Serve uploaded files statically from the project root in both dev and dist builds.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
