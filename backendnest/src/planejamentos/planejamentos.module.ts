import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcertoPlanejamento } from './entities/acerto-planejamento.entity';
import { DivisaoGasto } from './entities/divisao-gasto.entity';
import { GastoPlanejamento } from './entities/gasto-planejamento.entity';
import { ParticipantePlanejamento } from './entities/participante-planejamento.entity';
import { Planejamento } from './entities/planejamento.entity';
import { PlanejamentosRepository } from './planejamentos.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Planejamento,
      ParticipantePlanejamento,
      GastoPlanejamento,
      DivisaoGasto,
      AcertoPlanejamento,
    ]),
  ],
  providers: [PlanejamentosRepository],
  exports: [PlanejamentosRepository],
})
export class PlanejamentosModule {}
