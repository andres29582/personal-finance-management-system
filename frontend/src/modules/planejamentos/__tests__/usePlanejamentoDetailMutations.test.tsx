import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  act,
  renderHook,
  waitFor,
} from '@testing-library/react-native';
import * as authStorage from '../../../../storage/authStorage';
import { confirmAction } from '../../../../utils/confirm-action';
import {
  UsePlanejamentoDetailMutationsOptions,
  usePlanejamentoDetailMutations,
} from '../hooks/usePlanejamentoDetailMutations';
import * as planejamentoService from '../services/planejamentoService';
import {
  AcertoPlanejamento,
  GastoPlanejamento,
  ParticipantePlanejamento,
  Planejamento,
  ResumoFinanceiroPlanejamento,
} from '../types/planejamento';

jest.mock('../services/planejamentoService');
jest.mock('../../../../storage/authStorage');
jest.mock('../../../../utils/confirm-action');

const mockedPlanejamentoService = jest.mocked(planejamentoService);
const mockClearSession = jest.mocked(authStorage.clearSession);
const mockConfirmAction = jest.mocked(confirmAction);

const PLANEJAMENTO_ID = 'planejamento-1';
const OWNER_ID = 'usuario-1';
const LINKED_USER_ID = 'usuario-2';

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve: Deferred<T>['resolve'] = () => undefined;
  let reject: Deferred<T>['reject'] = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function makeParticipante(
  overrides: Partial<ParticipantePlanejamento> = {},
): ParticipantePlanejamento {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    email: 'bruno@example.com',
    id: 'participante-2',
    nome: 'Bruno',
    planejamentoId: PLANEJAMENTO_ID,
    status: 'ATIVO',
    tipo: 'MANUAL',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioId: null,
    ...overrides,
  };
}

function makeOwnerParticipante(): ParticipantePlanejamento {
  return makeParticipante({
    email: 'ana@example.com',
    id: 'participante-1',
    nome: 'Ana',
    tipo: 'VINCULADO',
    usuarioId: OWNER_ID,
  });
}

function makeLinkedParticipante(
  overrides: Partial<ParticipantePlanejamento> = {},
): ParticipantePlanejamento {
  return makeParticipante({
    id: 'participante-2',
    tipo: 'VINCULADO',
    usuarioId: LINKED_USER_ID,
    ...overrides,
  });
}

function makePlanejamento(
  overrides: Partial<Planejamento> = {},
): Planejamento {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    dataFim: '2026-01-20',
    dataInicio: '2026-01-10',
    deletedAt: null,
    descricao: 'Custos compartilhados',
    id: PLANEJAMENTO_ID,
    nome: 'Viagem de ferias',
    participantes: [makeOwnerParticipante(), makeParticipante()],
    status: 'ABERTO',
    tipo: 'VIAGEM',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioCriadorId: OWNER_ID,
    ...overrides,
  };
}

function makePlanejamentoComVinculado(
  overrides: Partial<Planejamento> = {},
): Planejamento {
  return makePlanejamento({
    participantes: [makeOwnerParticipante(), makeLinkedParticipante()],
    ...overrides,
  });
}

function makeResumo(
  overrides: Partial<ResumoFinanceiroPlanejamento> = {},
): ResumoFinanceiroPlanejamento {
  return {
    obrigacaoResidualCentavos: 0,
    participantes: [],
    planejamentoId: PLANEJAMENTO_ID,
    situacaoFinanceira: 'QUITADO',
    statusOperacional: 'ABERTO',
    totalGastosAtivosCentavos: 0,
    ...overrides,
  };
}

function makeGasto(
  overrides: Partial<GastoPlanejamento> = {},
): GastoPlanejamento {
  return {
    categoria: 'Hospedagem',
    comportamento: 'EVENTUAL',
    comprovanteNome: null,
    comprovanteUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    dataGasto: '2026-01-12',
    deletedAt: null,
    descricao: 'Hotel',
    divisoes: [],
    id: 'gasto-1',
    mesReferencia: null,
    observacao: null,
    pagoPorParticipanteId: 'participante-1',
    planejamentoId: PLANEJAMENTO_ID,
    requerRevisaoMensal: false,
    status: 'ATIVO',
    ultimaAlteracaoValorEm: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    valorCentavos: 12345,
    ...overrides,
  };
}

function makeAcerto(
  overrides: Partial<AcertoPlanejamento> = {},
): AcertoPlanejamento {
  return {
    dataPagamento: null,
    deParticipante: {
      id: 'participante-2',
      nome: 'Bruno',
    },
    deParticipanteId: 'participante-2',
    id: 'acerto-1',
    observacao: null,
    paraParticipante: {
      id: 'participante-1',
      nome: 'Ana',
    },
    paraParticipanteId: 'participante-1',
    status: 'PENDENTE',
    valorCentavos: 5000,
    ...overrides,
  };
}

function createHookOptions(
  overrides: Partial<UsePlanejamentoDetailMutationsOptions> = {},
): UsePlanejamentoDetailMutationsOptions {
  const planejamentoId = overrides.planejamentoId ?? PLANEJAMENTO_ID;

  return {
    applyParticipantUpdate:
      jest.fn<
        UsePlanejamentoDetailMutationsOptions['applyParticipantUpdate']
      >(),
    isCurrentContext:
      jest.fn<
        UsePlanejamentoDetailMutationsOptions['isCurrentContext']
      >((expectedPlanejamentoId) => expectedPlanejamentoId === planejamentoId),
    onUnauthorized:
      jest.fn<UsePlanejamentoDetailMutationsOptions['onUnauthorized']>(),
    planejamento: makePlanejamento(),
    planejamentoId,
    refreshExpenseFinancialData:
      jest
        .fn<
          UsePlanejamentoDetailMutationsOptions['refreshExpenseFinancialData']
        >()
        .mockResolvedValue(true),
    refreshFinancialData:
      jest
        .fn<
          UsePlanejamentoDetailMutationsOptions['refreshFinancialData']
        >()
        .mockResolvedValue(true),
    reloadAllData:
      jest
        .fn<UsePlanejamentoDetailMutationsOptions['reloadAllData']>()
        .mockResolvedValue(true),
    resumo: makeResumo(),
    usuarioAutenticadoId: OWNER_ID,
    ...overrides,
  };
}

function renderMutationsHook(
  overrides: Partial<UsePlanejamentoDetailMutationsOptions> = {},
) {
  const options = createHookOptions(overrides);
  const rendered = renderHook(
    (props: UsePlanejamentoDetailMutationsOptions) =>
      usePlanejamentoDetailMutations(props),
    { initialProps: options },
  );

  return { ...rendered, options };
}

async function runMutation(mutation: () => Promise<void>) {
  await act(async () => {
    await mutation();
  });
}

