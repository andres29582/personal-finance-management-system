import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DividasController } from './dividas.controller';
import { DividasService } from './dividas.service';
import { Divida } from './entities/divida.entity';
import { ContasModule } from '../contas/contas.module';
import { DividaRepository } from './repositories/divida.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Divida]), ContasModule],
  controllers: [DividasController],
  providers: [DividasService, DividaRepository],
  exports: [DividasService],
})
export class DividasModule {}
