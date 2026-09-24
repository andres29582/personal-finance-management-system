import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';
import { Alerta } from './entities/alerta.entity';
import { AlertaRepository } from './repositories/alerta.repository';
import { DividasModule } from '../dividas/dividas.module';
import { MetasModule } from '../metas/metas.module';
import { OrcamentosModule } from '../orcamentos/orcamentos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alerta]),
    DividasModule,
    MetasModule,
    OrcamentosModule,
  ],
  controllers: [AlertasController],
  providers: [AlertasService, AlertaRepository],
  exports: [AlertasService],
})
export class AlertasModule {}
