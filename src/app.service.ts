import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  getHello(): string {
    return 'Le Fédéral API is running!';
  }

  async subscribeNewsletter(email: string) {
    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email },
    });
    
    if (existing) {
      if (!existing.isActive) {
        await this.prisma.newsletterSubscriber.update({
          where: { email },
          data: { isActive: true },
        });
        return { message: 'Abonnement réactivé avec succès' };
      }
      return { message: 'Vous êtes déjà abonné' };
    }

    await this.prisma.newsletterSubscriber.create({
      data: { email },
    });
    
    return { message: 'Abonnement réussi' };
  }
}
