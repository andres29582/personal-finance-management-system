import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
  FindAcertoPlanejamentoParamsDto,
  FindAcertosPlanejamentoParamsDto,
  FindGastoPlanejamentoParamsDto,
  FindGastosPlanejamentoParamsDto,
  FindPlanejamentoParamsDto,
  FindPlanejamentosDto,
  RemoveParticipantePlanejamentoParamsDto,
  UpdateGastoPlanejamentoDto,
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

  @Get(':id/resumo')
  findResumo(
    @Param() params: FindPlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.planejamentosService.findResumo(params.id, req.user.id);
  }

  @Patch(':id/fechar')
  fechar(
    @Param() params: FindPlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.planejamentosService.fechar(params.id, req.user.id);
  }

  @Patch(':id/arquivar')
  arquivar(
    @Param() params: FindPlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.planejamentosService.arquivar(params.id, req.user.id);
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

  @Delete(':planejamentoId/participantes/:participanteId')
  removerParticipante(
    @Param() params: RemoveParticipantePlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.planejamentosService.removerParticipante(
      params.planejamentoId,
      params.participanteId,
      req.user.id,
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

  @Patch(':planejamentoId/gastos/:gastoId')
  atualizarGasto(
    @Param() params: FindGastoPlanejamentoParamsDto,
    @Body() dto: UpdateGastoPlanejamentoDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.planejamentosService.atualizarGasto(
      params.planejamentoId,
      params.gastoId,
      req.user.id,
      dto,
    );
  }

  @Patch(':planejamentoId/gastos/:gastoId/cancelar')
  cancelarGasto(
    @Param() params: FindGastoPlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.planejamentosService.cancelarGasto(
      params.planejamentoId,
      params.gastoId,
      req.user.id,
    );
  }

  @Get(':planejamentoId/acertos')
  findAcertos(
    @Param() params: FindAcertosPlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.planejamentosService.findAcertos(
      params.planejamentoId,
      req.user.id,
    );
  }

  @Post(':planejamentoId/acertos/sincronizar')
  sincronizarAcertos(
    @Param() params: FindAcertosPlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.planejamentosService.sincronizarAcertos(
      params.planejamentoId,
      req.user.id,
    );
  }

  @Patch(':planejamentoId/acertos/:acertoId/pagar')
  pagarAcerto(
    @Param() params: FindAcertoPlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.planejamentosService.pagarAcerto(
      params.planejamentoId,
      params.acertoId,
      req.user.id,
    );
  }

  @Patch(':planejamentoId/acertos/:acertoId/cancelar')
  cancelarAcerto(
    @Param() params: FindAcertoPlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.planejamentosService.cancelarAcerto(
      params.planejamentoId,
      params.acertoId,
      req.user.id,
    );
  }

  @Patch(':planejamentoId/acertos/:acertoId/reabrir')
  reabrirAcerto(
    @Param() params: FindAcertoPlanejamentoParamsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.planejamentosService.reabrirAcerto(
      params.planejamentoId,
      params.acertoId,
      req.user.id,
    );
  }
}
