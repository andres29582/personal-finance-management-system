import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  FindOptionsWhere,
  IsNull,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { AcertoPlanejamento } from './entities/acerto-planejamento.entity';
import { DivisaoGasto } from './entities/divisao-gasto.entity';
import { GastoPlanejamento } from './entities/gasto-planejamento.entity';
import { ParticipantePlanejamento } from './entities/participante-planejamento.entity';
import { Planejamento } from './entities/planejamento.entity';
import {
  ParticipanteStatus,
  ParticipanteTipo,
  PlanejamentoStatus,
} from './enums';

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
    operacao: (
      repository: PlanejamentosRepository,
      manager: EntityManager,
    ) => Promise<T>,
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
        manager,
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
    return this.criarQueryAcessivel(usuarioId, filtros)
      .leftJoinAndSelect('planejamento.participantes', 'participantes')
      .orderBy('planejamento.createdAt', 'DESC')
      .getMany();
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
    return this.criarQueryAcessivel(usuarioId, { id })
      .leftJoinAndSelect('planejamento.participantes', 'participantes')
      .getOne();
  }

  async bloquearPlanejamentoParaAtualizacao(
    planejamentoId: string,
  ): Promise<Planejamento | null> {
    return this.planejamentoRepository.findOne({
      where: {
        id: planejamentoId,
        deletedAt: IsNull(),
      },
      lock: {
        mode: 'pessimistic_write',
      },
    });
  }

  async buscarComGastosDivisoesAcertos(
    id: string,
    usuarioId: string,
  ): Promise<Planejamento | null> {
    return this.criarQueryAcessivel(usuarioId, { id })
      .leftJoinAndSelect('planejamento.participantes', 'participantes')
      .leftJoinAndSelect('planejamento.gastos', 'gastos')
      .leftJoinAndSelect('gastos.divisoes', 'divisoes')
      .leftJoinAndSelect(
        'gastos.pagoPorParticipante',
        'gastoPagoPorParticipante',
      )
      .leftJoinAndSelect('planejamento.acertos', 'acertos')
      .leftJoinAndSelect('acertos.deParticipante', 'acertoDeParticipante')
      .leftJoinAndSelect('acertos.paraParticipante', 'acertoParaParticipante')
      .getOne();
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

  async listarAcertosPorPlanejamento(
    planejamentoId: string,
  ): Promise<AcertoPlanejamento[]> {
    return this.acertoRepository.find({
      select: {
        id: true,
        deParticipanteId: true,
        paraParticipanteId: true,
        valorCentavos: true,
        status: true,
        dataPagamento: true,
        observacao: true,
        deParticipante: {
          id: true,
          nome: true,
        },
        paraParticipante: {
          id: true,
          nome: true,
        },
      },
      where: {
        planejamentoId,
      },
      relations: {
        deParticipante: true,
        paraParticipante: true,
      },
      order: {
        createdAt: 'ASC',
        id: 'ASC',
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
        tipo: ParticipanteTipo.VINCULADO,
        status: ParticipanteStatus.ATIVO,
      },
    });
  }

  async buscarParticipantePorIdEPlanejamento(
    id: string,
    planejamentoId: string,
  ): Promise<ParticipantePlanejamento | null> {
    return this.participanteRepository.findOne({
      where: {
        id,
        planejamentoId,
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

  private criarQueryAcessivel(
    usuarioId: string,
    filtros: ListarPlanejamentosFiltros & { id?: string },
  ): SelectQueryBuilder<Planejamento> {
    const query =
      this.planejamentoRepository.createQueryBuilder('planejamento');
    const participanteAtivoSubquery = query
      .subQuery()
      .select('1')
      .from(ParticipantePlanejamento, 'participanteAcesso')
      .where('participanteAcesso.planejamentoId = planejamento.id')
      .andWhere('participanteAcesso.usuarioId = :usuarioId')
      .andWhere('participanteAcesso.status = :participanteStatusAtivo')
      .andWhere('participanteAcesso.tipo = :participanteTipoVinculado')
      .getQuery();

    query
      .where('planejamento.deletedAt IS NULL')
      .andWhere(
        `(planejamento.usuarioCriadorId = :usuarioId OR EXISTS ${participanteAtivoSubquery})`,
        {
          participanteStatusAtivo: ParticipanteStatus.ATIVO,
          participanteTipoVinculado: ParticipanteTipo.VINCULADO,
          usuarioId,
        },
      );

    if (filtros.id) {
      query.andWhere('planejamento.id = :planejamentoId', {
        planejamentoId: filtros.id,
      });
    }

    if (filtros.status) {
      query.andWhere('planejamento.status = :planejamentoStatus', {
        planejamentoStatus: filtros.status,
      });
    }

    return query;
  }
}
