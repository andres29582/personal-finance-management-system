import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransferenciasController } from './transferencias.controller';
import { TransferenciasService } from './transferencias.service';
import { Transferencia } from './entities/transferencia.entity';
import { ContasModule } from '../contas/contas.module';

@Module({
  imports: [TypeOrmModule.forFeature([Transferencia]), ContasModule],
  controllers: [TransferenciasController],
  providers: [TransferenciasService],
  exports: [TransferenciasService],
})
export class TransferenciasModule {}
