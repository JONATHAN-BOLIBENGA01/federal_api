import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('newsletter/subscribe')
  async subscribeNewsletter(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email est requis');
    }
    return this.appService.subscribeNewsletter(email);
  }
}
