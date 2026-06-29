import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  getHello(): string {
    return 'Le Federal API is running!';
  }

  async subscribeNewsletter(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

    if (!isValidEmail) {
      throw new BadRequestException('Adresse email invalide');
    }

    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      if (!existing.isActive) {
        await this.prisma.newsletterSubscriber.update({
          where: { email: normalizedEmail },
          data: { isActive: true },
        });
        return { message: 'Abonnement reactive avec succes' };
      }

      return { message: 'Vous etes deja abonne' };
    }

    await this.prisma.newsletterSubscriber.create({
      data: { email: normalizedEmail },
    });

    return { message: 'Abonnement reussi' };
  }
}
