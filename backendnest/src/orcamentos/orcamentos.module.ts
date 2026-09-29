import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriasModule } from '../categorias/categorias.module';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { Orcamento } from './entities/orcamento.entity';
import { OrcamentoCategoria } from './entities/orcamento-categoria.entity';
import { OrcamentosController } from './orcamentos.controller';
import { OrcamentosService } from './orcamentos.service';
import { OrcamentoRepository } from './repositories/orcamento.repository';

@Module({
  imports: [
    CategoriasModule,
    TypeOrmModule.forFeature([Orcamento, OrcamentoCategoria, Transacao]),
  ],
  controllers: [OrcamentosController],
  providers: [OrcamentosService, OrcamentoRepository],
  exports: [OrcamentosService],
})
export class OrcamentosModule {}
