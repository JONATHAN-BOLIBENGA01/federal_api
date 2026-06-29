import { Controller, Get, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
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
      throw new HttpException('Email est requis', HttpStatus.BAD_REQUEST);
    }
    return this.appService.subscribeNewsletter(email);
  }
}
