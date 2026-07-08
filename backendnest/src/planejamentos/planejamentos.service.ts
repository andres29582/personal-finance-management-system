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
import { AcertoPlanejamento } from './entities/acerto-planejamento.entity';
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
  email?: string | null;
  nome?: string | null;
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

    const planejamento = await this.planejamentosRepository.executarEmTransacao(
      (repository) =>
        this.criarPlanejamentoComProprietario(repository, usuario, dto),
    );

    return this.findOne(planejamento.id, usuario.id);
  }

  async sincronizarAcertos(
    planejamentoId: string,
    usuarioId: string,
  ): Promise<AcertoPlanejamento[]> {
    const planejamento = await this.buscarPlanejamentoParaAcertos(
      planejamentoId,
      usuarioId,
    );
    const participantesAtivos = this.listarParticipantesAtivos(planejamento);
    const participantesPorId =
      this.mapearParticipantesPorId(participantesAtivos);
    const sugestoes = this.calcularAcertosPersistidos(
      planejamento,
      participantesAtivos.map((participante) => participante.id),
    );
    const acertosPendentesExistentes =
      this.filtrarAcertosPendentes(planejamento);
    const novosAcertos = sugestoes
      .filter(
        (sugestao) =>
          !this.existeAcertoPendenteEquivalente(
            sugestao,
            acertosPendentesExistentes,
          ),
      )
      .map((sugestao) => {
        this.assertParticipanteIdAtivo(
          participantesPorId,
          sugestao.devedorParticipanteId,
          'PLANEJAMENTO_ACERTO_DEVEDOR_INVALIDO',
          'O devedor do acerto precisa ser participante ativo do planejamento.',
        );
        this.assertParticipanteIdAtivo(
          participantesPorId,
          sugestao.recebedorParticipanteId,
          'PLANEJAMENTO_ACERTO_RECEBEDOR_INVALIDO',
          'O recebedor do acerto precisa ser participante ativo do planejamento.',
        );

        return {
          id: randomUUID(),
          planejamentoId,
          deParticipanteId: sugestao.devedorParticipanteId,
          paraParticipanteId: sugestao.recebedorParticipanteId,
          valorCentavos: sugestao.valorCentavos,
          status: AcertoStatus.PENDENTE,
          dataPagamento: null,
          observacao: null,
        };
      });

    if (novosAcertos.length === 0) {
      return acertosPendentesExistentes;
    }

    return this.planejamentosRepository.executarEmTransacao(
      async (repository) => [
        ...acertosPendentesExistentes,
        ...(await repository.salvarAcertos(novosAcertos)),
      ],
    );
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

    const gasto = await this.planejamentosRepository.executarEmTransacao(
      async (repository) => {
        const gastoId = randomUUID();
        const gastoSalvo = await repository.salvarGasto({
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

        await repository.salvarDivisoes(
          divisoesCalculadas.map((divisao) => ({
            id: randomUUID(),
            gastoId,
            participanteId: divisao.participanteId,
            valorDevidoCentavos: divisao.valorCentavos,
            status: DivisaoStatus.ATIVA,
          })),
        );

        return gastoSalvo;
      },
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
    const planejamento = await this.buscarPlanejamentoParaAcertos(
      planejamentoId,
      usuarioId,
    );
    const participantesAtivos = this.listarParticipantesAtivos(planejamento);
    const participantesPorId =
      this.mapearParticipantesPorId(participantesAtivos);
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

  async pagarAcerto(
    planejamentoId: string,
    acertoId: string,
    usuarioId: string,
  ): Promise<AcertoPlanejamento> {
    const { planejamento, acerto } = await this.buscarContextoAcerto(
      planejamentoId,
      acertoId,
      usuarioId,
    );

    this.assertUsuarioPodePagarAcerto(planejamento, acerto, usuarioId);
    this.assertTransicaoAcertoPermitida(
      acerto.status,
      [AcertoStatus.PENDENTE],
      'PLANEJAMENTO_ACERTO_PAGAR_STATUS_INVALIDO',
      'Apenas acertos pendentes podem ser marcados como pagos.',
    );

    return this.planejamentosRepository.salvarAcerto({
      ...acerto,
      status: AcertoStatus.PAGO,
      dataPagamento: new Date(),
    });
  }

  async cancelarAcerto(
    planejamentoId: string,
    acertoId: string,
    usuarioId: string,
  ): Promise<AcertoPlanejamento> {
    const { planejamento, acerto } = await this.buscarContextoAcerto(
      planejamentoId,
      acertoId,
      usuarioId,
    );

    this.assertUsuarioProprietarioDoPlanejamento(planejamento, usuarioId);
    this.assertTransicaoAcertoPermitida(
      acerto.status,
      [AcertoStatus.PENDENTE, AcertoStatus.PAGO],
      'PLANEJAMENTO_ACERTO_CANCELAR_STATUS_INVALIDO',
      'Apenas acertos pendentes ou pagos podem ser cancelados.',
    );

    return this.planejamentosRepository.salvarAcerto({
      ...acerto,
      status: AcertoStatus.CANCELADO,
      dataPagamento: null,
    });
  }

  async reabrirAcerto(
    planejamentoId: string,
    acertoId: string,
    usuarioId: string,
  ): Promise<AcertoPlanejamento> {
    const { planejamento, acerto } = await this.buscarContextoAcerto(
      planejamentoId,
      acertoId,
      usuarioId,
    );

    this.assertUsuarioProprietarioDoPlanejamento(planejamento, usuarioId);
    this.assertTransicaoAcertoPermitida(
      acerto.status,
      [AcertoStatus.CANCELADO],
      'PLANEJAMENTO_ACERTO_REABRIR_STATUS_INVALIDO',
      'Apenas acertos cancelados podem ser reabertos.',
    );

    return this.planejamentosRepository.salvarAcerto({
      ...acerto,
      status: AcertoStatus.PENDENTE,
      dataPagamento: null,
    });
  }

  private async criarPlanejamentoComProprietario(
    repository: PlanejamentosRepository,
    usuario: PlanejamentoUsuarioAutenticado,
    dto: CreatePlanejamentoDto,
  ): Promise<Planejamento> {
    const planejamento = await repository.salvarPlanejamento({
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
      repository,
      planejamento.id,
      usuario,
    );

    return planejamento;
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
    repository: PlanejamentosRepository,
    planejamentoId: string,
    usuario: PlanejamentoUsuarioAutenticado,
  ): Promise<void> {
    const participanteExistente =
      await repository.buscarParticipanteAtivoPorUsuario(
        planejamentoId,
        usuario.id,
      );

    if (participanteExistente) {
      return;
    }

    await repository.salvarParticipante({
      id: randomUUID(),
      planejamentoId,
      usuarioId: usuario.id,
      nome: this.obterNomeParticipanteProprietario(usuario),
      email: usuario.email ?? null,
      tipo: ParticipanteTipo.VINCULADO,
      status: ParticipanteStatus.ATIVO,
    });
  }

  private obterNomeParticipanteProprietario(
    usuario: PlanejamentoUsuarioAutenticado,
  ): string {
    const nome = usuario.nome?.trim();

    if (nome) {
      return nome;
    }

    const emailPrefix = usuario.email?.split('@')[0]?.trim();

    return emailPrefix || 'Proprietario';
  }

  private async assertUsuarioProprietario(
    planejamentoId: string,
    usuarioId: string,
  ): Promise<void> {
    const planejamento = await this.findOne(planejamentoId, usuarioId);

    this.assertUsuarioProprietarioDoPlanejamento(planejamento, usuarioId);
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

  private async buscarPlanejamentoParaAcertos(
    planejamentoId: string,
    usuarioId: string,
  ): Promise<Planejamento> {
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

    return planejamento;
  }

  private async buscarContextoAcerto(
    planejamentoId: string,
    acertoId: string,
    usuarioId: string,
  ): Promise<{ planejamento: Planejamento; acerto: AcertoPlanejamento }> {
    const planejamento = await this.findOne(planejamentoId, usuarioId);
    const acerto =
      await this.planejamentosRepository.buscarAcertoPorIdEPlanejamento(
        acertoId,
        planejamentoId,
      );

    if (!acerto) {
      throw new ResourceNotFoundException(
        'PLANEJAMENTO_ACERTO_NOT_FOUND',
        'Acerto do planejamento nao encontrado.',
      );
    }

    return { planejamento, acerto };
  }

  private assertUsuarioProprietarioDoPlanejamento(
    planejamento: Planejamento,
    usuarioId: string,
  ): void {
    if (planejamento.usuarioCriadorId === usuarioId) {
      return;
    }

    throw new ForbiddenResourceException(
      'PLANEJAMENTO_OWNER_REQUIRED',
      'Apenas o proprietario do planejamento pode executar esta acao.',
    );
  }

  private assertUsuarioPodePagarAcerto(
    planejamento: Planejamento,
    acerto: AcertoPlanejamento,
    usuarioId: string,
  ): void {
    if (planejamento.usuarioCriadorId === usuarioId) {
      return;
    }

    if (acerto.deParticipante?.usuarioId === usuarioId) {
      return;
    }

    throw new ForbiddenResourceException(
      'PLANEJAMENTO_ACERTO_PAGAR_FORBIDDEN',
      'Apenas o proprietario ou o participante devedor pode marcar o acerto como pago.',
    );
  }

  private assertTransicaoAcertoPermitida(
    statusAtual: AcertoStatus,
    statusPermitidos: AcertoStatus[],
    code: string,
    message: string,
  ): void {
    if (statusPermitidos.includes(statusAtual)) {
      return;
    }

    throw new ValidationAppException(code, message, {
      details: { statusAtual },
    });
  }

  private listarParticipantesAtivos(
    planejamento: Planejamento,
  ): ParticipantePlanejamento[] {
    return (planejamento.participantes ?? []).filter(
      (participante) => participante.status === ParticipanteStatus.ATIVO,
    );
  }

  private mapearParticipantesPorId(
    participantes: ParticipantePlanejamento[],
  ): Map<string, ParticipantePlanejamento> {
    return new Map(
      participantes.map((participante) => [participante.id, participante]),
    );
  }

  private filtrarAcertosPendentes(
    planejamento: Planejamento,
  ): AcertoPlanejamento[] {
    return (planejamento.acertos ?? []).filter(
      (acerto) => acerto.status === AcertoStatus.PENDENTE,
    );
  }

  private existeAcertoPendenteEquivalente(
    sugestao: {
      devedorParticipanteId: string;
      recebedorParticipanteId: string;
      valorCentavos: number;
    },
    acertos: AcertoPlanejamento[],
  ): boolean {
    return acertos.some(
      (acerto) =>
        acerto.deParticipanteId === sugestao.devedorParticipanteId &&
        acerto.paraParticipanteId === sugestao.recebedorParticipanteId &&
        acerto.valorCentavos === sugestao.valorCentavos,
    );
  }

  private assertParticipanteIdAtivo(
    participantesPorId: Map<string, ParticipantePlanejamento>,
    participanteId: string,
    code: string,
    message: string,
  ): void {
    if (participantesPorId.has(participanteId)) {
      return;
    }

    throw new ValidationAppException(code, message);
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
