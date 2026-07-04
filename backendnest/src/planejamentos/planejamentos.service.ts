import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AppConflictException,
  ForbiddenResourceException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import {
  AddParticipantePlanejamentoDto,
  CreateGastoPlanejamentoDto,
  CreatePlanejamentoDto,
  FindPlanejamentosDto,
} from './dto';
import { calcularAcertosMinimos, calcularDivisaoIgualitaria } from './domain';
import {
  AcertoPlanejamentoCalculo,
  GastoPlanejamentoCalculo,
  PlanejamentoDominioError,
} from './domain/types';
import { ParticipantePlanejamento } from './entities/participante-planejamento.entity';
import { GastoPlanejamento } from './entities/gasto-planejamento.entity';
import { Planejamento } from './entities/planejamento.entity';
import {
  AcertoStatus,
  DivisaoStatus,
  GastoStatus,
  ParticipanteStatus,
  ParticipanteTipo,
  PlanejamentoStatus,
} from './enums';
import { PlanejamentosRepository } from './planejamentos.repository';

export type PlanejamentoUsuarioAutenticado = {
  id: string;
  email: string;
  nome: string;
};

export type AcertoPlanejamentoSugerido = {
  devedorParticipanteId: string;
  recebedorParticipanteId: string;
  valorCentavos: number;
  status: AcertoStatus.PENDENTE;
  devedorParticipante: ParticipantePlanejamento;
  recebedorParticipante: ParticipantePlanejamento;
};

@Injectable()
export class PlanejamentosService {
  constructor(
    private readonly planejamentosRepository: PlanejamentosRepository,
  ) {}

  async create(
    usuario: PlanejamentoUsuarioAutenticado,
    dto: CreatePlanejamentoDto,
  ): Promise<Planejamento> {
    this.validarPeriodo(dto);

    const planejamento = await this.planejamentosRepository.salvarPlanejamento({
      id: randomUUID(),
      usuarioCriadorId: usuario.id,
      nome: dto.nome,
      descricao: dto.descricao ?? null,
      tipo: dto.tipo,
      status: PlanejamentoStatus.ABERTO,
      dataInicio: dto.dataInicio ?? null,
      dataFim: dto.dataFim ?? null,
      deletedAt: null,
    });

    await this.criarParticipanteProprietarioSeNecessario(
      planejamento.id,
      usuario,
    );

    return this.findOne(planejamento.id, usuario.id);
  }

  async findAll(
    usuarioId: string,
    query: FindPlanejamentosDto,
  ): Promise<Planejamento[]> {
    return this.planejamentosRepository.listarAcessiveisPorUsuario(
      usuarioId,
      query,
    );
  }

  async findOne(id: string, usuarioId: string): Promise<Planejamento> {
    const planejamento =
      await this.planejamentosRepository.buscarAcessivelComParticipantes(
        id,
        usuarioId,
      );

    if (!planejamento) {
      throw new ResourceNotFoundException(
        'PLANEJAMENTO_NOT_FOUND',
        'Planejamento nao encontrado.',
      );
    }

    return planejamento;
  }

  async addParticipante(
    planejamentoId: string,
    usuarioId: string,
    dto: AddParticipantePlanejamentoDto,
  ): Promise<ParticipantePlanejamento> {
    await this.assertUsuarioProprietario(planejamentoId, usuarioId);
    await this.assertParticipanteAtivoNaoDuplicado(planejamentoId, dto);

    return this.planejamentosRepository.salvarParticipante({
      id: randomUUID(),
      planejamentoId,
      usuarioId: dto.usuarioId ?? null,
      nome: dto.nome,
      email: dto.email ?? null,
      tipo: dto.usuarioId
        ? ParticipanteTipo.VINCULADO
        : ParticipanteTipo.MANUAL,
      status: ParticipanteStatus.ATIVO,
    });
  }

