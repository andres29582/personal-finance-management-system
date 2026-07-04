import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import {
  AddParticipantePlanejamentoDto,
  CreateGastoPlanejamentoDto,
  CreatePlanejamentoDto,
  FindGastoPlanejamentoParamsDto,
  FindGastosPlanejamentoParamsDto,
  FindPlanejamentoParamsDto,
  FindPlanejamentosDto,
} from './dto';
import { PlanejamentosService } from './planejamentos.service';

@UseGuards(JwtAuthGuard)
@Controller('planejamentos')
export class PlanejamentosController {
  constructor(private readonly planejamentosService: PlanejamentosService) {}

  @Post()
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreatePlanejamentoDto,
  ) {
    return this.planejamentosService.create(req.user, dto);
  }

  @Get()
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query() query: FindPlanejamentosDto,
  ) {
    return this.planejamentosService.findAll(req.user.id, query);
  }

  @Get(':id')
  findOne(
    @Param() params: FindPlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.planejamentosService.findOne(params.id, req.user.id);
  }

  @Post(':id/participantes')
  addParticipante(
    @Param() params: FindPlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
    @Body() dto: AddParticipantePlanejamentoDto,
  ) {
    return this.planejamentosService.addParticipante(
      params.id,
      req.user.id,
      dto,
    );
  }

  @Post(':planejamentoId/gastos')
  createGasto(
    @Param() params: FindGastosPlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateGastoPlanejamentoDto,
  ) {
    return this.planejamentosService.createGasto(
      params.planejamentoId,
      req.user.id,
      dto,
    );
  }

  @Get(':planejamentoId/gastos')
  findGastos(
    @Param() params: FindGastosPlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.planejamentosService.findGastos(
      params.planejamentoId,
      req.user.id,
    );
  }

  @Get(':planejamentoId/gastos/:gastoId')
  findGasto(
    @Param() params: FindGastoPlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.planejamentosService.findGasto(
      params.planejamentoId,
      params.gastoId,
      req.user.id,
    );
  }
}