describe('usePlanejamentoDetailMutations', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockClearSession.mockResolvedValue(undefined);
    mockConfirmAction.mockResolvedValue(true);
    mockedPlanejamentoService.syncAcertosPlanejamento.mockResolvedValue([]);
    mockedPlanejamentoService.payAcertoPlanejamento.mockResolvedValue(
      makeAcerto({ status: 'PAGO' }),
    );
    mockedPlanejamentoService.cancelAcertoPlanejamento.mockResolvedValue(
      makeAcerto({ status: 'CANCELADO' }),
    );
    mockedPlanejamentoService.reopenAcertoPlanejamento.mockResolvedValue(
      makeAcerto({ status: 'PENDENTE' }),
    );
    mockedPlanejamentoService.cancelGastoPlanejamento.mockResolvedValue(
      makeGasto({ status: 'CANCELADO' }),
    );
    mockedPlanejamentoService.removeParticipantePlanejamento.mockResolvedValue(
      makeParticipante({ status: 'REMOVIDO' }),
    );
    mockedPlanejamentoService.fecharPlanejamento.mockResolvedValue(
      makePlanejamento({ status: 'FECHADO' }),
    );
    mockedPlanejamentoService.arquivarPlanejamento.mockResolvedValue(
      makePlanejamento({ status: 'ARQUIVADO' }),
    );
    mockedPlanejamentoService.cancelarPlanejamento.mockResolvedValue(
      makePlanejamento({ status: 'CANCELADO' }),
    );
  });

  describe('permissoes derivadas', () => {
    it('permite ao proprietario todas as acoes compativeis com planejamento ABERTO', () => {
      const participante = makeParticipante();
      const gasto = makeGasto();
      const acertoPendente = makeAcerto();
      const acertoPago = makeAcerto({ status: 'PAGO' });
      const { result } = renderMutationsHook();

      expect(result.current.canAddParticipant).toBe(true);
      expect(result.current.canRemoveParticipant(participante)).toBe(true);
      expect(
        result.current.canRemoveParticipant(makeOwnerParticipante()),
      ).toBe(false);
      expect(result.current.canCreateExpense).toBe(true);
      expect(result.current.canEditExpense(gasto)).toBe(true);
      expect(result.current.canCancelExpense(gasto)).toBe(true);
      expect(result.current.canManageLifecycle).toBe(true);
      expect(result.current.canSyncSettlements).toBe(true);
      expect(
        result.current.canPerformSettlementAction(acertoPendente, 'pay'),
      ).toBe(true);
      expect(
        result.current.canPerformSettlementAction(acertoPendente, 'cancel'),
      ).toBe(true);
      expect(
        result.current.canPerformSettlementAction(acertoPago, 'cancel'),
      ).toBe(true);
      expect(
        result.current.canPerformSettlementAction(acertoPago, 'reopen'),
      ).toBe(true);
      expect(result.current.isReadOnly).toBe(false);
      expect(result.current.isFinanciallySettled).toBe(true);
      expect(result.current.canNavigateToAddParticipant()).toBe(true);
      expect(result.current.canNavigateToCreateExpense()).toBe(true);
      expect(result.current.canNavigateToEditExpense(gasto)).toBe(true);
    });

    it('mantem somente lifecycle e acertos do proprietario em planejamento FECHADO', () => {
      const participante = makeParticipante();
      const gasto = makeGasto();
      const acerto = makeAcerto();
      const { result } = renderMutationsHook({
        planejamento: makePlanejamento({ status: 'FECHADO' }),
        resumo: makeResumo({
          situacaoFinanceira: 'PENDENTE',
          statusOperacional: 'FECHADO',
        }),
      });

      expect(result.current.canAddParticipant).toBe(false);
      expect(result.current.canRemoveParticipant(participante)).toBe(false);
      expect(result.current.canCreateExpense).toBe(false);
      expect(result.current.canEditExpense(gasto)).toBe(false);
      expect(result.current.canCancelExpense(gasto)).toBe(false);
      expect(result.current.canManageLifecycle).toBe(true);
      expect(result.current.canSyncSettlements).toBe(true);
      expect(
        result.current.canPerformSettlementAction(acerto, 'pay'),
      ).toBe(true);
      expect(result.current.isReadOnly).toBe(false);
      expect(result.current.isFinanciallySettled).toBe(false);
      expect(result.current.canNavigateToAddParticipant()).toBe(false);
      expect(result.current.canNavigateToCreateExpense()).toBe(false);
      expect(result.current.canNavigateToEditExpense(gasto)).toBe(false);
    });

    it('torna planejamento ARQUIVADO somente leitura', () => {
      const participante = makeParticipante();
      const gasto = makeGasto();
      const acerto = makeAcerto();
      const { result } = renderMutationsHook({
        planejamento: makePlanejamento({ status: 'ARQUIVADO' }),
        resumo: makeResumo({ statusOperacional: 'ARQUIVADO' }),
      });

      expect(result.current.canAddParticipant).toBe(false);
      expect(result.current.canRemoveParticipant(participante)).toBe(false);
      expect(result.current.canCreateExpense).toBe(false);
      expect(result.current.canEditExpense(gasto)).toBe(false);
      expect(result.current.canCancelExpense(gasto)).toBe(false);
      expect(result.current.canManageLifecycle).toBe(false);
      expect(result.current.canSyncSettlements).toBe(false);
      expect(
        result.current.canPerformSettlementAction(acerto, 'pay'),
      ).toBe(false);
      expect(result.current.isReadOnly).toBe(true);
      expect(result.current.canNavigateToAddParticipant()).toBe(false);
      expect(result.current.canNavigateToCreateExpense()).toBe(false);
      expect(result.current.canNavigateToEditExpense(gasto)).toBe(false);
    });

    it('torna planejamento CANCELADO somente leitura', () => {
      const participante = makeParticipante();
      const gasto = makeGasto();
      const acerto = makeAcerto();
      const { result } = renderMutationsHook({
        planejamento: makePlanejamento({ status: 'CANCELADO' }),
        resumo: makeResumo({ statusOperacional: 'CANCELADO' }),
      });

      expect(result.current.canAddParticipant).toBe(false);
      expect(result.current.canRemoveParticipant(participante)).toBe(false);
      expect(result.current.canCreateExpense).toBe(false);
      expect(result.current.canEditExpense(gasto)).toBe(false);
      expect(result.current.canCancelExpense(gasto)).toBe(false);
      expect(result.current.canManageLifecycle).toBe(false);
      expect(result.current.canSyncSettlements).toBe(false);
      expect(
        result.current.canPerformSettlementAction(acerto, 'pay'),
      ).toBe(false);
      expect(result.current.isReadOnly).toBe(true);
      expect(result.current.canNavigateToAddParticipant()).toBe(false);
      expect(result.current.canNavigateToCreateExpense()).toBe(false);
      expect(result.current.canNavigateToEditExpense(gasto)).toBe(false);
    });

    it('diferencia as capacidades do participante vinculado ATIVO', () => {
      const participante = makeLinkedParticipante();
      const gasto = makeGasto();
      const acertoProprio = makeAcerto();
      const acertoDeOutro = makeAcerto({
        deParticipanteId: 'participante-1',
      });
      const acertoPago = makeAcerto({ status: 'PAGO' });
      const { result } = renderMutationsHook({
        planejamento: makePlanejamentoComVinculado(),
        usuarioAutenticadoId: LINKED_USER_ID,
      });

      expect(result.current.canAddParticipant).toBe(false);
      expect(result.current.canRemoveParticipant(participante)).toBe(false);
      expect(result.current.canCreateExpense).toBe(true);
      expect(result.current.canEditExpense(gasto)).toBe(false);
      expect(result.current.canCancelExpense(gasto)).toBe(false);
      expect(result.current.canManageLifecycle).toBe(false);
      expect(result.current.canSyncSettlements).toBe(true);
      expect(
        result.current.canPerformSettlementAction(acertoProprio, 'pay'),
      ).toBe(true);
      expect(
        result.current.canPerformSettlementAction(acertoDeOutro, 'pay'),
      ).toBe(false);
      expect(
        result.current.canPerformSettlementAction(acertoProprio, 'cancel'),
      ).toBe(false);
      expect(
        result.current.canPerformSettlementAction(acertoPago, 'reopen'),
      ).toBe(false);
      expect(result.current.canNavigateToAddParticipant()).toBe(false);
      expect(result.current.canNavigateToCreateExpense()).toBe(true);
      expect(result.current.canNavigateToEditExpense(gasto)).toBe(false);
    });

    it('mantem sincronizacao e pagamento proprio para vinculado em planejamento FECHADO', () => {
      const acerto = makeAcerto();
      const { result } = renderMutationsHook({
        planejamento: makePlanejamentoComVinculado({ status: 'FECHADO' }),
        resumo: makeResumo({ statusOperacional: 'FECHADO' }),
        usuarioAutenticadoId: LINKED_USER_ID,
      });

      expect(result.current.canCreateExpense).toBe(false);
      expect(result.current.canManageLifecycle).toBe(false);
      expect(result.current.canSyncSettlements).toBe(true);
      expect(
        result.current.canPerformSettlementAction(acerto, 'pay'),
      ).toBe(true);
    });

    it.each([
      {
        description: 'nao vinculado',
        planejamento: makePlanejamento(),
      },
      {
        description: 'removido',
        planejamento: makePlanejamentoComVinculado({
          participantes: [
            makeOwnerParticipante(),
            makeLinkedParticipante({ status: 'REMOVIDO' }),
          ],
        }),
      },
      {
        description: 'pendente',
        planejamento: makePlanejamentoComVinculado({
          participantes: [
            makeOwnerParticipante(),
            makeLinkedParticipante({ status: 'PENDENTE' }),
          ],
        }),
      },
      {
        description: 'manual',
        planejamento: makePlanejamentoComVinculado({
          participantes: [
            makeOwnerParticipante(),
            makeLinkedParticipante({ tipo: 'MANUAL' }),
          ],
        }),
      },
    ])(
      'nao concede capacidades de mutacao ao usuario $description',
      ({ planejamento }) => {
        const participante = makeParticipante();
        const gasto = makeGasto();
        const acerto = makeAcerto();
        const { result } = renderMutationsHook({
          planejamento,
          usuarioAutenticadoId: LINKED_USER_ID,
        });

        expect(result.current.canAddParticipant).toBe(false);
        expect(result.current.canRemoveParticipant(participante)).toBe(false);
        expect(result.current.canCreateExpense).toBe(false);
        expect(result.current.canEditExpense(gasto)).toBe(false);
        expect(result.current.canCancelExpense(gasto)).toBe(false);
        expect(result.current.canManageLifecycle).toBe(false);
        expect(result.current.canSyncSettlements).toBe(false);
        expect(
          result.current.canPerformSettlementAction(acerto, 'pay'),
        ).toBe(false);
        expect(result.current.canNavigateToAddParticipant()).toBe(false);
        expect(result.current.canNavigateToCreateExpense()).toBe(false);
        expect(result.current.canNavigateToEditExpense(gasto)).toBe(false);
      },
    );
  });

  it('bloqueia os guards de navegacao enquanto outra mutacao detem o lock', async () => {
    const syncDeferred = createDeferred<AcertoPlanejamento[]>();
    mockedPlanejamentoService.syncAcertosPlanejamento.mockReturnValue(
      syncDeferred.promise,
    );
    const gasto = makeGasto();
    const { result } = renderMutationsHook();
    let syncPromise: Promise<void> = Promise.resolve();

    act(() => {
      syncPromise = result.current.handleSyncAcertos();
    });

    expect(result.current.canNavigateToAddParticipant()).toBe(false);
    expect(result.current.canNavigateToCreateExpense()).toBe(false);
    expect(result.current.canNavigateToEditExpense(gasto)).toBe(false);

    await act(async () => {
      syncDeferred.resolve([]);
      await syncPromise;
    });

    expect(result.current.canNavigateToAddParticipant()).toBe(true);
    expect(result.current.canNavigateToCreateExpense()).toBe(true);
    expect(result.current.canNavigateToEditExpense(gasto)).toBe(true);
  });

  it('serializa todas as mutacoes com um lock sincrono do agregado', async () => {
    const syncDeferred = createDeferred<AcertoPlanejamento[]>();
    mockedPlanejamentoService.syncAcertosPlanejamento.mockReturnValue(
      syncDeferred.promise,
    );
    const { result } = renderMutationsHook();
    let syncPromise: Promise<void> = Promise.resolve();
    let payPromise: Promise<void> = Promise.resolve();
    let gastoPromise: Promise<void> = Promise.resolve();
    let participantePromise: Promise<void> = Promise.resolve();
    let transitionPromise: Promise<void> = Promise.resolve();

    act(() => {
      syncPromise = result.current.handleSyncAcertos();
      payPromise = result.current.handleAcertoAction(makeAcerto(), 'pay');
      gastoPromise = result.current.handleCancelGasto(makeGasto());
      participantePromise =
        result.current.handleRemoveParticipante(makeParticipante());
      transitionPromise = result.current.handleTransition('close');
    });

    expect(
      mockedPlanejamentoService.syncAcertosPlanejamento,
    ).toHaveBeenCalledTimes(1);
    expect(
      mockedPlanejamentoService.payAcertoPlanejamento,
    ).not.toHaveBeenCalled();
    expect(
      mockedPlanejamentoService.cancelGastoPlanejamento,
    ).not.toHaveBeenCalled();
    expect(
      mockedPlanejamentoService.removeParticipantePlanejamento,
    ).not.toHaveBeenCalled();
    expect(mockedPlanejamentoService.fecharPlanejamento).not.toHaveBeenCalled();
    expect(mockConfirmAction).not.toHaveBeenCalled();
    expect(result.current.acertosActionLoading).toBe('sync');
    expect(result.current.aggregateMutationInProgress).toBe(true);
    expect(result.current.canNavigateToAddParticipant()).toBe(false);
    expect(result.current.canNavigateToCreateExpense()).toBe(false);
    expect(result.current.canNavigateToEditExpense(makeGasto())).toBe(false);

    await act(async () => {
      syncDeferred.resolve([]);
      await Promise.all([
        syncPromise,
        payPromise,
        gastoPromise,
        participantePromise,
        transitionPromise,
      ]);
    });

    expect(result.current.aggregateMutationInProgress).toBe(false);
  });

  describe('acertos', () => {
    it('sincroniza acertos e recarrega os dados financeiros', async () => {
      const acerto = makeAcerto();
      mockedPlanejamentoService.syncAcertosPlanejamento.mockResolvedValue([
        acerto,
      ]);
      const { options, result } = renderMutationsHook();

      await runMutation(result.current.handleSyncAcertos);

      expect(
        mockedPlanejamentoService.syncAcertosPlanejamento,
      ).toHaveBeenCalledWith(PLANEJAMENTO_ID);
      expect(options.refreshFinancialData).toHaveBeenCalledWith(
        PLANEJAMENTO_ID,
      );
      expect(result.current.acertosInfo).toBe(
        'Acertos sincronizados com sucesso.',
      );
      expect(result.current.acertosError).toBe('');
      expect(result.current.acertosActionLoading).toBeNull();
    });

    it('informa quando a sincronizacao nao gera acertos', async () => {
      const { result } = renderMutationsHook();

      await runMutation(result.current.handleSyncAcertos);

      expect(result.current.acertosInfo).toBe(
        'Ainda nao ha dados suficientes para gerar acertos. Cadastre gastos e participantes ativos e tente novamente.',
      );
    });

    it('marca um acerto como pago', async () => {
      const acerto = makeAcerto();
      const { options, result } = renderMutationsHook();

      await runMutation(() => result.current.handleAcertoAction(acerto, 'pay'));

      expect(
        mockedPlanejamentoService.payAcertoPlanejamento,
      ).toHaveBeenCalledWith(PLANEJAMENTO_ID, acerto.id);
      expect(options.refreshFinancialData).toHaveBeenCalledWith(
        PLANEJAMENTO_ID,
      );
      expect(result.current.acertosInfo).toBe(
        'Acerto atualizado com sucesso.',
      );
      expect(result.current.acertosActionLoading).toBeNull();
    });

    it('cancela um acerto pendente', async () => {
      const acerto = makeAcerto();
      const { options, result } = renderMutationsHook();

      await runMutation(() =>
        result.current.handleAcertoAction(acerto, 'cancel'),
      );

      expect(
        mockedPlanejamentoService.cancelAcertoPlanejamento,
      ).toHaveBeenCalledWith(PLANEJAMENTO_ID, acerto.id);
      expect(options.refreshFinancialData).toHaveBeenCalledWith(
        PLANEJAMENTO_ID,
      );
      expect(result.current.acertosInfo).toBe(
        'Acerto atualizado com sucesso.',
      );
    });

    it('cancela um acerto pago', async () => {
      const acerto = makeAcerto({ status: 'PAGO' });
      const { options, result } = renderMutationsHook();

      await runMutation(() =>
        result.current.handleAcertoAction(acerto, 'cancel'),
      );

      expect(
        mockedPlanejamentoService.cancelAcertoPlanejamento,
      ).toHaveBeenCalledWith(PLANEJAMENTO_ID, acerto.id);
      expect(options.refreshFinancialData).toHaveBeenCalledWith(
        PLANEJAMENTO_ID,
      );
      expect(result.current.acertosInfo).toBe(
        'Acerto atualizado com sucesso.',
      );
    });

    it('reabre um acerto pago', async () => {
      const acerto = makeAcerto({ status: 'PAGO' });
      const { options, result } = renderMutationsHook({
        planejamento: makePlanejamento({ status: 'FECHADO' }),
        resumo: makeResumo({ statusOperacional: 'FECHADO' }),
      });

      await runMutation(() =>
        result.current.handleAcertoAction(acerto, 'reopen'),
      );

      expect(
        mockedPlanejamentoService.reopenAcertoPlanejamento,
      ).toHaveBeenCalledWith(PLANEJAMENTO_ID, acerto.id);
      expect(options.refreshFinancialData).toHaveBeenCalledWith(
        PLANEJAMENTO_ID,
      );
      expect(result.current.acertosInfo).toBe(
        'Acerto atualizado com sucesso.',
      );
    });
  });

  it('confirma e cancela um gasto ativo', async () => {
    const gasto = makeGasto();
    const { options, result } = renderMutationsHook();

    await runMutation(() => result.current.handleCancelGasto(gasto));

    expect(mockConfirmAction).toHaveBeenCalledWith(
      'Cancelar gasto',
      'Deseja cancelar o gasto "Hotel"? Ele permanecera visivel no historico.',
    );
    expect(
      mockedPlanejamentoService.cancelGastoPlanejamento,
    ).toHaveBeenCalledWith(PLANEJAMENTO_ID, gasto.id);
    expect(options.refreshExpenseFinancialData).toHaveBeenCalledWith(
      PLANEJAMENTO_ID,
    );
    expect(result.current.gastosInfo).toBe('Gasto cancelado com sucesso.');
    expect(result.current.gastosError).toBe('');
    expect(result.current.gastoActionLoading).toBeNull();
  });

  it('remove participante, aplica a atualizacao local e recarrega o agregado', async () => {
    const participante = makeParticipante();
    const participanteRemovido = makeParticipante({ status: 'REMOVIDO' });
    const applyParticipantUpdate =
      jest.fn<
        UsePlanejamentoDetailMutationsOptions['applyParticipantUpdate']
      >();
    const reloadAllData =
      jest.fn<
        UsePlanejamentoDetailMutationsOptions['reloadAllData']
      >(async () => {
        expect(applyParticipantUpdate).toHaveBeenCalledWith(
          participanteRemovido,
        );
        return true;
      });
    mockedPlanejamentoService.removeParticipantePlanejamento.mockResolvedValue(
      participanteRemovido,
    );
    const { result } = renderMutationsHook({
      applyParticipantUpdate,
      reloadAllData,
    });

    await runMutation(() =>
      result.current.handleRemoveParticipante(participante),
    );

    expect(mockConfirmAction).toHaveBeenCalledWith(
      'Remover participante',
      'Deseja remover "Bruno" deste planejamento? O participante não poderá ser utilizado em novos gastos ou divisões, mas continuará visível no histórico financeiro.',
    );
    expect(
      mockedPlanejamentoService.removeParticipantePlanejamento,
    ).toHaveBeenCalledWith(PLANEJAMENTO_ID, participante.id);
    expect(applyParticipantUpdate).toHaveBeenCalledWith(participanteRemovido);
    expect(reloadAllData).toHaveBeenCalledWith(PLANEJAMENTO_ID);
    expect(result.current.participantesInfo).toBe(
      'Participante removido com sucesso.',
    );
    expect(result.current.participantesError).toBe('');
    expect(result.current.participanteActionLoading).toBeNull();
  });

  describe('lifecycle', () => {
    it('fecha um planejamento e expoe o loading da transicao', async () => {
      const planejamentoFechado = makePlanejamento({ status: 'FECHADO' });
      const closeDeferred = createDeferred<Planejamento>();
      mockedPlanejamentoService.fecharPlanejamento.mockReturnValue(
        closeDeferred.promise,
      );
      const { options, result } = renderMutationsHook();
      let transitionPromise: Promise<void> = Promise.resolve();

      act(() => {
        transitionPromise = result.current.handleTransition('close');
      });

      await waitFor(() => {
        expect(
          mockedPlanejamentoService.fecharPlanejamento,
        ).toHaveBeenCalledWith(PLANEJAMENTO_ID);
      });
      expect(mockConfirmAction).toHaveBeenCalledWith(
        'Fechar planejamento',
        'Deseja fechar este planejamento? Participantes e gastos ficarao bloqueados para alteracoes.',
      );
      expect(result.current.transitionLoading).toBe('close');
      expect(result.current.transitionLoadingLabel).toBe('Fechando...');
      expect(result.current.aggregateMutationInProgress).toBe(true);

      await act(async () => {
        closeDeferred.resolve(planejamentoFechado);
        await transitionPromise;
      });

      expect(options.reloadAllData).toHaveBeenCalledWith(PLANEJAMENTO_ID);
      expect(result.current.transitionInfo).toBe(
        'Planejamento fechado com sucesso.',
      );
      expect(result.current.transitionLoading).toBeNull();
      expect(result.current.transitionLoadingLabel).toBe('');
    });

    it('arquiva um planejamento fechado e quitado', async () => {
      const { options, result } = renderMutationsHook({
        planejamento: makePlanejamento({ status: 'FECHADO' }),
        resumo: makeResumo({ statusOperacional: 'FECHADO' }),
      });

      await runMutation(() => result.current.handleTransition('archive'));

      expect(mockConfirmAction).toHaveBeenCalledWith(
        'Arquivar planejamento',
        'Deseja arquivar este planejamento quitado? Ele ficara somente leitura.',
      );
      expect(
        mockedPlanejamentoService.arquivarPlanejamento,
      ).toHaveBeenCalledWith(PLANEJAMENTO_ID);
      expect(options.reloadAllData).toHaveBeenCalledWith(PLANEJAMENTO_ID);
      expect(result.current.transitionInfo).toBe(
        'Planejamento arquivado com sucesso.',
      );
    });

    it('cancela um planejamento aberto e quitado', async () => {
      const { options, result } = renderMutationsHook();

      await runMutation(() => result.current.handleTransition('cancel'));

      expect(mockConfirmAction).toHaveBeenCalledWith(
        'Cancelar planejamento',
        'Deseja cancelar este planejamento quitado? Ele ficara somente leitura.',
      );
      expect(
        mockedPlanejamentoService.cancelarPlanejamento,
      ).toHaveBeenCalledWith(PLANEJAMENTO_ID);
      expect(options.reloadAllData).toHaveBeenCalledWith(PLANEJAMENTO_ID);
      expect(result.current.transitionInfo).toBe(
        'Planejamento cancelado com sucesso.',
      );
    });
  });

  it('nao inicia a mutacao quando a confirmacao e recusada', async () => {
    mockConfirmAction.mockResolvedValueOnce(false);
    const { options, result } = renderMutationsHook();

    await runMutation(() => result.current.handleCancelGasto(makeGasto()));

    expect(mockConfirmAction).toHaveBeenCalledTimes(1);
    expect(
      mockedPlanejamentoService.cancelGastoPlanejamento,
    ).not.toHaveBeenCalled();
    expect(options.refreshExpenseFinancialData).not.toHaveBeenCalled();
    expect(result.current.gastoActionLoading).toBeNull();
    expect(result.current.aggregateMutationInProgress).toBe(false);

    await runMutation(result.current.handleSyncAcertos);

    expect(
      mockedPlanejamentoService.syncAcertosPlanejamento,
    ).toHaveBeenCalledTimes(1);
  });

  it('apresenta os erros retornados pela API no canal da operacao', async () => {
    mockedPlanejamentoService.payAcertoPlanejamento.mockRejectedValueOnce({
      response: {
        data: { message: 'Sem permissao para pagar' },
        status: 403,
      },
    });
    mockedPlanejamentoService.cancelGastoPlanejamento.mockRejectedValueOnce({
      response: {
        data: { message: 'Falha ao cancelar gasto.' },
        status: 422,
      },
    });
    mockedPlanejamentoService.removeParticipantePlanejamento.mockRejectedValueOnce(
      {
        response: {
          data: { message: 'Participante possui pendencias.' },
          status: 422,
        },
      },
    );
    mockedPlanejamentoService.fecharPlanejamento.mockRejectedValueOnce({
      response: {
        data: { message: 'Existe gasto pendente de revisao.' },
        status: 422,
      },
    });
    const { result } = renderMutationsHook();

    await runMutation(() =>
      result.current.handleAcertoAction(makeAcerto(), 'pay'),
    );
    expect(result.current.acertosError).toBe('Sem permissao para pagar');

    await runMutation(() => result.current.handleCancelGasto(makeGasto()));
    expect(result.current.gastosError).toBe('Falha ao cancelar gasto.');

    await runMutation(() =>
      result.current.handleRemoveParticipante(makeParticipante()),
    );
    expect(result.current.participantesError).toBe(
      'Participante possui pendencias.',
    );

    await runMutation(() => result.current.handleTransition('close'));
    expect(result.current.transitionError).toBe(
      'Existe gasto pendente de revisao.',
    );
    expect(result.current.aggregateMutationInProgress).toBe(false);
  });

  it('trata sessao expirada e delega o redirecionamento', async () => {
    mockedPlanejamentoService.syncAcertosPlanejamento.mockRejectedValueOnce({
      response: {
        data: { message: 'Unauthorized' },
        status: 401,
      },
    });
    const onUnauthorized =
      jest.fn<UsePlanejamentoDetailMutationsOptions['onUnauthorized']>();
    const { result } = renderMutationsHook({ onUnauthorized });

    await runMutation(result.current.handleSyncAcertos);

    expect(mockClearSession).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(result.current.acertosError).toBe(
      'Sessao expirada. Faca login novamente.',
    );
  });

  it('distingue mutacao concluida de falha na recarga posterior', async () => {
    const participanteRemovido = makeParticipante({ status: 'REMOVIDO' });
    const refreshExpenseFinancialData =
      jest
        .fn<
          UsePlanejamentoDetailMutationsOptions['refreshExpenseFinancialData']
        >()
        .mockRejectedValueOnce(new Error('Falha na recarga financeira'));
    const reloadAllData =
      jest
        .fn<UsePlanejamentoDetailMutationsOptions['reloadAllData']>()
        .mockRejectedValueOnce(new Error('Falha na recarga do participante'))
        .mockRejectedValueOnce(new Error('Falha na recarga do status'));
    const applyParticipantUpdate =
      jest.fn<
        UsePlanejamentoDetailMutationsOptions['applyParticipantUpdate']
      >();
    mockedPlanejamentoService.removeParticipantePlanejamento.mockResolvedValue(
      participanteRemovido,
    );
    const { result } = renderMutationsHook({
      applyParticipantUpdate,
      refreshExpenseFinancialData,
      reloadAllData,
    });

    await runMutation(() => result.current.handleCancelGasto(makeGasto()));
    expect(result.current.gastosError).toBe(
      'O gasto foi cancelado, mas nao foi possivel recarregar os dados financeiros.',
    );

    await runMutation(() =>
      result.current.handleRemoveParticipante(makeParticipante()),
    );
    expect(applyParticipantUpdate).toHaveBeenCalledWith(participanteRemovido);
    expect(result.current.participantesError).toBe(
      'O participante foi removido, mas não foi possível recarregar os dados do planejamento.',
    );

    await runMutation(() => result.current.handleTransition('close'));
    expect(result.current.transitionError).toBe(
      'O status foi atualizado, mas nao foi possivel recarregar o planejamento.',
    );
    expect(mockedPlanejamentoService.cancelGastoPlanejamento).toHaveBeenCalled();
    expect(
      mockedPlanejamentoService.removeParticipantePlanejamento,
    ).toHaveBeenCalled();
    expect(mockedPlanejamentoService.fecharPlanejamento).toHaveBeenCalled();
  });

  it('ignora resposta obsoleta apos a troca de contexto e libera o lock', async () => {
    const syncADeferred = createDeferred<AcertoPlanejamento[]>();
    mockedPlanejamentoService.syncAcertosPlanejamento
      .mockReturnValueOnce(syncADeferred.promise)
      .mockResolvedValueOnce([makeAcerto({ id: 'acerto-b' })]);
    let currentPlanejamentoId = 'planejamento-a';
    const isCurrentContext =
      jest.fn<
        UsePlanejamentoDetailMutationsOptions['isCurrentContext']
      >(
        (expectedPlanejamentoId) =>
          expectedPlanejamentoId === currentPlanejamentoId,
      );
    const optionsA = createHookOptions({
      isCurrentContext,
      planejamento: makePlanejamento({ id: 'planejamento-a' }),
      planejamentoId: 'planejamento-a',
      resumo: makeResumo({ planejamentoId: 'planejamento-a' }),
    });
    const { rerender, result } = renderHook(
      (props: UsePlanejamentoDetailMutationsOptions) =>
        usePlanejamentoDetailMutations(props),
      { initialProps: optionsA },
    );
    let syncAPromise: Promise<void> = Promise.resolve();

    act(() => {
      syncAPromise = result.current.handleSyncAcertos();
    });
    expect(
      mockedPlanejamentoService.syncAcertosPlanejamento,
    ).toHaveBeenCalledWith('planejamento-a');

    currentPlanejamentoId = 'planejamento-b';
    const optionsB: UsePlanejamentoDetailMutationsOptions = {
      ...optionsA,
      planejamento: makePlanejamento({ id: 'planejamento-b' }),
      planejamentoId: 'planejamento-b',
      resumo: makeResumo({ planejamentoId: 'planejamento-b' }),
    };
    rerender(optionsB);

    await waitFor(() => {
      expect(result.current.acertosActionLoading).toBeNull();
    });

    await act(async () => {
      syncADeferred.resolve([makeAcerto({ id: 'acerto-a' })]);
      await syncAPromise;
    });

    expect(optionsA.refreshFinancialData).not.toHaveBeenCalled();
    expect(result.current.acertosInfo).toBe('');
    expect(result.current.acertosError).toBe('');

    await runMutation(result.current.handleSyncAcertos);

    expect(
      mockedPlanejamentoService.syncAcertosPlanejamento,
    ).toHaveBeenLastCalledWith('planejamento-b');
    expect(optionsB.refreshFinancialData).toHaveBeenCalledWith(
      'planejamento-b',
    );
    expect(result.current.acertosInfo).toBe(
      'Acertos sincronizados com sucesso.',
    );
  });

  it('ignora resposta da geracao anterior ao retornar de A para B e A', async () => {
    const syncAntigoDeferred = createDeferred<AcertoPlanejamento[]>();
    mockedPlanejamentoService.syncAcertosPlanejamento
      .mockReturnValueOnce(syncAntigoDeferred.promise)
      .mockResolvedValueOnce([makeAcerto({ id: 'acerto-a-novo' })]);
    let currentPlanejamentoId = 'planejamento-a';
    const isCurrentContext =
      jest.fn<
        UsePlanejamentoDetailMutationsOptions['isCurrentContext']
      >(
        (expectedPlanejamentoId) =>
          expectedPlanejamentoId === currentPlanejamentoId,
      );
    const onUnauthorized =
      jest.fn<UsePlanejamentoDetailMutationsOptions['onUnauthorized']>();
    const optionsA = createHookOptions({
      isCurrentContext,
      onUnauthorized,
      planejamento: makePlanejamento({ id: 'planejamento-a' }),
      planejamentoId: 'planejamento-a',
      resumo: makeResumo({ planejamentoId: 'planejamento-a' }),
    });
    const { rerender, result } = renderHook(
      (props: UsePlanejamentoDetailMutationsOptions) =>
        usePlanejamentoDetailMutations(props),
      { initialProps: optionsA },
    );
    let syncAntigoPromise: Promise<void> = Promise.resolve();

    act(() => {
      syncAntigoPromise = result.current.handleSyncAcertos();
    });
    expect(
      mockedPlanejamentoService.syncAcertosPlanejamento,
    ).toHaveBeenCalledWith('planejamento-a');

    currentPlanejamentoId = 'planejamento-b';
    rerender({
      ...optionsA,
      planejamento: makePlanejamento({ id: 'planejamento-b' }),
      planejamentoId: 'planejamento-b',
      resumo: makeResumo({ planejamentoId: 'planejamento-b' }),
    });

    await waitFor(() => {
      expect(result.current.acertosActionLoading).toBeNull();
    });

    currentPlanejamentoId = 'planejamento-a';
    rerender({
      ...optionsA,
      planejamento: makePlanejamento({ id: 'planejamento-a' }),
      planejamentoId: 'planejamento-a',
      resumo: makeResumo({ planejamentoId: 'planejamento-a' }),
    });

    await act(async () => {
      syncAntigoDeferred.resolve([makeAcerto({ id: 'acerto-a-antigo' })]);
      await syncAntigoPromise;
    });

    expect(optionsA.refreshFinancialData).not.toHaveBeenCalled();
    expect(result.current.acertosInfo).toBe('');
    expect(result.current.acertosError).toBe('');
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(mockClearSession).not.toHaveBeenCalled();
    expect(result.current.aggregateMutationInProgress).toBe(false);

    await runMutation(result.current.handleSyncAcertos);

    expect(
      mockedPlanejamentoService.syncAcertosPlanejamento,
    ).toHaveBeenCalledTimes(2);
    expect(
      mockedPlanejamentoService.syncAcertosPlanejamento,
    ).toHaveBeenLastCalledWith('planejamento-a');
    expect(optionsA.refreshFinancialData).toHaveBeenCalledTimes(1);
    expect(optionsA.refreshFinancialData).toHaveBeenCalledWith(
      'planejamento-a',
    );
    expect(result.current.acertosInfo).toBe(
      'Acertos sincronizados com sucesso.',
    );
  });

  it('libera o lock depois de erro e depois de sucesso', async () => {
    mockedPlanejamentoService.syncAcertosPlanejamento
      .mockRejectedValueOnce({
        response: {
          data: { message: 'Calculo indisponivel' },
          status: 400,
        },
      })
      .mockResolvedValueOnce([makeAcerto()])
      .mockResolvedValueOnce([makeAcerto()]);
    const { result } = renderMutationsHook();

    await runMutation(result.current.handleSyncAcertos);
    expect(result.current.acertosError).toBe('Calculo indisponivel');
    expect(result.current.aggregateMutationInProgress).toBe(false);

    await runMutation(result.current.handleSyncAcertos);
    expect(result.current.acertosInfo).toBe(
      'Acertos sincronizados com sucesso.',
    );
    expect(result.current.aggregateMutationInProgress).toBe(false);

    await runMutation(result.current.handleSyncAcertos);
    expect(
      mockedPlanejamentoService.syncAcertosPlanejamento,
    ).toHaveBeenCalledTimes(3);
  });

  it('libera o lock quando a confirmacao rejeita', async () => {
    mockConfirmAction
      .mockRejectedValueOnce(new Error('Falha ao abrir confirmacao'))
      .mockResolvedValueOnce(true);
    const { result } = renderMutationsHook();

    await runMutation(() => result.current.handleCancelGasto(makeGasto()));

    expect(result.current.gastosError).toBe(
      'Nao foi possivel cancelar o gasto.',
    );
    expect(
      mockedPlanejamentoService.cancelGastoPlanejamento,
    ).not.toHaveBeenCalled();

    await runMutation(() => result.current.handleCancelGasto(makeGasto()));

    expect(mockConfirmAction).toHaveBeenCalledTimes(2);
    expect(
      mockedPlanejamentoService.cancelGastoPlanejamento,
    ).toHaveBeenCalledTimes(1);
    expect(result.current.gastosInfo).toBe('Gasto cancelado com sucesso.');
  });

  it('nao remove participante quando o usuario autenticado nao e o criador', async () => {
    const { options, result } = renderMutationsHook({
      planejamento: makePlanejamentoComVinculado({ status: 'ABERTO' }),
      usuarioAutenticadoId: LINKED_USER_ID,
    });

    await runMutation(() =>
      result.current.handleRemoveParticipante(
        makeParticipante({ id: 'participante-3' }),
      ),
    );

    expect(mockConfirmAction).not.toHaveBeenCalled();
    expect(
      mockedPlanejamentoService.removeParticipantePlanejamento,
    ).not.toHaveBeenCalled();
    expect(options.applyParticipantUpdate).not.toHaveBeenCalled();
    expect(options.reloadAllData).not.toHaveBeenCalled();
    expect(options.refreshFinancialData).not.toHaveBeenCalled();
    expect(options.refreshExpenseFinancialData).not.toHaveBeenCalled();
    expect(result.current.aggregateMutationInProgress).toBe(false);

    await runMutation(result.current.handleSyncAcertos);

    expect(
      mockedPlanejamentoService.syncAcertosPlanejamento,
    ).toHaveBeenCalledWith(PLANEJAMENTO_ID);
    expect(options.refreshFinancialData).toHaveBeenCalledWith(
      PLANEJAMENTO_ID,
    );
    expect(mockConfirmAction).not.toHaveBeenCalled();
  });

  it('nao remove o participante proprietario do planejamento', async () => {
    const { options, result } = renderMutationsHook({
      planejamento: makePlanejamento({ status: 'ABERTO' }),
      usuarioAutenticadoId: OWNER_ID,
    });

    await runMutation(() =>
      result.current.handleRemoveParticipante(makeOwnerParticipante()),
    );

    expect(mockConfirmAction).not.toHaveBeenCalled();
    expect(
      mockedPlanejamentoService.removeParticipantePlanejamento,
    ).not.toHaveBeenCalled();
    expect(options.applyParticipantUpdate).not.toHaveBeenCalled();
    expect(options.reloadAllData).not.toHaveBeenCalled();
    expect(options.refreshFinancialData).not.toHaveBeenCalled();
    expect(options.refreshExpenseFinancialData).not.toHaveBeenCalled();
    expect(result.current.aggregateMutationInProgress).toBe(false);

    await runMutation(result.current.handleSyncAcertos);

    expect(
      mockedPlanejamentoService.syncAcertosPlanejamento,
    ).toHaveBeenCalledWith(PLANEJAMENTO_ID);
    expect(options.refreshFinancialData).toHaveBeenCalledWith(
      PLANEJAMENTO_ID,
    );
    expect(mockConfirmAction).not.toHaveBeenCalled();
  });

  it('nao permite ao vinculado cancelar gasto ou executar lifecycle e mantem o lock livre', async () => {
    const gasto = makeGasto();
    const { options, result } = renderMutationsHook({
      planejamento: makePlanejamentoComVinculado(),
      usuarioAutenticadoId: LINKED_USER_ID,
    });

    await runMutation(() => result.current.handleCancelGasto(gasto));
    await runMutation(() => result.current.handleTransition('close'));

    expect(mockConfirmAction).not.toHaveBeenCalled();
    expect(
      mockedPlanejamentoService.cancelGastoPlanejamento,
    ).not.toHaveBeenCalled();
    expect(mockedPlanejamentoService.fecharPlanejamento).not.toHaveBeenCalled();
    expect(options.refreshExpenseFinancialData).not.toHaveBeenCalled();
    expect(options.reloadAllData).not.toHaveBeenCalled();
    expect(result.current.aggregateMutationInProgress).toBe(false);

    await runMutation(result.current.handleSyncAcertos);

    expect(
      mockedPlanejamentoService.syncAcertosPlanejamento,
    ).toHaveBeenCalledWith(PLANEJAMENTO_ID);
    expect(options.refreshFinancialData).toHaveBeenCalledWith(PLANEJAMENTO_ID);
  });

  it('revalida a capacidade atual depois da confirmacao e antes do servico', async () => {
    const confirmationDeferred = createDeferred<boolean>();
    mockConfirmAction.mockReturnValueOnce(confirmationDeferred.promise);
    const gasto = makeGasto();
    const { options, rerender, result } = renderMutationsHook();
    let cancelPromise: Promise<void> = Promise.resolve();

    act(() => {
      cancelPromise = result.current.handleCancelGasto(gasto);
    });

    expect(mockConfirmAction).toHaveBeenCalledTimes(1);
    expect(result.current.aggregateMutationInProgress).toBe(true);

    rerender({
      ...options,
      planejamento: makePlanejamentoComVinculado(),
      usuarioAutenticadoId: LINKED_USER_ID,
    });

    await act(async () => {
      confirmationDeferred.resolve(true);
      await cancelPromise;
    });

    expect(
      mockedPlanejamentoService.cancelGastoPlanejamento,
    ).not.toHaveBeenCalled();
    expect(options.refreshExpenseFinancialData).not.toHaveBeenCalled();
    expect(result.current.aggregateMutationInProgress).toBe(false);

    await runMutation(result.current.handleSyncAcertos);

    expect(
      mockedPlanejamentoService.syncAcertosPlanejamento,
    ).toHaveBeenCalledWith(PLANEJAMENTO_ID);
    expect(options.refreshFinancialData).toHaveBeenCalledWith(PLANEJAMENTO_ID);
  });

  it('revalida a capacidade atual antes da recarga financeira', async () => {
    const syncDeferred = createDeferred<AcertoPlanejamento[]>();
    mockedPlanejamentoService.syncAcertosPlanejamento
      .mockReturnValueOnce(syncDeferred.promise)
      .mockResolvedValueOnce([makeAcerto()]);
    const { options, rerender, result } = renderMutationsHook({
      planejamento: makePlanejamentoComVinculado(),
      usuarioAutenticadoId: LINKED_USER_ID,
    });
    let syncPromise: Promise<void> = Promise.resolve();

    act(() => {
      syncPromise = result.current.handleSyncAcertos();
    });

    rerender({
      ...options,
      planejamento: makePlanejamentoComVinculado({
        participantes: [
          makeOwnerParticipante(),
          makeLinkedParticipante({ status: 'REMOVIDO' }),
        ],
      }),
      usuarioAutenticadoId: LINKED_USER_ID,
    });

    await act(async () => {
      syncDeferred.resolve([]);
      await syncPromise;
    });

    expect(options.refreshFinancialData).not.toHaveBeenCalled();
    expect(result.current.aggregateMutationInProgress).toBe(false);

    rerender({
      ...options,
      planejamento: makePlanejamentoComVinculado(),
      usuarioAutenticadoId: LINKED_USER_ID,
    });

    await runMutation(result.current.handleSyncAcertos);

    expect(
      mockedPlanejamentoService.syncAcertosPlanejamento,
    ).toHaveBeenCalledTimes(2);
    expect(options.refreshFinancialData).toHaveBeenCalledWith(PLANEJAMENTO_ID);
  });

  it('protege os handlers de acerto conforme o devedor e libera o lock para pagamento permitido', async () => {
    const acertoProprio = makeAcerto({ id: 'acerto-proprio' });
    const acertoDeOutro = makeAcerto({
      deParticipanteId: 'participante-1',
      id: 'acerto-de-outro',
    });
    const acertoPago = makeAcerto({
      id: 'acerto-pago',
      status: 'PAGO',
    });
    const { options, result } = renderMutationsHook({
      planejamento: makePlanejamentoComVinculado(),
      usuarioAutenticadoId: LINKED_USER_ID,
    });

    await runMutation(() =>
      result.current.handleAcertoAction(acertoDeOutro, 'pay'),
    );
    await runMutation(() =>
      result.current.handleAcertoAction(acertoProprio, 'cancel'),
    );
    await runMutation(() =>
      result.current.handleAcertoAction(acertoPago, 'reopen'),
    );

    expect(
      mockedPlanejamentoService.payAcertoPlanejamento,
    ).not.toHaveBeenCalled();
    expect(
      mockedPlanejamentoService.cancelAcertoPlanejamento,
    ).not.toHaveBeenCalled();
    expect(
      mockedPlanejamentoService.reopenAcertoPlanejamento,
    ).not.toHaveBeenCalled();
    expect(options.refreshFinancialData).not.toHaveBeenCalled();
    expect(result.current.aggregateMutationInProgress).toBe(false);

    await runMutation(() =>
      result.current.handleAcertoAction(acertoProprio, 'pay'),
    );

    expect(
      mockedPlanejamentoService.payAcertoPlanejamento,
    ).toHaveBeenCalledWith(PLANEJAMENTO_ID, acertoProprio.id);
    expect(options.refreshFinancialData).toHaveBeenCalledWith(PLANEJAMENTO_ID);
  });

  it.each([
    {
      description: 'nao vinculado',
      planejamento: makePlanejamento(),
    },
      {
        description: 'removido',
        planejamento: makePlanejamentoComVinculado({
          participantes: [
            makeOwnerParticipante(),
            makeLinkedParticipante({ status: 'REMOVIDO' }),
          ],
        }),
      },
      {
        description: 'pendente',
        planejamento: makePlanejamentoComVinculado({
          participantes: [
            makeOwnerParticipante(),
            makeLinkedParticipante({ status: 'PENDENTE' }),
          ],
        }),
      },
      {
        description: 'manual',
        planejamento: makePlanejamentoComVinculado({
          participantes: [
            makeOwnerParticipante(),
            makeLinkedParticipante({ tipo: 'MANUAL' }),
          ],
        }),
      },
  ])(
    'nao sincroniza acertos para usuario $description e mantem o lock livre',
    async ({ planejamento }) => {
      const { options, rerender, result } = renderMutationsHook({
        planejamento,
        usuarioAutenticadoId: LINKED_USER_ID,
      });

      await runMutation(result.current.handleSyncAcertos);

      expect(
        mockedPlanejamentoService.syncAcertosPlanejamento,
      ).not.toHaveBeenCalled();
      expect(options.refreshFinancialData).not.toHaveBeenCalled();
      expect(result.current.aggregateMutationInProgress).toBe(false);

      rerender({
        ...options,
        planejamento: makePlanejamentoComVinculado(),
        usuarioAutenticadoId: LINKED_USER_ID,
      });

      await runMutation(result.current.handleSyncAcertos);

      expect(
        mockedPlanejamentoService.syncAcertosPlanejamento,
      ).toHaveBeenCalledWith(PLANEJAMENTO_ID);
      expect(options.refreshFinancialData).toHaveBeenCalledWith(
        PLANEJAMENTO_ID,
      );
    },
  );

  it('ignora a resposta de uma mutacao depois do unmount', async () => {
    const syncDeferred = createDeferred<AcertoPlanejamento[]>();
    mockedPlanejamentoService.syncAcertosPlanejamento.mockReturnValue(
      syncDeferred.promise,
    );
    let mounted = true;
    const isCurrentContext =
      jest.fn<
        UsePlanejamentoDetailMutationsOptions['isCurrentContext']
      >(() => mounted);
    const { options, result, unmount } = renderMutationsHook({
      isCurrentContext,
    });
    let syncPromise: Promise<void> = Promise.resolve();

    act(() => {
      syncPromise = result.current.handleSyncAcertos();
    });
    expect(
      mockedPlanejamentoService.syncAcertosPlanejamento,
    ).toHaveBeenCalledTimes(1);

    mounted = false;
    unmount();

    await act(async () => {
      syncDeferred.resolve([]);
      await syncPromise;
    });

    expect(options.refreshFinancialData).not.toHaveBeenCalled();
    expect(options.onUnauthorized).not.toHaveBeenCalled();
  });

  it('limpa feedback e loading quando o planejamentoId muda', async () => {
    mockedPlanejamentoService.payAcertoPlanejamento.mockRejectedValueOnce({
      response: {
        data: { message: 'Erro do planejamento A' },
        status: 422,
      },
    });
    const optionsA = createHookOptions({
      planejamento: makePlanejamento({ id: 'planejamento-a' }),
      planejamentoId: 'planejamento-a',
    });
    const { rerender, result } = renderHook(
      (props: UsePlanejamentoDetailMutationsOptions) =>
        usePlanejamentoDetailMutations(props),
      { initialProps: optionsA },
    );

    await runMutation(() =>
      result.current.handleAcertoAction(makeAcerto(), 'pay'),
    );
    expect(result.current.acertosError).toBe('Erro do planejamento A');

    rerender({
      ...optionsA,
      isCurrentContext:
        jest.fn<
          UsePlanejamentoDetailMutationsOptions['isCurrentContext']
        >((expectedPlanejamentoId) => expectedPlanejamentoId === 'planejamento-b'),
      planejamento: makePlanejamento({ id: 'planejamento-b' }),
      planejamentoId: 'planejamento-b',
      resumo: makeResumo({ planejamentoId: 'planejamento-b' }),
    });

    await waitFor(() => {
      expect(result.current.acertosError).toBe('');
      expect(result.current.acertosInfo).toBe('');
      expect(result.current.gastosError).toBe('');
      expect(result.current.gastosInfo).toBe('');
      expect(result.current.participantesError).toBe('');
      expect(result.current.participantesInfo).toBe('');
      expect(result.current.transitionError).toBe('');
      expect(result.current.transitionInfo).toBe('');
      expect(result.current.acertosActionLoading).toBeNull();
      expect(result.current.gastoActionLoading).toBeNull();
      expect(result.current.participanteActionLoading).toBeNull();
      expect(result.current.transitionLoading).toBeNull();
    });
  });
});
