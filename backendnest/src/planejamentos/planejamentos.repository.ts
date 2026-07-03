import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, IsNull, Repository } from 'typeorm';
import { AcertoPlanejamento } from './entities/acerto-planejamento.entity';
import { DivisaoGasto } from './entities/divisao-gasto.entity';
import { GastoPlanejamento } from './entities/gasto-planejamento.entity';
import { ParticipantePlanejamento } from './entities/participante-planejamento.entity';
import { Planejamento } from './entities/planejamento.entity';

@Injectable()
export class PlanejamentosRepository {
  constructor(
    @InjectRepository(Planejamento)
    private readonly planejamentoRepository: Repository<Planejamento>,
    @InjectRepository(ParticipantePlanejamento)
    private readonly participanteRepository: Repository<ParticipantePlanejamento>,
    @InjectRepository(GastoPlanejamento)
    private readonly gastoRepository: Repository<GastoPlanejamento>,
    @InjectRepository(DivisaoGasto)
    private readonly divisaoRepository: Repository<DivisaoGasto>,
    @InjectRepository(AcertoPlanejamento)
    private readonly acertoRepository: Repository<AcertoPlanejamento>,
  ) {}

  async buscarPorIdEUsuarioCriador(
    id: string,
    usuarioCriadorId: string,
  ): Promise<Planejamento | null> {
    return this.planejamentoRepository.findOne({
      where: {
        id,
        usuarioCriadorId,
        deletedAt: IsNull(),
      },
    });
  }

  async listarPorUsuarioCriador(
    usuarioCriadorId: string,
  ): Promise<Planejamento[]> {
    return this.planejamentoRepository.find({
      where: {
        usuarioCriadorId,
        deletedAt: IsNull(),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async buscarComParticipantes(
    id: string,
    usuarioCriadorId: string,
  ): Promise<Planejamento | null> {
    return this.planejamentoRepository.findOne({
      where: {
        id,
        usuarioCriadorId,
        deletedAt: IsNull(),
      },
      relations: {
        participantes: true,
      },
    });
  }

  async buscarComGastosDivisoesAcertos(
    id: string,
    usuarioCriadorId: string,
  ): Promise<Planejamento | null> {
    return this.planejamentoRepository.findOne({
      where: {
        id,
        usuarioCriadorId,
        deletedAt: IsNull(),
      },
      relations: {
        participantes: true,
        gastos: {
          divisoes: true,
        },
        acertos: true,
      },
    });
  }

  async salvarPlanejamento(
    planejamento: DeepPartial<Planejamento>,
  ): Promise<Planejamento> {
    return this.planejamentoRepository.save(planejamento);
  }

  async salvarParticipante(
    participante: DeepPartial<ParticipantePlanejamento>,
  ): Promise<ParticipantePlanejamento> {
    return this.participanteRepository.save(participante);
  }

  async salvarGasto(
    gasto: DeepPartial<GastoPlanejamento>,
  ): Promise<GastoPlanejamento> {
    return this.gastoRepository.save(gasto);
  }

  async salvarDivisoes(
    divisoes: DeepPartial<DivisaoGasto>[],
  ): Promise<DivisaoGasto[]> {
    return this.divisaoRepository.save(divisoes);
  }

  async salvarAcertos(
    acertos: DeepPartial<AcertoPlanejamento>[],
  ): Promise<AcertoPlanejamento[]> {
    return this.acertoRepository.save(acertos);
  }
}
