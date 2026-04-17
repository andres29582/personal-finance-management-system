import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { CreateOrcamentoDto } from './dto/create-orcamento.dto';
import { FindOrcamentosDto } from './dto/find-orcamentos.dto';
import { UpdateOrcamentoDto } from './dto/update-orcamento.dto';
import { OrcamentosService } from './orcamentos.service';

@UseGuards(JwtAuthGuard)
@Controller('orcamentos')
export class OrcamentosController {
  constructor(private readonly orcamentosService: OrcamentosService) {}

  @Post()
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateOrcamentoDto,
  ) {
    return this.orcamentosService.create(req.user.id, dto);
  }

  @Get()
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query() query: FindOrcamentosDto,
  ) {
    return this.orcamentosService.findAll(req.user.id, query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.orcamentosService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateOrcamentoDto,
  ) {
    return this.orcamentosService.update(id, req.user.id, dto);
  }
}
