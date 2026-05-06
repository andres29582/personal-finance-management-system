import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { GetPrevisaoDeficitDto } from './dto/get-previsao-deficit.dto';
import { PrevisoesService } from './previsoes.service';

@UseGuards(JwtAuthGuard)
@Controller('previsoes')
export class PrevisoesController {
  constructor(private readonly previsoesService: PrevisoesService) {}

  @Get('deficit')
  preverDeficit(
    @Request() req: AuthenticatedRequest,
    @Query() query: GetPrevisaoDeficitDto,
  ) {
    return this.previsoesService.preverDeficit(req.user.id, query.mes);
  }
}