  async createGasto(
    planejamentoId: string,
    usuarioId: string,
    dto: CreateGastoPlanejamentoDto,
  ): Promise<GastoPlanejamento> {
    const planejamento = await this.findOne(planejamentoId, usuarioId);
    this.assertParticipantePertenceAoPlanejamento(
      planejamento,
      dto.pagoPorParticipanteId,
      'PLANEJAMENTO_PAGADOR_INVALIDO',
      'O pagador precisa ser participante ativo do planejamento.',
    );

    const divisoesCalculadas = this.calcularDivisoes(dto);

    for (const divisao of divisoesCalculadas) {
      this.assertParticipantePertenceAoPlanejamento(
        planejamento,
        divisao.participanteId,
        'PLANEJAMENTO_DIVISAO_PARTICIPANTE_INVALIDO',
        'Todos os participantes da divisao precisam pertencer ao planejamento.',
      );
    }

    const gastoId = randomUUID();
    const gasto = await this.planejamentosRepository.salvarGasto({
      id: gastoId,
      planejamentoId,
      descricao: dto.descricao,
      valorCentavos: dto.valorCentavos,
      dataGasto: dto.dataGasto,
      categoria: dto.categoria ?? null,
      comportamento: dto.comportamento,
      status: GastoStatus.ATIVO,
      pagoPorParticipanteId: dto.pagoPorParticipanteId,
      observacao: dto.observacao ?? null,
      comprovanteUrl: null,
      comprovanteNome: null,
      mesReferencia: dto.mesReferencia ?? null,
      ultimaAlteracaoValorEm: null,
      requerRevisaoMensal: false,
      deletedAt: null,
    });

    await this.planejamentosRepository.salvarDivisoes(
      divisoesCalculadas.map((divisao) => ({
        id: randomUUID(),
        gastoId,
        participanteId: divisao.participanteId,
        valorDevidoCentavos: divisao.valorCentavos,
        status: DivisaoStatus.ATIVA,
      })),
    );

    return this.findGasto(planejamentoId, gasto.id, usuarioId);
  }

  async findGastos(
    planejamentoId: string,
    usuarioId: string,
  ): Promise<GastoPlanejamento[]> {
    await this.findOne(planejamentoId, usuarioId);

    return this.planejamentosRepository.listarGastosPorPlanejamento(
      planejamentoId,
    );
  }

  async findGasto(
    planejamentoId: string,
    gastoId: string,
    usuarioId: string,
  ): Promise<GastoPlanejamento> {
    await this.findOne(planejamentoId, usuarioId);

    const gasto =
      await this.planejamentosRepository.buscarGastoPorIdEPlanejamento(
        gastoId,
        planejamentoId,
      );

    if (!gasto) {
      throw new ResourceNotFoundException(
        'PLANEJAMENTO_GASTO_NOT_FOUND',
        'Gasto do planejamento nao encontrado.',
      );
    }

    return gasto;
  }

  async findAcertos(
    planejamentoId: string,
    usuarioId: string,
  ): Promise<AcertoPlanejamentoSugerido[]> {
    const planejamento =
      await this.planejamentosRepository.buscarComGastosDivisoesAcertos(
        planejamentoId,
        usuarioId,
      );

    if (!planejamento) {
      throw new ResourceNotFoundException(
        'PLANEJAMENTO_NOT_FOUND',
        'Planejamento nao encontrado.',
      );
    }

    const participantesAtivos = (planejamento.participantes ?? []).filter(
      (participante) => participante.status === ParticipanteStatus.ATIVO,
    );
    const participantesPorId = new Map(
      participantesAtivos.map((participante) => [
        participante.id,
        participante,
      ]),
    );
    const acertos = this.calcularAcertosPersistidos(
      planejamento,
      participantesAtivos.map((participante) => participante.id),
    );

    return acertos.map((acerto) => ({
      devedorParticipanteId: acerto.devedorParticipanteId,
      recebedorParticipanteId: acerto.recebedorParticipanteId,
      valorCentavos: acerto.valorCentavos,
      status: AcertoStatus.PENDENTE,
      devedorParticipante: participantesPorId.get(
        acerto.devedorParticipanteId,
      )!,
      recebedorParticipante: participantesPorId.get(
        acerto.recebedorParticipanteId,
      )!,
    }));
  }

  private validarPeriodo(dto: CreatePlanejamentoDto): void {
    if (!dto.dataInicio || !dto.dataFim || dto.dataFim >= dto.dataInicio) {
      return;
    }

    throw new ValidationAppException(
      'PLANEJAMENTO_PERIODO_INVALIDO',
      'A data final deve ser maior ou igual a data inicial.',
      { field: 'dataFim' },
    );
  }

