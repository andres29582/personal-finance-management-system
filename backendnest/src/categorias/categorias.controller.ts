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
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { TipoCategoria } from './enums/tipo-categoria.enum';

@UseGuards(JwtAuthGuard)
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Post()
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateCategoriaDto,
  ) {
    return this.categoriasService.create(req.user.id, dto);
  }

  @Get()
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query('tipo') tipo?: TipoCategoria,
  ) {
    return this.categoriasService.findAll(req.user.id, tipo);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.categoriasService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateCategoriaDto,
  ) {
    return this.categoriasService.update(id, req.user.id, dto);
  }

  @Patch(':id/desativar')
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.categoriasService.deactivate(id, req.user.id);
  }
}
