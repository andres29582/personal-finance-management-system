import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  FindOptionsWhere,
  IsNull,
  Repository,
} from 'typeorm';
import { AcertoPlanejamento } from './entities/acerto-planejamento.entity';
import { DivisaoGasto } from './entities/divisao-gasto.entity';
import { GastoPlanejamento } from './entities/gasto-planejamento.entity';
import { ParticipantePlanejamento } from './entities/participante-planejamento.entity';
import { Planejamento } from './entities/planejamento.entity';
import { ParticipanteStatus, PlanejamentoStatus } from './enums';

export type ListarPlanejamentosFiltros = {
  status?: PlanejamentoStatus;
};

export type BuscarParticipanteDuplicadoFiltros = {
  usuarioId?: string;
  email?: string;
  nome: string;
};

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
    private readonly dataSource: DataSource,
  ) {}

  async executarEmTransacao<T>(
    operacao: (repository: PlanejamentosRepository) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction((manager) =>
      operacao(
        new PlanejamentosRepository(
          manager.getRepository(Planejamento),
          manager.getRepository(ParticipantePlanejamento),
          manager.getRepository(GastoPlanejamento),
          manager.getRepository(DivisaoGasto),
          manager.getRepository(AcertoPlanejamento),
          this.dataSource,
        ),
      ),
    );
  }

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

  async listarAcessiveisPorUsuario(
    usuarioId: string,
    filtros: ListarPlanejamentosFiltros = {},
  ): Promise<Planejamento[]> {
    return this.planejamentoRepository.find({
      where: this.criarWhereAcessivel(usuarioId, filtros),
      relations: {
        participantes: true,
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

  async buscarAcessivelComParticipantes(
    id: string,
    usuarioId: string,
  ): Promise<Planejamento | null> {
    return this.planejamentoRepository.findOne({
      where: this.criarWhereAcessivel(usuarioId, { id }),
      relations: {
        participantes: true,
      },
    });
  }

  async buscarComGastosDivisoesAcertos(
    id: string,
    usuarioId: string,
  ): Promise<Planejamento | null> {
    return this.planejamentoRepository.findOne({
      where: this.criarWhereAcessivel(usuarioId, { id }),
      relations: {
        participantes: true,
        gastos: {
          divisoes: true,
          pagoPorParticipante: true,
        },
        acertos: {
          deParticipante: true,
          paraParticipante: true,
        },
      },
    });
  }

  async buscarAcertoPorIdEPlanejamento(
    id: string,
    planejamentoId: string,
  ): Promise<AcertoPlanejamento | null> {
    return this.acertoRepository.findOne({
      where: {
        id,
        planejamentoId,
      },
      relations: {
        deParticipante: true,
        paraParticipante: true,
      },
    });
  }

  async listarGastosPorPlanejamento(
    planejamentoId: string,
  ): Promise<GastoPlanejamento[]> {
    return this.gastoRepository.find({
      where: {
        planejamentoId,
        deletedAt: IsNull(),
      },
      relations: {
        divisoes: true,
        pagoPorParticipante: true,
      },
      order: {
        dataGasto: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  async buscarGastoPorIdEPlanejamento(
    id: string,
    planejamentoId: string,
  ): Promise<GastoPlanejamento | null> {
    return this.gastoRepository.findOne({
      where: {
        id,
        planejamentoId,
        deletedAt: IsNull(),
      },
      relations: {
        divisoes: true,
        pagoPorParticipante: true,
      },
    });
  }

  async buscarParticipanteAtivoPorUsuario(
    planejamentoId: string,
    usuarioId: string,
  ): Promise<ParticipantePlanejamento | null> {
    return this.participanteRepository.findOne({
      where: {
        planejamentoId,
        usuarioId,
        status: ParticipanteStatus.ATIVO,
      },
    });
  }

  async buscarParticipanteAtivoDuplicado(
    planejamentoId: string,
    filtros: BuscarParticipanteDuplicadoFiltros,
  ): Promise<ParticipantePlanejamento | null> {
    const where: FindOptionsWhere<ParticipantePlanejamento>[] = [];

    if (filtros.usuarioId) {
      where.push({
        planejamentoId,
        usuarioId: filtros.usuarioId,
        status: ParticipanteStatus.ATIVO,
      });
    }

    if (filtros.email) {
      where.push({
        planejamentoId,
        email: filtros.email,
        status: ParticipanteStatus.ATIVO,
      });
    }

    if (!filtros.usuarioId && !filtros.email) {
      where.push({
        planejamentoId,
        nome: filtros.nome,
        status: ParticipanteStatus.ATIVO,
      });
    }

    return this.participanteRepository.findOne({ where });
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

  async salvarAcerto(
    acerto: DeepPartial<AcertoPlanejamento>,
  ): Promise<AcertoPlanejamento> {
    return this.acertoRepository.save(acerto);
  }

  private criarWhereAcessivel(
    usuarioId: string,
    filtros: ListarPlanejamentosFiltros & { id?: string },
  ): FindOptionsWhere<Planejamento>[] {
    const baseWhere = {
      ...(filtros.id ? { id: filtros.id } : {}),
      ...(filtros.status ? { status: filtros.status } : {}),
      deletedAt: IsNull(),
    };

    return [
      {
        ...baseWhere,
        usuarioCriadorId: usuarioId,
      },
      {
        ...baseWhere,
        participantes: {
          usuarioId,
          status: ParticipanteStatus.ATIVO,
        },
      },
    ];
  }
}
