import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Conta } from '../contas/entities/conta.entity';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { RelatoriosController } from './relatorios.controller';
import { RelatoriosService } from './relatorios.service';
import { RelatorioRepository } from './repositories/relatorio.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Transacao, Categoria, Conta])],
  controllers: [RelatoriosController],
  providers: [RelatoriosService, RelatorioRepository],
  exports: [RelatoriosService],
})
export class RelatoriosModule {}
