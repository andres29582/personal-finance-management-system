import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Conta } from '../contas/entities/conta.entity';
import { ContasModule } from '../contas/contas.module';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './repositories/dashboard.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transacao, Categoria, Conta]),
    ContasModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository],
  exports: [DashboardService],
})
export class DashboardModule {}
