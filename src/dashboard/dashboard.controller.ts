import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  getStats() {
    return this.dashboardService.getStats();
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscribers')
  getSubscribers(@Query('search') search?: string) {
    return this.dashboardService.getSubscribers(search);
  }

  @UseGuards(JwtAuthGuard)
  @Get('articles')
  getArticles(@Query('search') search?: string, @Query('status') status?: string) {
    return this.dashboardService.getArticles(search, status);
  }
}
