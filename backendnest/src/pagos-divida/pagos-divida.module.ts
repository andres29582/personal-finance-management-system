import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PagosDividaController } from './pagos-divida.controller';
import { PagosDividaService } from './pagos-divida.service';
import { PagoDivida } from './entities/pago-divida.entity';
import { ContasModule } from '../contas/contas.module';
import { DividasModule } from '../dividas/dividas.module';
import { CategoriasModule } from '../categorias/categorias.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PagoDivida]),
    ContasModule,
    DividasModule,
    CategoriasModule,
  ],
  controllers: [PagosDividaController],
  providers: [PagosDividaService],
})
export class PagosDividaModule {}
