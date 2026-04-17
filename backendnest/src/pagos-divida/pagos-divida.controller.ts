import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { PagosDividaService } from './pagos-divida.service';
import { CreatePagoDividaDto } from './dto/create-pago-divida.dto';

@UseGuards(JwtAuthGuard)
@Controller('pagos-divida')
export class PagosDividaController {
  constructor(private readonly pagosDividaService: PagosDividaService) {}

  @Post()
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreatePagoDividaDto,
  ) {
    return this.pagosDividaService.create(req.user.id, dto);
  }

  @Get('divida/:dividaId')
  findAllByDivida(
    @Param('dividaId', ParseUUIDPipe) dividaId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.pagosDividaService.findAllByDivida(dividaId, req.user.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.pagosDividaService.findOne(id, req.user.id);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.pagosDividaService.remove(id, req.user.id);
  }
}
