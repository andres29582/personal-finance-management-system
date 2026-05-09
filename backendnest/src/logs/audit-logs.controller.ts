import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto';
import { LogsService } from './logs.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  async listMine(
    @Request() req: AuthenticatedRequest,
    @Query() query: FindAuditLogsQueryDto,
  ) {
    return this.logsService.findAuditLogsForUser(
      req.user.id,
      query.limit ?? 50,
      query.offset ?? 0,
    );
  }
}
