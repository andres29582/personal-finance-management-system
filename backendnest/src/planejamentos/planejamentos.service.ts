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
  UpdateGastoPlanejamentoDto,
} from './dto';
import {
  calcularAcertosMinimos,
  calcularDivisaoIgualitaria,
  calcularResumoFinanceiroPlanejamento,
  participanteRepresentaProprietario,
} from './domain';
import {
  AcertoPlanejamentoCalculo,
  GastoPlanejamentoCalculo,
  PlanejamentoDominioError,
  SituacaoFinanceiraPlanejamento,
  StatusFinanceiroParticipante,
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

export type ResumoFinanceiroPlanejamento = {
  planejamentoId: string;
  statusOperacional: PlanejamentoStatus;
  situacaoFinanceira: SituacaoFinanceiraPlanejamento;
  totalGastosAtivosCentavos: number;
  obrigacaoResidualCentavos: number;
  participantes: Array<{
    participante: {
      id: string;
      nome: string;
      tipo: ParticipanteTipo;
      status: ParticipanteStatus;
    };
    totalPagoCentavos: number;
    totalDevidoCentavos: number;
    totalPagoEmAcertosCentavos: number;
    totalRecebidoEmAcertosCentavos: number;
    saldoBrutoCentavos: number;
    saldoAbertoCentavos: number;
    statusFinanceiro: StatusFinanceiroParticipante;
  }>;
};

type AcertosParaSalvar = Parameters<
  PlanejamentosRepository['salvarAcertos']
>[0];

type PlanoReconciliacaoAcertos = {
  pendentesPreservados: AcertoPlanejamento[];
  acertosObsoletos: AcertosParaSalvar;
  novosAcertos: AcertosParaSalvar;
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
    return this.planejamentosRepository.executarEmTransacao(
      async (repository) => {
        await this.buscarPlanejamentoAcessivelComRepository(
          repository,
          planejamentoId,
          usuarioId,
        );

        const planejamentoBloqueado =
          await repository.bloquearPlanejamentoParaAtualizacao(planejamentoId);

        if (!planejamentoBloqueado) {
          throw new ResourceNotFoundException(
            'PLANEJAMENTO_NOT_FOUND',
            'Planejamento nao encontrado.',
          );
        }

        const planejamentoAtualizado = await this.buscarPlanejamentoParaAcertos(
          repository,
          planejamentoId,
          usuarioId,
        );
        this.assertOperacaoAcertoPermitida(planejamentoAtualizado);
        const plano = this.criarPlanoReconciliacaoAcertos(
          planejamentoAtualizado,
        );

        if (!this.planoReconciliacaoTemMudancas(plano)) {
          return plano.pendentesPreservados;
        }

        return this.reconciliarAcertos(
          repository,
          planejamentoAtualizado,
          plano,
        );
      },
    );
  }

  private criarPlanoReconciliacaoAcertos(
    planejamento: Planejamento,
  ): PlanoReconciliacaoAcertos {
    const participantesFinanceiramenteRelevantes =
      this.listarParticipantesFinanceiramenteRelevantes(planejamento);
    const participantesPorId = this.mapearParticipantesPorId(
      participantesFinanceiramenteRelevantes,
    );
    const sugestoes = this.calcularAcertosPersistidos(
      planejamento,
      participantesFinanceiramenteRelevantes.map(
        (participante) => participante.id,
      ),
    );
    const acertosPendentesExistentes =
      this.filtrarAcertosPendentes(planejamento);
    const pendentesPorChave = this.agruparAcertosPendentesPorChave(
      acertosPendentesExistentes,
    );
    const pendentesPreservados: AcertoPlanejamento[] = [];
    const novosAcertos: AcertosParaSalvar = [];

    for (const sugestao of sugestoes) {
      this.assertParticipanteIdFinanceiramenteRelevante(
        participantesPorId,
        sugestao.devedorParticipanteId,
        'PLANEJAMENTO_ACERTO_DEVEDOR_INVALIDO',
        'O devedor do acerto precisa ser participante financeiramente relevante do planejamento.',
      );
      this.assertParticipanteIdFinanceiramenteRelevante(
        participantesPorId,
        sugestao.recebedorParticipanteId,
        'PLANEJAMENTO_ACERTO_RECEBEDOR_INVALIDO',
        'O recebedor do acerto precisa ser participante financeiramente relevante do planejamento.',
      );

      const chave = this.criarChaveAcerto(
        sugestao.devedorParticipanteId,
        sugestao.recebedorParticipanteId,
        sugestao.valorCentavos,
      );
      const pendenteEquivalente = pendentesPorChave.get(chave)?.shift();

      if (pendenteEquivalente) {
        pendentesPreservados.push(pendenteEquivalente);
        continue;
      }

      novosAcertos.push({
        id: randomUUID(),
        planejamentoId: planejamento.id,
        deParticipanteId: sugestao.devedorParticipanteId,
        paraParticipanteId: sugestao.recebedorParticipanteId,
        valorCentavos: sugestao.valorCentavos,
        status: AcertoStatus.PENDENTE,
        dataPagamento: null,
        observacao: null,
      });
    }

    const acertosObsoletos = [...pendentesPorChave.values()]
      .flat()
      .map((acerto) => ({
        ...acerto,
        status: AcertoStatus.CANCELADO,
        dataPagamento: null,
      }));

    return { pendentesPreservados, acertosObsoletos, novosAcertos };
  }

  private planoReconciliacaoTemMudancas(
    plano: PlanoReconciliacaoAcertos,
  ): boolean {
    return plano.acertosObsoletos.length > 0 || plano.novosAcertos.length > 0;
  }

  private async reconciliarAcertos(
    repository: PlanejamentosRepository,
    planejamento: Planejamento,
    plano = this.criarPlanoReconciliacaoAcertos(planejamento),
  ): Promise<AcertoPlanejamento[]> {
    if (plano.acertosObsoletos.length > 0) {
      await repository.salvarAcertos(plano.acertosObsoletos);
    }

    const acertosCriados =
      plano.novosAcertos.length > 0
        ? await repository.salvarAcertos(plano.novosAcertos)
        : [];

    return [...plano.pendentesPreservados, ...acertosCriados];
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

  async fechar(id: string, usuarioId: string): Promise<Planejamento> {
    return this.planejamentosRepository.executarEmTransacao(
      async (repository) => {
        const planejamentoInicial =
          await this.buscarPlanejamentoAcessivelComRepository(
            repository,
            id,
            usuarioId,
          );
        this.assertUsuarioProprietarioDoPlanejamento(
          planejamentoInicial,
          usuarioId,
        );

        const planejamentoBloqueado =
          await repository.bloquearPlanejamentoParaAtualizacao(id);

        if (!planejamentoBloqueado) {
          throw new ResourceNotFoundException(
            'PLANEJAMENTO_NOT_FOUND',
            'Planejamento nao encontrado.',
          );
        }

        const planejamento = await this.buscarPlanejamentoParaAcertos(
          repository,
          id,
          usuarioId,
        );
        this.assertUsuarioProprietarioDoPlanejamento(planejamento, usuarioId);
        this.assertPlanejamentoAbertoParaFechamento(planejamento);
        this.assertPlanejamentoSemGastosPendentesRevisao(planejamento);

        await this.reconciliarAcertos(repository, planejamento);
        await repository.salvarPlanejamento({
          id,
          status: PlanejamentoStatus.FECHADO,
        });

        return this.buscarPlanejamentoAcessivelComRepository(
          repository,
          id,
          usuarioId,
        );
      },
    );
  }

  async arquivar(
    planejamentoId: string,
    usuarioId: string,
  ): Promise<Planejamento> {
    return this.planejamentosRepository.executarEmTransacao(
      async (repository) => {
        const planejamentoInicial =
          await this.buscarPlanejamentoAcessivelComRepository(
            repository,
            planejamentoId,
            usuarioId,
          );
        this.assertUsuarioProprietarioDoPlanejamento(
          planejamentoInicial,
          usuarioId,
        );

        const planejamentoBloqueado =
          await repository.bloquearPlanejamentoParaAtualizacao(planejamentoId);

        if (!planejamentoBloqueado) {
          throw new ResourceNotFoundException(
            'PLANEJAMENTO_NOT_FOUND',
            'Planejamento nao encontrado.',
          );
        }

        const planejamento = await this.buscarPlanejamentoParaAcertos(
          repository,
          planejamentoId,
          usuarioId,
        );
        this.assertUsuarioProprietarioDoPlanejamento(planejamento, usuarioId);
        this.assertPlanejamentoFechadoParaArquivamento(planejamento);

        await this.reconciliarAcertos(repository, planejamento);

        const planejamentoReconciliado =
          await this.buscarPlanejamentoParaAcertos(
            repository,
            planejamentoId,
            usuarioId,
          );
        const participantesFinanceiramenteRelevantes =
          this.listarParticipantesFinanceiramenteRelevantes(
            planejamentoReconciliado,
          );
        const resumo = calcularResumoFinanceiroPlanejamento(
          participantesFinanceiramenteRelevantes.map(
            (participante) => participante.id,
          ),
          this.mapearGastosParaCalculo(planejamentoReconciliado),
          this.mapearAcertosParaCalculo(planejamentoReconciliado),
        );

        this.assertPlanejamentoQuitadoParaArquivamento(resumo);

        await repository.salvarPlanejamento({
          id: planejamentoId,
          status: PlanejamentoStatus.ARQUIVADO,
        });

        return this.buscarPlanejamentoAcessivelComRepository(
          repository,
          planejamentoId,
          usuarioId,
        );
      },
    );
  }

  async addParticipante(
    planejamentoId: string,
    usuarioId: string,
    dto: AddParticipantePlanejamentoDto,
  ): Promise<ParticipantePlanejamento> {
    return this.planejamentosRepository.executarEmTransacao(
      async (repository) => {
        const planejamentoInicial =
          await this.buscarPlanejamentoAcessivelComRepository(
            repository,
            planejamentoId,
            usuarioId,
          );
        this.assertUsuarioProprietarioDoPlanejamento(
          planejamentoInicial,
          usuarioId,
        );

        const planejamentoBloqueado =
          await repository.bloquearPlanejamentoParaAtualizacao(planejamentoId);

        if (!planejamentoBloqueado) {
          throw new ResourceNotFoundException(
            'PLANEJAMENTO_NOT_FOUND',
            'Planejamento nao encontrado.',
          );
        }

        const planejamento =
          await this.buscarPlanejamentoAcessivelComRepository(
            repository,
            planejamentoId,
            usuarioId,
          );
        this.assertUsuarioProprietarioDoPlanejamento(planejamento, usuarioId);
        this.assertPlanejamentoAbertoParaMutacaoEstrutural(planejamento);

        await this.assertParticipanteAtivoNaoDuplicadoComRepository(
          repository,
          planejamentoId,
          dto,
        );

        return repository.salvarParticipante({
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
      },
    );
  }

  async removerParticipante(
    planejamentoId: string,
    participanteId: string,
    usuarioId: string,
  ): Promise<ParticipantePlanejamento> {
    await this.planejamentosRepository.executarEmTransacao(
      async (repository) => {
        const planejamentoInicial =
          await this.buscarPlanejamentoAcessivelComRepository(
            repository,
            planejamentoId,
            usuarioId,
          );
        this.assertUsuarioProprietarioDoPlanejamento(
          planejamentoInicial,
          usuarioId,
        );

        const planejamentoBloqueado =
          await repository.bloquearPlanejamentoParaAtualizacao(planejamentoId);

        if (!planejamentoBloqueado) {
          throw new ResourceNotFoundException(
            'PLANEJAMENTO_NOT_FOUND',
            'Planejamento nao encontrado.',
          );
        }

        const planejamento =
          await this.buscarPlanejamentoAcessivelComRepository(
            repository,
            planejamentoId,
            usuarioId,
          );
        this.assertUsuarioProprietarioDoPlanejamento(planejamento, usuarioId);
        this.assertPlanejamentoAbertoParaMutacaoEstrutural(planejamento);

        const participante =
          await repository.buscarParticipantePorIdEPlanejamento(
            participanteId,
            planejamentoId,
          );

        if (!participante) {
          throw new ResourceNotFoundException(
            'PLANEJAMENTO_PARTICIPANTE_NOT_FOUND',
            'Participante do planejamento nao encontrado.',
          );
        }

        if (participante.status !== ParticipanteStatus.ATIVO) {
          throw new ValidationAppException(
            'PLANEJAMENTO_PARTICIPANTE_REMOVER_STATUS_INVALIDO',
            'Somente participante ativo pode ser removido.',
            { details: { statusAtual: participante.status } },
          );
        }

        if (participanteRepresentaProprietario(planejamento, participante)) {
          throw new ValidationAppException(
            'PLANEJAMENTO_PARTICIPANTE_PROPRIETARIO_NAO_REMOVIVEL',
            'O participante proprietario do planejamento nao pode ser removido.',
          );
        }

        await repository.salvarParticipante({
          id: participante.id,
          planejamentoId: participante.planejamentoId,
          status: ParticipanteStatus.REMOVIDO,
        });
      },
    );

    const participanteAtualizado =
      await this.planejamentosRepository.buscarParticipantePorIdEPlanejamento(
        participanteId,
        planejamentoId,
      );

    if (!participanteAtualizado) {
      throw new ResourceNotFoundException(
        'PLANEJAMENTO_PARTICIPANTE_NOT_FOUND',
        'Participante do planejamento nao encontrado.',
      );
    }

    return participanteAtualizado;
  }

  async createGasto(
    planejamentoId: string,
    usuarioId: string,
    dto: CreateGastoPlanejamentoDto,
  ): Promise<GastoPlanejamento> {
    const gasto = await this.planejamentosRepository.executarEmTransacao(
      async (repository) => {
        await this.buscarPlanejamentoAcessivelComRepository(
          repository,
          planejamentoId,
          usuarioId,
        );

        const planejamentoBloqueado =
          await repository.bloquearPlanejamentoParaAtualizacao(planejamentoId);

        if (!planejamentoBloqueado) {
          throw new ResourceNotFoundException(
            'PLANEJAMENTO_NOT_FOUND',
            'Planejamento nao encontrado.',
          );
        }

        const planejamento =
          await this.buscarPlanejamentoAcessivelComRepository(
            repository,
            planejamentoId,
            usuarioId,
          );
        this.assertPlanejamentoAbertoParaMutacaoEstrutural(planejamento);

        this.assertParticipantePertenceAoPlanejamento(
          planejamento,
          dto.pagoPorParticipanteId,
          'PLANEJAMENTO_PAGADOR_INVALIDO',
          'O pagador precisa ser participante ativo do planejamento.',
        );

        const divisoesCalculadas = this.calcularDivisoes(
          dto.valorCentavos,
          dto.participantesIds,
        );

        for (const divisao of divisoesCalculadas) {
          this.assertParticipantePertenceAoPlanejamento(
            planejamento,
            divisao.participanteId,
            'PLANEJAMENTO_DIVISAO_PARTICIPANTE_INVALIDO',
            'Todos os participantes da divisao precisam pertencer ao planejamento.',
          );
        }

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

        const planejamentoAtualizado = await this.buscarPlanejamentoParaAcertos(
          repository,
          planejamentoId,
          usuarioId,
        );

        await this.reconciliarAcertos(repository, planejamentoAtualizado);

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

  async atualizarGasto(
    planejamentoId: string,
    gastoId: string,
    usuarioId: string,
    dto: UpdateGastoPlanejamentoDto,
  ): Promise<GastoPlanejamento> {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new ValidationAppException(
        'PLANEJAMENTO_GASTO_ATUALIZACAO_VAZIA',
        'Informe ao menos um campo para atualizar o gasto.',
      );
    }

    await this.planejamentosRepository.executarEmTransacao(
      async (repository) => {
        const planejamentoInicial =
          await this.buscarPlanejamentoAcessivelComRepository(
            repository,
            planejamentoId,
            usuarioId,
          );
        this.assertUsuarioProprietarioDoPlanejamento(
          planejamentoInicial,
          usuarioId,
        );

        const planejamentoBloqueado =
          await repository.bloquearPlanejamentoParaAtualizacao(planejamentoId);

        if (!planejamentoBloqueado) {
          throw new ResourceNotFoundException(
            'PLANEJAMENTO_NOT_FOUND',
            'Planejamento nao encontrado.',
          );
        }

        const planejamento =
          await this.buscarPlanejamentoAcessivelComRepository(
            repository,
            planejamentoId,
            usuarioId,
          );
        this.assertUsuarioProprietarioDoPlanejamento(planejamento, usuarioId);
        this.assertPlanejamentoAbertoParaMutacaoEstrutural(planejamento);

        const gasto = await repository.buscarGastoPorIdEPlanejamento(
          gastoId,
          planejamentoId,
        );

        if (!gasto) {
          throw new ResourceNotFoundException(
            'PLANEJAMENTO_GASTO_NOT_FOUND',
            'Gasto do planejamento nao encontrado.',
          );
        }

        if (gasto.status !== GastoStatus.ATIVO) {
          throw new ValidationAppException(
            'PLANEJAMENTO_GASTO_ATUALIZAR_STATUS_INVALIDO',
            'Apenas gastos ativos podem ser atualizados.',
            { details: { statusAtual: gasto.status } },
          );
        }

        const divisoesAtivas = (gasto.divisoes ?? []).filter(
          (divisao) => divisao.status === DivisaoStatus.ATIVA,
        );
        const participantesAtuaisIds = divisoesAtivas
          .map((divisao) => divisao.participanteId)
          .sort((a, b) => a.localeCompare(b));
        const valorCentavos =
          dto.valorCentavos !== undefined
            ? dto.valorCentavos
            : gasto.valorCentavos;
        const pagoPorParticipanteId =
          dto.pagoPorParticipanteId !== undefined
            ? dto.pagoPorParticipanteId
            : gasto.pagoPorParticipanteId;
        const participantesIds = dto.participantesIds ?? participantesAtuaisIds;

        if (dto.participantesIds !== undefined) {
          this.calcularDivisoes(valorCentavos, dto.participantesIds);
        }

        const participantesEfetivosIds = [...participantesIds].sort((a, b) =>
          a.localeCompare(b),
        );
        const valorAlterado = valorCentavos !== gasto.valorCentavos;
        const pagadorAlterado =
          pagoPorParticipanteId !== gasto.pagoPorParticipanteId;
        const participantesAlterados =
          dto.participantesIds !== undefined &&
          !this.conjuntosIguais(participantesAtuaisIds, dto.participantesIds);
        const divisoesAlteradas = valorAlterado || participantesAlterados;
        const alteracaoFinanceira = divisoesAlteradas || pagadorAlterado;

        if (
          alteracaoFinanceira &&
          dto.participantesIds === undefined &&
          participantesAtuaisIds.length === 0
        ) {
          throw new ValidationAppException(
            'PLANEJAMENTO_GASTO_DIVISOES_ATIVAS_OBRIGATORIAS',
            'O gasto precisa ter divisoes ativas para a atualizacao financeira.',
          );
        }

        if (pagadorAlterado) {
          this.assertParticipantePertenceAoPlanejamento(
            planejamento,
            pagoPorParticipanteId,
            'PLANEJAMENTO_PAGADOR_INVALIDO',
            'O pagador precisa ser participante ativo do planejamento.',
          );
        }

        const participantesAtuaisSet = new Set(participantesAtuaisIds);
        const participantesNovosIds = participantesAlterados
          ? participantesEfetivosIds.filter(
              (participanteId) => !participantesAtuaisSet.has(participanteId),
            )
          : [];

        for (const participanteId of participantesNovosIds) {
          this.assertParticipantePertenceAoPlanejamento(
            planejamento,
            participanteId,
            'PLANEJAMENTO_DIVISAO_PARTICIPANTE_INVALIDO',
            'Todos os participantes da divisao precisam pertencer ao planejamento.',
          );
        }

        const descricao =
          dto.descricao !== undefined ? dto.descricao : gasto.descricao;
        const dataGasto =
          dto.dataGasto !== undefined ? dto.dataGasto : gasto.dataGasto;
        const comportamento =
          dto.comportamento !== undefined
            ? dto.comportamento
            : gasto.comportamento;
        const categoria =
          dto.categoria !== undefined ? dto.categoria : gasto.categoria;
        const observacao =
          dto.observacao !== undefined ? dto.observacao : gasto.observacao;
        const mesReferencia =
          dto.mesReferencia !== undefined
            ? dto.mesReferencia
            : gasto.mesReferencia;
        const alteracaoDescritiva =
          descricao !== gasto.descricao ||
          dataGasto !== gasto.dataGasto ||
          comportamento !== gasto.comportamento ||
          categoria !== gasto.categoria ||
          observacao !== gasto.observacao ||
          mesReferencia !== gasto.mesReferencia;

        if (!alteracaoFinanceira && !alteracaoDescritiva) {
          return gasto.id;
        }

        const gastoSalvo = await repository.salvarGasto({
          id: gasto.id,
          descricao,
          valorCentavos,
          dataGasto,
          categoria,
          comportamento,
          pagoPorParticipanteId,
          observacao,
          mesReferencia,
          ultimaAlteracaoValorEm: valorAlterado
            ? new Date()
            : gasto.ultimaAlteracaoValorEm,
        });

        if (!alteracaoFinanceira) {
          return gastoSalvo.id;
        }

        if (divisoesAlteradas) {
          const divisoesCalculadas = this.calcularDivisoes(
            valorCentavos,
            participantesEfetivosIds,
          );

          await repository.salvarDivisoes([
            ...divisoesAtivas.map((divisao) => ({
              ...divisao,
              status: DivisaoStatus.CANCELADA,
            })),
            ...divisoesCalculadas.map((divisao) => ({
              id: randomUUID(),
              gastoId,
              participanteId: divisao.participanteId,
              valorDevidoCentavos: divisao.valorCentavos,
              status: DivisaoStatus.ATIVA,
            })),
          ]);
        }

        const planejamentoAtualizado = await this.buscarPlanejamentoParaAcertos(
          repository,
          planejamentoId,
          usuarioId,
        );
        await this.reconciliarAcertos(repository, planejamentoAtualizado);

        return gastoSalvo.id;
      },
    );

    return this.findGasto(planejamentoId, gastoId, usuarioId);
  }

  async cancelarGasto(
    planejamentoId: string,
    gastoId: string,
    usuarioId: string,
  ): Promise<GastoPlanejamento> {
    const gastoCancelado =
      await this.planejamentosRepository.executarEmTransacao(
        async (repository) => {
          const planejamentoInicial =
            await this.buscarPlanejamentoAcessivelComRepository(
              repository,
              planejamentoId,
              usuarioId,
            );
          this.assertUsuarioProprietarioDoPlanejamento(
            planejamentoInicial,
            usuarioId,
          );

          const planejamentoBloqueado =
            await repository.bloquearPlanejamentoParaAtualizacao(
              planejamentoId,
            );

          if (!planejamentoBloqueado) {
            throw new ResourceNotFoundException(
              'PLANEJAMENTO_NOT_FOUND',
              'Planejamento nao encontrado.',
            );
          }

          const planejamento =
            await this.buscarPlanejamentoAcessivelComRepository(
              repository,
              planejamentoId,
              usuarioId,
            );
          this.assertUsuarioProprietarioDoPlanejamento(planejamento, usuarioId);
          this.assertPlanejamentoAbertoParaMutacaoEstrutural(planejamento);

          const gasto = await repository.buscarGastoPorIdEPlanejamento(
            gastoId,
            planejamentoId,
          );

          if (!gasto) {
            throw new ResourceNotFoundException(
              'PLANEJAMENTO_GASTO_NOT_FOUND',
              'Gasto do planejamento nao encontrado.',
            );
          }

          if (gasto.status !== GastoStatus.ATIVO) {
            throw new ValidationAppException(
              'PLANEJAMENTO_GASTO_CANCELAR_STATUS_INVALIDO',
              'Apenas gastos ativos podem ser cancelados.',
              { details: { statusAtual: gasto.status } },
            );
          }

          const gastoSalvo = await repository.salvarGasto({
            ...gasto,
            status: GastoStatus.CANCELADO,
          });
          const divisoesAtivas = (gasto.divisoes ?? []).filter(
            (divisao) => divisao.status === DivisaoStatus.ATIVA,
          );

          if (divisoesAtivas.length > 0) {
            await repository.salvarDivisoes(
              divisoesAtivas.map((divisao) => ({
                ...divisao,
                status: DivisaoStatus.CANCELADA,
              })),
            );
          }

          const planejamentoAtualizado =
            await this.buscarPlanejamentoParaAcertos(
              repository,
              planejamentoId,
              usuarioId,
            );

          await this.reconciliarAcertos(repository, planejamentoAtualizado);

          return gastoSalvo;
        },
      );

    return this.findGasto(planejamentoId, gastoCancelado.id, usuarioId);
  }

  async findAcertos(
    planejamentoId: string,
    usuarioId: string,
  ): Promise<AcertoPlanejamentoSugerido[]> {
    const planejamento = await this.buscarPlanejamentoParaAcertos(
      this.planejamentosRepository,
      planejamentoId,
      usuarioId,
    );
    const participantesFinanceiramenteRelevantes =
      this.listarParticipantesFinanceiramenteRelevantes(planejamento);
    const participantesPorId = this.mapearParticipantesPorId(
      participantesFinanceiramenteRelevantes,
    );
    const acertos = this.calcularAcertosPersistidos(
      planejamento,
      participantesFinanceiramenteRelevantes.map(
        (participante) => participante.id,
      ),
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

  async findResumo(
    planejamentoId: string,
    usuarioId: string,
  ): Promise<ResumoFinanceiroPlanejamento> {
    const planejamento = await this.buscarPlanejamentoParaAcertos(
      this.planejamentosRepository,
      planejamentoId,
      usuarioId,
    );
    const participantesFinanceiramenteRelevantes =
      this.listarParticipantesFinanceiramenteRelevantes(planejamento);
    const participantesPorId = this.mapearParticipantesPorId(
      participantesFinanceiramenteRelevantes,
    );
    const resumo = calcularResumoFinanceiroPlanejamento(
      participantesFinanceiramenteRelevantes.map(
        (participante) => participante.id,
      ),
      this.mapearGastosParaCalculo(planejamento),
      this.mapearAcertosParaCalculo(planejamento),
    );

    return {
      planejamentoId: planejamento.id,
      statusOperacional: planejamento.status,
      situacaoFinanceira: resumo.situacaoFinanceira,
      totalGastosAtivosCentavos: resumo.totalGastosAtivosCentavos,
      obrigacaoResidualCentavos: resumo.obrigacaoResidualCentavos,
      participantes: resumo.participantes.map(
        ({ participanteId, ...saldo }) => {
          const participante = participantesPorId.get(participanteId)!;

          return {
            participante: {
              id: participante.id,
              nome: participante.nome,
              tipo: participante.tipo,
              status: participante.status,
            },
            ...saldo,
          };
        },
      ),
    };
  }

  async pagarAcerto(
    planejamentoId: string,
    acertoId: string,
    usuarioId: string,
  ): Promise<AcertoPlanejamento> {
    return this.planejamentosRepository.executarEmTransacao(
      async (repository) => {
        const { planejamento, acerto } =
          await this.buscarContextoAcertoBloqueadoComRepository(
            repository,
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

        const acertoPago = await repository.salvarAcerto({
          ...acerto,
          status: AcertoStatus.PAGO,
          dataPagamento: new Date(),
        });
        const planejamentoAtualizado = await this.buscarPlanejamentoParaAcertos(
          repository,
          planejamentoId,
          usuarioId,
        );

        await this.reconciliarAcertos(repository, planejamentoAtualizado);

        return acertoPago;
      },
    );
  }

  async cancelarAcerto(
    planejamentoId: string,
    acertoId: string,
    usuarioId: string,
  ): Promise<AcertoPlanejamento> {
    return this.planejamentosRepository.executarEmTransacao(
      async (repository) => {
        const { planejamento, acerto } =
          await this.buscarContextoAcertoBloqueadoComRepository(
            repository,
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

        const acertoCancelado = await repository.salvarAcerto({
          ...acerto,
          status: AcertoStatus.CANCELADO,
          dataPagamento: null,
        });
        const planejamentoAtualizado = await this.buscarPlanejamentoParaAcertos(
          repository,
          planejamentoId,
          usuarioId,
        );

        await this.reconciliarAcertos(repository, planejamentoAtualizado);

        return acertoCancelado;
      },
    );
  }

  async reabrirAcerto(
    planejamentoId: string,
    acertoId: string,
    usuarioId: string,
  ): Promise<AcertoPlanejamento> {
    return this.planejamentosRepository.executarEmTransacao(
      async (repository) => {
        const { planejamento, acerto } =
          await this.buscarContextoAcertoBloqueadoComRepository(
            repository,
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

        const planejamentoCompleto = await this.buscarPlanejamentoParaAcertos(
          repository,
          planejamentoId,
          usuarioId,
        );
        const chaveAcerto = this.criarChaveAcerto(
          acerto.deParticipanteId,
          acerto.paraParticipanteId,
          acerto.valorCentavos,
        );
        const sugestaoEquivalente = this.calcularSugestoesAtuais(
          planejamentoCompleto,
        ).some(
          (sugestao) =>
            this.criarChaveAcerto(
              sugestao.devedorParticipanteId,
              sugestao.recebedorParticipanteId,
              sugestao.valorCentavos,
            ) === chaveAcerto,
        );

        if (!sugestaoEquivalente) {
          throw new ValidationAppException(
            'PLANEJAMENTO_ACERTO_REABRIR_OBSOLETO',
            'O acerto cancelado nao corresponde a uma pendencia atual do planejamento.',
          );
        }

        const pendenteEquivalente = this.filtrarAcertosPendentes(
          planejamentoCompleto,
        ).find(
          (acertoPendente) =>
            acertoPendente.id !== acerto.id &&
            this.criarChaveAcerto(
              acertoPendente.deParticipanteId,
              acertoPendente.paraParticipanteId,
              acertoPendente.valorCentavos,
            ) === chaveAcerto,
        );

        if (pendenteEquivalente) {
          await repository.salvarAcerto({
            ...pendenteEquivalente,
            status: AcertoStatus.CANCELADO,
            dataPagamento: null,
          });
        }

        const acertoReaberto = await repository.salvarAcerto({
          ...acerto,
          status: AcertoStatus.PENDENTE,
          dataPagamento: null,
        });
        const planejamentoAtualizado = await this.buscarPlanejamentoParaAcertos(
          repository,
          planejamentoId,
          usuarioId,
        );

        await this.reconciliarAcertos(repository, planejamentoAtualizado);

        return acertoReaberto;
      },
    );
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

  private async assertParticipanteAtivoNaoDuplicadoComRepository(
    repository: PlanejamentosRepository,
    planejamentoId: string,
    dto: AddParticipantePlanejamentoDto,
  ): Promise<void> {
    const participanteExistente =
      await repository.buscarParticipanteAtivoDuplicado(planejamentoId, {
        usuarioId: dto.usuarioId,
        email: dto.email,
        nome: dto.nome,
      });

    if (!participanteExistente) {
      return;
    }

    throw new AppConflictException(
      'PLANEJAMENTO_PARTICIPANTE_DUPLICADO',
      'Ja existe um participante ativo com estes dados no planejamento.',
    );
  }

  private calcularDivisoes(valorCentavos: number, participantesIds: string[]) {
    try {
      return calcularDivisaoIgualitaria(valorCentavos, participantesIds);
    } catch (error) {
      if (error instanceof PlanejamentoDominioError) {
        throw new ValidationAppException(error.code, error.message);
      }

      throw error;
    }
  }

  private conjuntosIguais(primeiro: string[], segundo: string[]): boolean {
    if (primeiro.length !== segundo.length) {
      return false;
    }

    const primeiroConjunto = new Set(primeiro);
    const segundoConjunto = new Set(segundo);

    return (
      primeiroConjunto.size === segundoConjunto.size &&
      [...primeiroConjunto].every((item) => segundoConjunto.has(item))
    );
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
    repository: PlanejamentosRepository,
    planejamentoId: string,
    usuarioId: string,
  ): Promise<Planejamento> {
    const planejamento = await repository.buscarComGastosDivisoesAcertos(
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

  private async buscarPlanejamentoAcessivelComRepository(
    repository: PlanejamentosRepository,
    planejamentoId: string,
    usuarioId: string,
  ): Promise<Planejamento> {
    const planejamento = await repository.buscarAcessivelComParticipantes(
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

  private async buscarContextoAcertoBloqueadoComRepository(
    repository: PlanejamentosRepository,
    planejamentoId: string,
    acertoId: string,
    usuarioId: string,
  ): Promise<{ planejamento: Planejamento; acerto: AcertoPlanejamento }> {
    await this.buscarPlanejamentoAcessivelComRepository(
      repository,
      planejamentoId,
      usuarioId,
    );

    const planejamentoBloqueado =
      await repository.bloquearPlanejamentoParaAtualizacao(planejamentoId);

    if (!planejamentoBloqueado) {
      throw new ResourceNotFoundException(
        'PLANEJAMENTO_NOT_FOUND',
        'Planejamento nao encontrado.',
      );
    }

    const planejamento = await this.buscarPlanejamentoAcessivelComRepository(
      repository,
      planejamentoId,
      usuarioId,
    );
    this.assertOperacaoAcertoPermitida(planejamento);

    const acerto = await repository.buscarAcertoPorIdEPlanejamento(
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

  private calcularSugestoesAtuais(planejamento: Planejamento) {
    const participantesFinanceiramenteRelevantes =
      this.listarParticipantesFinanceiramenteRelevantes(planejamento);

    return this.calcularAcertosPersistidos(
      planejamento,
      participantesFinanceiramenteRelevantes.map(
        (participante) => participante.id,
      ),
    );
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

  private assertPlanejamentoAbertoParaFechamento(
    planejamento: Planejamento,
  ): void {
    if (planejamento.status === PlanejamentoStatus.ABERTO) {
      return;
    }

    throw new ValidationAppException(
      'PLANEJAMENTO_FECHAR_STATUS_INVALIDO',
      'Somente planejamento aberto pode ser fechado.',
      { details: { statusAtual: planejamento.status } },
    );
  }

  private assertPlanejamentoAbertoParaMutacaoEstrutural(
    planejamento: Planejamento,
  ): void {
    if (planejamento.status === PlanejamentoStatus.ABERTO) {
      return;
    }

    throw new ValidationAppException(
      'PLANEJAMENTO_MUTACAO_ESTRUTURAL_STATUS_INVALIDO',
      'Somente planejamentos abertos podem sofrer alteracoes estruturais.',
      { details: { statusAtual: planejamento.status } },
    );
  }

  private assertPlanejamentoFechadoParaArquivamento(
    planejamento: Planejamento,
  ): void {
    if (planejamento.status === PlanejamentoStatus.FECHADO) {
      return;
    }

    throw new ValidationAppException(
      'PLANEJAMENTO_ARQUIVAR_STATUS_INVALIDO',
      'Somente planejamento fechado pode ser arquivado.',
      { details: { statusAtual: planejamento.status } },
    );
  }

  private assertPlanejamentoQuitadoParaArquivamento(
    resumo: Pick<
      ResumoFinanceiroPlanejamento,
      'situacaoFinanceira' | 'obrigacaoResidualCentavos'
    >,
  ): void {
    if (resumo.situacaoFinanceira === 'QUITADO') {
      return;
    }

    throw new ValidationAppException(
      'PLANEJAMENTO_ARQUIVAR_PENDENCIA_FINANCEIRA',
      'Somente planejamento financeiramente quitado pode ser arquivado.',
      {
        details: {
          situacaoFinanceira: resumo.situacaoFinanceira,
          obrigacaoResidualCentavos: resumo.obrigacaoResidualCentavos,
        },
      },
    );
  }

  private assertOperacaoAcertoPermitida(planejamento: Planejamento): void {
    if (
      planejamento.status === PlanejamentoStatus.ABERTO ||
      planejamento.status === PlanejamentoStatus.FECHADO
    ) {
      return;
    }

    throw new ValidationAppException(
      'PLANEJAMENTO_ACERTO_OPERACAO_STATUS_INVALIDO',
      'Operacoes de acerto sao permitidas apenas em planejamentos abertos ou fechados.',
      { details: { statusAtual: planejamento.status } },
    );
  }

  private assertPlanejamentoSemGastosPendentesRevisao(
    planejamento: Planejamento,
  ): void {
    const possuiGastoPendenteRevisao = (planejamento.gastos ?? []).some(
      (gasto) =>
        gasto.status === GastoStatus.PENDENTE_REVISAO && !gasto.deletedAt,
    );

    if (!possuiGastoPendenteRevisao) {
      return;
    }

    throw new ValidationAppException(
      'PLANEJAMENTO_FECHAR_GASTO_PENDENTE_REVISAO',
      'Planejamento com gasto pendente de revisao nao pode ser fechado.',
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

  private listarParticipantesFinanceiramenteRelevantes(
    planejamento: Planejamento,
  ): ParticipantePlanejamento[] {
    const participantesRelevantesIds = new Set(
      this.listarParticipantesAtivos(planejamento).map(
        (participante) => participante.id,
      ),
    );

    for (const gasto of planejamento.gastos ?? []) {
      if (gasto.status !== GastoStatus.ATIVO || gasto.deletedAt) {
        continue;
      }

      participantesRelevantesIds.add(gasto.pagoPorParticipanteId);

      for (const divisao of gasto.divisoes ?? []) {
        if (divisao.status === DivisaoStatus.ATIVA) {
          participantesRelevantesIds.add(divisao.participanteId);
        }
      }
    }

    for (const acerto of planejamento.acertos ?? []) {
      if (
        acerto.status !== AcertoStatus.PAGO &&
        acerto.status !== AcertoStatus.CONFIRMADO
      ) {
        continue;
      }

      participantesRelevantesIds.add(acerto.deParticipanteId);
      participantesRelevantesIds.add(acerto.paraParticipanteId);
    }

    const participantesAdicionadosIds = new Set<string>();

    return (planejamento.participantes ?? []).filter((participante) => {
      if (
        !participantesRelevantesIds.has(participante.id) ||
        participantesAdicionadosIds.has(participante.id)
      ) {
        return false;
      }

      participantesAdicionadosIds.add(participante.id);
      return true;
    });
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

  private agruparAcertosPendentesPorChave(
    acertos: AcertoPlanejamento[],
  ): Map<string, AcertoPlanejamento[]> {
    const acertosPorChave = new Map<string, AcertoPlanejamento[]>();

    for (const acerto of acertos) {
      const chave = this.criarChaveAcerto(
        acerto.deParticipanteId,
        acerto.paraParticipanteId,
        acerto.valorCentavos,
      );
      const acertosDaChave = acertosPorChave.get(chave) ?? [];

      acertosDaChave.push(acerto);
      acertosPorChave.set(chave, acertosDaChave);
    }

    return acertosPorChave;
  }

  private criarChaveAcerto(
    devedorParticipanteId: string,
    recebedorParticipanteId: string,
    valorCentavos: number,
  ): string {
    return `${devedorParticipanteId}:${recebedorParticipanteId}:${valorCentavos}`;
  }

  private assertParticipanteIdFinanceiramenteRelevante(
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
