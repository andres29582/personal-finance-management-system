import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { Transferencia } from '../transferencias/entities/transferencia.entity';
import { ContasController } from './contas.controller';
import { ContasService } from './contas.service';
import { Conta } from './entities/conta.entity';
import { ContaRepository } from './repositories/conta.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Conta, Transacao, Transferencia])],
  controllers: [ContasController],
  providers: [ContasService, ContaRepository],
  exports: [ContasService],
})
export class ContasModule {}
