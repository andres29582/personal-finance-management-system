import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransacoesController } from './transacoes.controller';
import { TransacoesService } from './transacoes.service';
import { Transacao } from './entities/transacao.entity';
import { ContasModule } from '../contas/contas.module';
import { CategoriasModule } from '../categorias/categorias.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transacao]),
    ContasModule,
    CategoriasModule,
  ],
  controllers: [TransacoesController],
  providers: [TransacoesService],
  exports: [TransacoesService],
})
export class TransacoesModule {}
