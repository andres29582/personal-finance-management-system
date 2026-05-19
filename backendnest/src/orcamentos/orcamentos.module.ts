import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { Orcamento } from './entities/orcamento.entity';
import { OrcamentosController } from './orcamentos.controller';
import { OrcamentosService } from './orcamentos.service';
import { OrcamentoRepository } from './repositories/orcamento.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Orcamento, Transacao])],
  controllers: [OrcamentosController],
  providers: [OrcamentosService, OrcamentoRepository],
  exports: [OrcamentosService],
})
export class OrcamentosModule {}
