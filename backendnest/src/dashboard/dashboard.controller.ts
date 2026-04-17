import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { GetDashboardDto } from './dto/get-dashboard.dto';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(
    @Request() req: AuthenticatedRequest,
    @Query() query: GetDashboardDto,
  ) {
    return this.dashboardService.getDashboard(req.user.id, query);
  }
}