  private async criarParticipanteProprietarioSeNecessario(
    planejamentoId: string,
    usuario: PlanejamentoUsuarioAutenticado,
  ): Promise<void> {
    const participanteExistente =
      await this.planejamentosRepository.buscarParticipanteAtivoPorUsuario(
        planejamentoId,
        usuario.id,
      );

    if (participanteExistente) {
      return;
    }

    await this.planejamentosRepository.salvarParticipante({
      id: randomUUID(),
      planejamentoId,
      usuarioId: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: ParticipanteTipo.VINCULADO,
      status: ParticipanteStatus.ATIVO,
    });
  }

  private async assertUsuarioProprietario(
    planejamentoId: string,
    usuarioId: string,
  ): Promise<void> {
    const planejamento = await this.findOne(planejamentoId, usuarioId);

    if (planejamento.usuarioCriadorId === usuarioId) {
      return;
    }

    throw new ForbiddenResourceException(
      'PLANEJAMENTO_OWNER_REQUIRED',
      'Apenas o proprietario do planejamento pode adicionar participantes.',
    );
  }

  private async assertParticipanteAtivoNaoDuplicado(
    planejamentoId: string,
    dto: AddParticipantePlanejamentoDto,
  ): Promise<void> {
    const participanteExistente =
      await this.planejamentosRepository.buscarParticipanteAtivoDuplicado(
        planejamentoId,
        {
          usuarioId: dto.usuarioId,
          email: dto.email,
          nome: dto.nome,
        },
      );

    if (!participanteExistente) {
      return;
    }

    throw new AppConflictException(
      'PLANEJAMENTO_PARTICIPANTE_DUPLICADO',
      'Ja existe um participante ativo com estes dados no planejamento.',
    );
  }

  private calcularDivisoes(dto: CreateGastoPlanejamentoDto) {
    try {
      return calcularDivisaoIgualitaria(
        dto.valorCentavos,
        dto.participantesIds,
      );
    } catch (error) {
      if (error instanceof PlanejamentoDominioError) {
        throw new ValidationAppException(error.code, error.message);
      }

      throw error;
    }
  }

  private calcularAcertosPersistidos(
    planejamento: Planejamento,
    participantesIds: string[],
  ) {
    try {
      return calcularAcertosMinimos(
        participantesIds,
        this.mapearGastosParaCalculo(planejamento),
        this.mapearAcertosParaCalculo(planejamento),
      );
    } catch (error) {
      if (error instanceof PlanejamentoDominioError) {
        throw new ValidationAppException(error.code, error.message);
      }

      throw error;
    }
  }

  private mapearGastosParaCalculo(
    planejamento: Planejamento,
  ): GastoPlanejamentoCalculo[] {
    return (planejamento.gastos ?? [])
      .filter((gasto) => gasto.status === GastoStatus.ATIVO && !gasto.deletedAt)
      .map((gasto) => ({
        id: gasto.id,
        pagoPorParticipanteId: gasto.pagoPorParticipanteId,
        status: gasto.status,
        valorCentavos: gasto.valorCentavos,
        divisoes: (gasto.divisoes ?? [])
          .filter((divisao) => divisao.status === DivisaoStatus.ATIVA)
          .map((divisao) => ({
            participanteId: divisao.participanteId,
            valorCentavos: divisao.valorDevidoCentavos,
          })),
      }));
  }

  private mapearAcertosParaCalculo(
    planejamento: Planejamento,
  ): AcertoPlanejamentoCalculo[] {
    return (planejamento.acertos ?? []).map((acerto) => ({
      devedorParticipanteId: acerto.deParticipanteId,
      recebedorParticipanteId: acerto.paraParticipanteId,
      status: acerto.status,
      valorCentavos: acerto.valorCentavos,
    }));
  }

  private assertParticipantePertenceAoPlanejamento(
    planejamento: Planejamento,
    participanteId: string,
    code: string,
    message: string,
  ): void {
    const pertence = planejamento.participantes.some(
      (participante) =>
        participante.id === participanteId &&
        participante.status === ParticipanteStatus.ATIVO,
    );

    if (pertence) {
      return;
    }

    throw new ValidationAppException(code, message);
  }
}
