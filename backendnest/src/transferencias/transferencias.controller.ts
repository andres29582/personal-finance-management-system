import { FindTransferenciasDto } from './dto/find-transferencias.dto';
import { publicTransfer } from './transfer-intent';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { TransferenciasService } from './transferencias.service';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import { UpdateTransferenciaDto } from './dto/update-transferencia.dto';

@UseGuards(JwtAuthGuard)
@Controller('transferencias')
export class TransferenciasController {
  constructor(private readonly transferenciasService: TransferenciasService) {}

  @Post()
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateTransferenciaDto,
  ) {
    return this.transferenciasService.create(req.user.id, dto).then(publicTransfer);
  }

  @Get()
  findAll(@Request() req: AuthenticatedRequest, @Query() query: FindTransferenciasDto = {}) {
    return this.transferenciasService.findAll(req.user.id, query).then((rows) => rows.map(publicTransfer));
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.transferenciasService.findOne(id, req.user.id).then(publicTransfer);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateTransferenciaDto,
  ) {
    return this.transferenciasService.update(id, req.user.id, dto).then(publicTransfer);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.transferenciasService.remove(id, req.user.id);
  }
}
