import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { GetRelatorioDto } from './dto/get-relatorio.dto';
import { RelatoriosService } from './relatorios.service';

@UseGuards(JwtAuthGuard)
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  @Get()
  getRelatorio(
    @Request() req: AuthenticatedRequest,
    @Query() query: GetRelatorioDto,
  ) {
    return this.relatoriosService.getRelatorio(req.user.id, query);
  }
}
