import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  act,
  renderHook,
  waitFor,
} from '@testing-library/react-native';
import * as authStorage from '../../../../storage/authStorage';
import { usePlanejamentoDetailData } from '../hooks/usePlanejamentoDetailData';
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

const mockGetPlanejamentoById =
  planejamentoService.getPlanejamentoById as jest.MockedFunction<
    typeof planejamentoService.getPlanejamentoById
  >;
const mockGetResumoPlanejamento =
  planejamentoService.getResumoPlanejamento as jest.MockedFunction<
    typeof planejamentoService.getResumoPlanejamento
  >;
const mockListGastosPlanejamento =
  planejamentoService.listGastosPlanejamento as jest.MockedFunction<
    typeof planejamentoService.listGastosPlanejamento
  >;
const mockListAcertosPlanejamento =
  planejamentoService.listAcertosPlanejamento as jest.MockedFunction<
    typeof planejamentoService.listAcertosPlanejamento
  >;
const mockGetUser = authStorage.getUser as jest.MockedFunction<
  typeof authStorage.getUser
>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<
  typeof authStorage.clearSession
>;

const PLANEJAMENTO_ID = 'planejamento-1';

type HookOptions = {
  onUnauthorized: () => void;
  planejamentoId?: string;
};

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
    participantes: [
      makeParticipante({
        email: 'ana@example.com',
        id: 'participante-1',
        nome: 'Ana',
        tipo: 'VINCULADO',
        usuarioId: 'usuario-1',
      }),
      makeParticipante(),
    ],
    status: 'ABERTO',
    tipo: 'VIAGEM',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioCriadorId: 'usuario-1',
    ...overrides,
  };
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

function renderDataHook(
  planejamentoId: string | undefined,
  providedOnUnauthorized?: () => void,
) {
  const onUnauthorized =
    providedOnUnauthorized ?? jest.fn<() => void>();
  const rendered = renderHook(
    (options: HookOptions) => usePlanejamentoDetailData(options),
    {
      initialProps: {
        onUnauthorized,
        planejamentoId,
      },
    },
  );

  return {
    ...rendered,
    onUnauthorized,
  };
}

describe('usePlanejamentoDetailData', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockClearSession.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue({
      email: 'ana@example.com',
      id: 'usuario-1',
      nome: 'Ana',
    });
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockGetResumoPlanejamento.mockResolvedValue(makeResumo());
    mockListGastosPlanejamento.mockResolvedValue([]);
    mockListAcertosPlanejamento.mockResolvedValue([]);
  });

  it('inicia em paralelo a carga dos quatro recursos', async () => {
    const planejamentoDeferred = createDeferred<Planejamento>();
    const resumoDeferred = createDeferred<ResumoFinanceiroPlanejamento>();
    const gastosDeferred = createDeferred<GastoPlanejamento[]>();
    const acertosDeferred = createDeferred<AcertoPlanejamento[]>();
    mockGetPlanejamentoById.mockReturnValueOnce(planejamentoDeferred.promise);
    mockGetResumoPlanejamento.mockReturnValueOnce(resumoDeferred.promise);
    mockListGastosPlanejamento.mockReturnValueOnce(gastosDeferred.promise);
    mockListAcertosPlanejamento.mockReturnValueOnce(acertosDeferred.promise);

    const { result } = renderDataHook(PLANEJAMENTO_ID);

    await waitFor(() => {
      expect(mockGetPlanejamentoById).toHaveBeenCalledWith(PLANEJAMENTO_ID);
      expect(mockGetResumoPlanejamento).toHaveBeenCalledWith(PLANEJAMENTO_ID);
      expect(mockListGastosPlanejamento).toHaveBeenCalledWith(
        PLANEJAMENTO_ID,
      );
      expect(mockListAcertosPlanejamento).toHaveBeenCalledWith(
        PLANEJAMENTO_ID,
      );
      expect(result.current?.loading).toBe(true);
    });

    await act(async () => {
      planejamentoDeferred.resolve(makePlanejamento());
      resumoDeferred.resolve(makeResumo());
      gastosDeferred.resolve([]);
      acertosDeferred.resolve([]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current?.loading).toBe(false);
    });
  });

  it('encerra o loading quando um refresh parcial supera a carga inicial', async () => {
    const planejamentoDeferred = createDeferred<Planejamento>();
    const resumoInicialDeferred =
      createDeferred<ResumoFinanceiroPlanejamento>();
    const gastosDeferred = createDeferred<GastoPlanejamento[]>();
    const acertosIniciaisDeferred = createDeferred<AcertoPlanejamento[]>();
    mockGetPlanejamentoById.mockReturnValueOnce(planejamentoDeferred.promise);
    mockGetResumoPlanejamento.mockReturnValueOnce(
      resumoInicialDeferred.promise,
    );
    mockListGastosPlanejamento.mockReturnValueOnce(gastosDeferred.promise);
    mockListAcertosPlanejamento.mockReturnValueOnce(
      acertosIniciaisDeferred.promise,
    );

    const { result } = renderDataHook(PLANEJAMENTO_ID);

    await waitFor(() => {
      expect(mockGetPlanejamentoById).toHaveBeenCalledTimes(1);
      expect(result.current?.loading).toBe(true);
    });

    const resumoAtualizado = makeResumo({
      totalGastosAtivosCentavos: 3456,
    });
    const acertosAtualizados = [makeAcerto({ status: 'PAGO' })];
    mockGetResumoPlanejamento.mockResolvedValueOnce(resumoAtualizado);
    mockListAcertosPlanejamento.mockResolvedValueOnce(acertosAtualizados);

    let refreshApplied: boolean | undefined;
    await act(async () => {
      refreshApplied =
        await result.current?.refreshFinancialData(PLANEJAMENTO_ID);
    });

    expect(refreshApplied).toBe(true);
    expect(result.current?.loading).toBe(false);
    expect(result.current?.resumo).toBe(resumoAtualizado);
    expect(result.current?.acertos).toBe(acertosAtualizados);

    await act(async () => {
      planejamentoDeferred.resolve(makePlanejamento());
      resumoInicialDeferred.resolve(makeResumo());
      gastosDeferred.resolve([makeGasto()]);
      acertosIniciaisDeferred.resolve([makeAcerto()]);
      await Promise.resolve();
    });

    expect(result.current?.planejamento).toBeNull();
    expect(result.current?.resumo).toBe(resumoAtualizado);
    expect(result.current?.gastos).toEqual([]);
    expect(result.current?.acertos).toBe(acertosAtualizados);
    expect(result.current?.loading).toBe(false);
  });

  it('retorna os dados carregados', async () => {
    const planejamento = makePlanejamento({ nome: 'Planejamento carregado' });
    const resumo = makeResumo({ totalGastosAtivosCentavos: 12345 });
    const gastos = [makeGasto()];
    const acertos = [makeAcerto()];
    mockGetPlanejamentoById.mockResolvedValueOnce(planejamento);
    mockGetResumoPlanejamento.mockResolvedValueOnce(resumo);
    mockListGastosPlanejamento.mockResolvedValueOnce(gastos);
    mockListAcertosPlanejamento.mockResolvedValueOnce(acertos);

    const { result } = renderDataHook(PLANEJAMENTO_ID);

    await waitFor(() => {
      expect(result.current?.loading).toBe(false);
      expect(result.current?.planejamento).toBe(planejamento);
      expect(result.current?.resumo).toBe(resumo);
      expect(result.current?.gastos).toBe(gastos);
      expect(result.current?.acertos).toBe(acertos);
      expect(result.current?.message).toBe('');
    });
  });

  it('nao chama services quando planejamentoId nao foi informado', async () => {
    const { result } = renderDataHook(undefined);

    await waitFor(() => {
      expect(result.current?.loading).toBe(false);
      expect(result.current?.message).toBe('Planejamento nao informado.');
    });

    expect(mockGetPlanejamentoById).not.toHaveBeenCalled();
    expect(mockGetResumoPlanejamento).not.toHaveBeenCalled();
    expect(mockListGastosPlanejamento).not.toHaveBeenCalled();
    expect(mockListAcertosPlanejamento).not.toHaveBeenCalled();
  });

  it('resolve o erro principal sem aplicar uma carga parcial', async () => {
    mockGetResumoPlanejamento.mockRejectedValueOnce({
      response: {
        data: { message: 'Resumo financeiro indisponivel.' },
        status: 500,
      },
    });

    const { onUnauthorized, result } = renderDataHook(PLANEJAMENTO_ID);

    await waitFor(() => {
      expect(result.current?.loading).toBe(false);
      expect(result.current?.message).toBe(
        'Resumo financeiro indisponivel.',
      );
    });

    expect(result.current?.planejamento).toBeNull();
    expect(result.current?.resumo).toBeNull();
    expect(result.current?.gastos).toEqual([]);
    expect(result.current?.acertos).toEqual([]);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('chama onUnauthorized quando a carga principal retorna 401', async () => {
    mockGetPlanejamentoById.mockRejectedValueOnce({
      response: {
        data: { message: 'Unauthorized' },
        status: 401,
      },
    });

    const { onUnauthorized, result } = renderDataHook(PLANEJAMENTO_ID);

    await waitFor(() => {
      expect(result.current?.loading).toBe(false);
      expect(result.current?.message).toBe(
        'Sessao expirada. Faca login novamente.',
      );
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });
  });

  it('carrega a identidade autenticada', async () => {
    const { result } = renderDataHook(PLANEJAMENTO_ID);

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalledTimes(1);
      expect(result.current?.usuarioAutenticadoId).toBe('usuario-1');
      expect(result.current?.participantPermissionError).toBe('');
    });
  });

  it('mantem os dados carregados quando getUser falha', async () => {
    const planejamento = makePlanejamento();
    mockGetPlanejamentoById.mockResolvedValueOnce(planejamento);
    mockGetUser.mockRejectedValueOnce(new Error('SecureStore indisponivel'));

    const { result } = renderDataHook(PLANEJAMENTO_ID);

    await waitFor(() => {
      expect(result.current?.loading).toBe(false);
      expect(result.current?.planejamento).toBe(planejamento);
      expect(result.current?.usuarioAutenticadoId).toBeNull();
      expect(result.current?.participantPermissionError).toBe(
        'Não foi possível verificar sua permissão para gerenciar participantes.',
      );
      expect(result.current?.message).toBe('');
    });
  });

  it('ignora respostas de dados e identidade depois do unmount', async () => {
    const planejamentoDeferred = createDeferred<Planejamento>();
    const resumoDeferred = createDeferred<ResumoFinanceiroPlanejamento>();
    const gastosDeferred = createDeferred<GastoPlanejamento[]>();
    const acertosDeferred = createDeferred<AcertoPlanejamento[]>();
    const userDeferred = createDeferred<
      Awaited<ReturnType<typeof authStorage.getUser>>
    >();
    mockGetPlanejamentoById.mockReturnValueOnce(planejamentoDeferred.promise);
    mockGetResumoPlanejamento.mockReturnValueOnce(resumoDeferred.promise);
    mockListGastosPlanejamento.mockReturnValueOnce(gastosDeferred.promise);
    mockListAcertosPlanejamento.mockReturnValueOnce(acertosDeferred.promise);
    mockGetUser.mockReturnValueOnce(userDeferred.promise);

    const { onUnauthorized, result, unmount } =
      renderDataHook(PLANEJAMENTO_ID);

    await waitFor(() => {
      expect(mockGetPlanejamentoById).toHaveBeenCalledTimes(1);
      expect(mockGetUser).toHaveBeenCalledTimes(1);
    });

    const snapshotBeforeUnmount = result.current;
    expect(snapshotBeforeUnmount?.isCurrentContext(PLANEJAMENTO_ID)).toBe(
      true,
    );
    unmount();

    await act(async () => {
      planejamentoDeferred.resolve(
        makePlanejamento({ nome: 'Resposta tardia' }),
      );
      resumoDeferred.resolve(makeResumo());
      gastosDeferred.resolve([makeGasto()]);
      acertosDeferred.resolve([makeAcerto()]);
      userDeferred.resolve({
        email: 'tardio@example.com',
        id: 'usuario-tardio',
        nome: 'Usuario tardio',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current).toBe(snapshotBeforeUnmount);
    expect(result.current?.planejamento).toBeNull();
    expect(result.current?.usuarioAutenticadoId).toBeNull();
    expect(result.current?.isCurrentContext(PLANEJAMENTO_ID)).toBe(false);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('ignora respostas antigas de dados e identidade apos trocar o id', async () => {
    const planejamentoADeferred = createDeferred<Planejamento>();
    const userADeferred = createDeferred<
      Awaited<ReturnType<typeof authStorage.getUser>>
    >();
    const planejamentoA = makePlanejamento({
      id: 'planejamento-a',
      nome: 'Planejamento A',
    });
    const planejamentoB = makePlanejamento({
      id: 'planejamento-b',
      nome: 'Planejamento B',
    });
    mockGetPlanejamentoById.mockImplementation((id) => {
      if (id === 'planejamento-a') {
        return planejamentoADeferred.promise;
      }

      return Promise.resolve(planejamentoB);
    });
    mockGetResumoPlanejamento.mockImplementation((id) =>
      Promise.resolve(makeResumo({ planejamentoId: id })),
    );
    mockListGastosPlanejamento.mockImplementation((id) =>
      Promise.resolve([
        makeGasto({
          descricao: `Gasto ${id}`,
          id: `gasto-${id}`,
          planejamentoId: id,
        }),
      ]),
    );
    mockListAcertosPlanejamento.mockImplementation((id) =>
      Promise.resolve([
        makeAcerto({
          deParticipante: { id: 'participante-2', nome: id },
          id: `acerto-${id}`,
        }),
      ]),
    );
    mockGetUser
      .mockReturnValueOnce(userADeferred.promise)
      .mockResolvedValueOnce({
        email: 'b@example.com',
        id: 'usuario-b',
        nome: 'Usuario B',
      });
    const onUnauthorized = jest.fn<() => void>();
    const { result, rerender } = renderDataHook(
      'planejamento-a',
      onUnauthorized,
    );

    await waitFor(() => {
      expect(mockGetPlanejamentoById).toHaveBeenCalledWith(
        'planejamento-a',
      );
      expect(mockGetUser).toHaveBeenCalledTimes(1);
    });

    rerender({
      onUnauthorized,
      planejamentoId: 'planejamento-b',
    });

    await waitFor(() => {
      expect(result.current?.loading).toBe(false);
      expect(result.current?.planejamento).toBe(planejamentoB);
      expect(result.current?.usuarioAutenticadoId).toBe('usuario-b');
      expect(result.current?.isCurrentContext('planejamento-a')).toBe(false);
      expect(result.current?.isCurrentContext('planejamento-b')).toBe(true);
    });

    await act(async () => {
      planejamentoADeferred.resolve(planejamentoA);
      userADeferred.resolve({
        email: 'a@example.com',
        id: 'usuario-a',
        nome: 'Usuario A',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current?.planejamento).toBe(planejamentoB);
    expect(result.current?.usuarioAutenticadoId).toBe('usuario-b');
  });

  it('mantem a carga mais recente quando duas cargas do mesmo id concorrem', async () => {
    const { result } = renderDataHook(PLANEJAMENTO_ID);

    await waitFor(() => {
      expect(result.current?.loading).toBe(false);
    });

    const planejamentoAntigoDeferred = createDeferred<Planejamento>();
    const resumoAntigoDeferred =
      createDeferred<ResumoFinanceiroPlanejamento>();
    const gastosAntigosDeferred = createDeferred<GastoPlanejamento[]>();
    const acertosAntigosDeferred = createDeferred<AcertoPlanejamento[]>();
    mockGetPlanejamentoById.mockReturnValueOnce(
      planejamentoAntigoDeferred.promise,
    );
    mockGetResumoPlanejamento.mockReturnValueOnce(
      resumoAntigoDeferred.promise,
    );
    mockListGastosPlanejamento.mockReturnValueOnce(
      gastosAntigosDeferred.promise,
    );
    mockListAcertosPlanejamento.mockReturnValueOnce(
      acertosAntigosDeferred.promise,
    );

    let cargaAntiga: Promise<boolean> | undefined;
    act(() => {
      cargaAntiga =
        result.current?.reloadAllData(PLANEJAMENTO_ID);
    });

    await waitFor(() => {
      expect(mockGetPlanejamentoById).toHaveBeenCalledTimes(2);
      expect(mockGetResumoPlanejamento).toHaveBeenCalledTimes(2);
      expect(mockListGastosPlanejamento).toHaveBeenCalledTimes(2);
      expect(mockListAcertosPlanejamento).toHaveBeenCalledTimes(2);
    });

    const planejamentoNovo = makePlanejamento({
      nome: 'Planejamento mais recente',
    });
    const resumoNovo = makeResumo({ totalGastosAtivosCentavos: 222 });
    const gastosNovos = [makeGasto({ descricao: 'Gasto mais recente' })];
    const acertosNovos = [
      makeAcerto({
        deParticipante: {
          id: 'participante-2',
          nome: 'Acerto mais recente',
        },
      }),
    ];
    mockGetPlanejamentoById.mockResolvedValueOnce(planejamentoNovo);
    mockGetResumoPlanejamento.mockResolvedValueOnce(resumoNovo);
    mockListGastosPlanejamento.mockResolvedValueOnce(gastosNovos);
    mockListAcertosPlanejamento.mockResolvedValueOnce(acertosNovos);

    let cargaNovaAplicada: boolean | undefined;
    await act(async () => {
      cargaNovaAplicada =
        await result.current?.reloadAllData(PLANEJAMENTO_ID);
    });

    expect(cargaNovaAplicada).toBe(true);
    expect(result.current?.planejamento).toBe(planejamentoNovo);
    expect(result.current?.resumo).toBe(resumoNovo);
    expect(result.current?.gastos).toBe(gastosNovos);
    expect(result.current?.acertos).toBe(acertosNovos);

    let cargaAntigaAplicada: boolean | undefined;
    await act(async () => {
      planejamentoAntigoDeferred.resolve(
        makePlanejamento({ nome: 'Planejamento antigo' }),
      );
      resumoAntigoDeferred.resolve(
        makeResumo({ totalGastosAtivosCentavos: 111 }),
      );
      gastosAntigosDeferred.resolve([
        makeGasto({ descricao: 'Gasto antigo' }),
      ]);
      acertosAntigosDeferred.resolve([
        makeAcerto({
          deParticipante: { id: 'participante-2', nome: 'Acerto antigo' },
        }),
      ]);
      cargaAntigaAplicada = await cargaAntiga;
    });

    expect(cargaAntigaAplicada).toBe(false);
    expect(result.current?.planejamento).toBe(planejamentoNovo);
    expect(result.current?.resumo).toBe(resumoNovo);
    expect(result.current?.gastos).toBe(gastosNovos);
    expect(result.current?.acertos).toBe(acertosNovos);
  });

  it('reloadAllData atualiza os quatro conjuntos sem reativar loading', async () => {
    const { result } = renderDataHook(PLANEJAMENTO_ID);

    await waitFor(() => {
      expect(result.current?.loading).toBe(false);
    });

    const planejamento = makePlanejamento({ nome: 'Planejamento recarregado' });
    const resumo = makeResumo({ totalGastosAtivosCentavos: 9876 });
    const gastos = [makeGasto({ descricao: 'Gasto recarregado' })];
    const acertos = [
      makeAcerto({
        deParticipante: { id: 'participante-2', nome: 'Acerto recarregado' },
      }),
    ];
    const planejamentoDeferred = createDeferred<Planejamento>();
    const resumoDeferred = createDeferred<ResumoFinanceiroPlanejamento>();
    const gastosDeferred = createDeferred<GastoPlanejamento[]>();
    const acertosDeferred = createDeferred<AcertoPlanejamento[]>();
    mockGetPlanejamentoById.mockReturnValueOnce(planejamentoDeferred.promise);
    mockGetResumoPlanejamento.mockReturnValueOnce(resumoDeferred.promise);
    mockListGastosPlanejamento.mockReturnValueOnce(gastosDeferred.promise);
    mockListAcertosPlanejamento.mockReturnValueOnce(acertosDeferred.promise);

    let reloadPromise: Promise<boolean> | undefined;
    act(() => {
      reloadPromise =
        result.current?.reloadAllData(PLANEJAMENTO_ID);
    });

    expect(result.current?.loading).toBe(false);

    let applied: boolean | undefined;
    await act(async () => {
      planejamentoDeferred.resolve(planejamento);
      resumoDeferred.resolve(resumo);
      gastosDeferred.resolve(gastos);
      acertosDeferred.resolve(acertos);
      applied = await reloadPromise;
    });

    expect(applied).toBe(true);
    expect(result.current?.planejamento).toBe(planejamento);
    expect(result.current?.resumo).toBe(resumo);
    expect(result.current?.gastos).toBe(gastos);
    expect(result.current?.acertos).toBe(acertos);
    expect(result.current?.loading).toBe(false);
    expect(mockGetPlanejamentoById).toHaveBeenCalledTimes(2);
    expect(mockGetResumoPlanejamento).toHaveBeenCalledTimes(2);
    expect(mockListGastosPlanejamento).toHaveBeenCalledTimes(2);
    expect(mockListAcertosPlanejamento).toHaveBeenCalledTimes(2);
  });

  it('refreshFinancialData atualiza somente resumo e acertos', async () => {
    const planejamentoInicial = makePlanejamento();
    const resumoInicial = makeResumo();
    const gastosIniciais = [makeGasto()];
    const acertosIniciais = [makeAcerto()];
    mockGetPlanejamentoById.mockResolvedValueOnce(planejamentoInicial);
    mockGetResumoPlanejamento.mockResolvedValueOnce(resumoInicial);
    mockListGastosPlanejamento.mockResolvedValueOnce(gastosIniciais);
    mockListAcertosPlanejamento.mockResolvedValueOnce(acertosIniciais);
    const { result } = renderDataHook(PLANEJAMENTO_ID);

    await waitFor(() => {
      expect(result.current?.loading).toBe(false);
    });

    const resumoAtualizado = makeResumo({
      obrigacaoResidualCentavos: 5000,
    });
    const acertosAtualizados = [
      makeAcerto({
        status: 'PAGO',
      }),
    ];
    mockGetResumoPlanejamento.mockResolvedValueOnce(resumoAtualizado);
    mockListAcertosPlanejamento.mockResolvedValueOnce(acertosAtualizados);

    let applied: boolean | undefined;
    await act(async () => {
      applied =
        await result.current?.refreshFinancialData(PLANEJAMENTO_ID);
    });

    expect(applied).toBe(true);
    expect(result.current?.planejamento).toBe(planejamentoInicial);
    expect(result.current?.gastos).toBe(gastosIniciais);
    expect(result.current?.resumo).toBe(resumoAtualizado);
    expect(result.current?.acertos).toBe(acertosAtualizados);
    expect(mockGetPlanejamentoById).toHaveBeenCalledTimes(1);
    expect(mockListGastosPlanejamento).toHaveBeenCalledTimes(1);
    expect(mockGetResumoPlanejamento).toHaveBeenCalledTimes(2);
    expect(mockListAcertosPlanejamento).toHaveBeenCalledTimes(2);
  });

  it('refreshExpenseFinancialData atualiza resumo, gastos e acertos', async () => {
    const planejamentoInicial = makePlanejamento();
    mockGetPlanejamentoById.mockResolvedValueOnce(planejamentoInicial);
    const { result } = renderDataHook(PLANEJAMENTO_ID);

    await waitFor(() => {
      expect(result.current?.loading).toBe(false);
    });

    const resumoAtualizado = makeResumo({
      totalGastosAtivosCentavos: 5000,
    });
    const gastosAtualizados = [
      makeGasto({ descricao: 'Gasto atualizado' }),
    ];
    const acertosAtualizados = [
      makeAcerto({ observacao: 'Acerto atualizado' }),
    ];
    mockGetResumoPlanejamento.mockResolvedValueOnce(resumoAtualizado);
    mockListGastosPlanejamento.mockResolvedValueOnce(gastosAtualizados);
    mockListAcertosPlanejamento.mockResolvedValueOnce(acertosAtualizados);

    let applied: boolean | undefined;
    await act(async () => {
      applied =
        await result.current?.refreshExpenseFinancialData(
          PLANEJAMENTO_ID,
        );
    });

    expect(applied).toBe(true);
    expect(result.current?.planejamento).toBe(planejamentoInicial);
    expect(result.current?.resumo).toBe(resumoAtualizado);
    expect(result.current?.gastos).toBe(gastosAtualizados);
    expect(result.current?.acertos).toBe(acertosAtualizados);
    expect(mockGetPlanejamentoById).toHaveBeenCalledTimes(1);
    expect(mockGetResumoPlanejamento).toHaveBeenCalledTimes(2);
    expect(mockListGastosPlanejamento).toHaveBeenCalledTimes(2);
    expect(mockListAcertosPlanejamento).toHaveBeenCalledTimes(2);
  });

  it('retorna false quando um refresh fica obsoleto apos troca de id', async () => {
    const planejamentoA = makePlanejamento({
      id: 'planejamento-a',
      nome: 'Planejamento A',
    });
    mockGetPlanejamentoById.mockResolvedValueOnce(planejamentoA);
    const onUnauthorized = jest.fn<() => void>();
    const { result, rerender } = renderDataHook(
      'planejamento-a',
      onUnauthorized,
    );

    await waitFor(() => {
      expect(result.current?.planejamento).toBe(planejamentoA);
    });

    const resumoAntigoDeferred =
      createDeferred<ResumoFinanceiroPlanejamento>();
    const acertosAntigosDeferred = createDeferred<AcertoPlanejamento[]>();
    mockGetResumoPlanejamento.mockReturnValueOnce(
      resumoAntigoDeferred.promise,
    );
    mockListAcertosPlanejamento.mockReturnValueOnce(
      acertosAntigosDeferred.promise,
    );

    let refreshAntigo: Promise<boolean> | undefined;
    act(() => {
      refreshAntigo =
        result.current?.refreshFinancialData('planejamento-a');
    });

    await waitFor(() => {
      expect(mockGetResumoPlanejamento).toHaveBeenCalledTimes(2);
      expect(mockListAcertosPlanejamento).toHaveBeenCalledTimes(2);
    });

    const planejamentoB = makePlanejamento({
      id: 'planejamento-b',
      nome: 'Planejamento B',
    });
    const resumoB = makeResumo({
      planejamentoId: 'planejamento-b',
      totalGastosAtivosCentavos: 200,
    });
    const gastosB = [
      makeGasto({
        id: 'gasto-b',
        planejamentoId: 'planejamento-b',
      }),
    ];
    const acertosB = [
      makeAcerto({
        deParticipante: { id: 'participante-2', nome: 'Devedor B' },
        id: 'acerto-b',
      }),
    ];
    mockGetPlanejamentoById.mockResolvedValueOnce(planejamentoB);
    mockGetResumoPlanejamento.mockResolvedValueOnce(resumoB);
    mockListGastosPlanejamento.mockResolvedValueOnce(gastosB);
    mockListAcertosPlanejamento.mockResolvedValueOnce(acertosB);

    rerender({
      onUnauthorized,
      planejamentoId: 'planejamento-b',
    });

    await waitFor(() => {
      expect(result.current?.planejamento).toBe(planejamentoB);
      expect(result.current?.resumo).toBe(resumoB);
      expect(result.current?.acertos).toBe(acertosB);
    });

    let applied: boolean | undefined;
    await act(async () => {
      resumoAntigoDeferred.resolve(
        makeResumo({
          planejamentoId: 'planejamento-a',
          totalGastosAtivosCentavos: 999,
        }),
      );
      acertosAntigosDeferred.resolve([
        makeAcerto({
          deParticipante: { id: 'participante-2', nome: 'Devedor A' },
          id: 'acerto-a',
        }),
      ]);
      applied = await refreshAntigo;
    });

    expect(applied).toBe(false);
    expect(result.current?.planejamento).toBe(planejamentoB);
    expect(result.current?.resumo).toBe(resumoB);
    expect(result.current?.gastos).toBe(gastosB);
    expect(result.current?.acertos).toBe(acertosB);
  });

  it('applyParticipantUpdate preserva o historico e os demais participantes', async () => {
    const proprietario = makeParticipante({
      email: 'ana@example.com',
      id: 'participante-1',
      nome: 'Ana',
      tipo: 'VINCULADO',
      usuarioId: 'usuario-1',
    });
    const participanteAtivo = makeParticipante();
    const participanteHistorico = makeParticipante({
      id: 'participante-3',
      nome: 'Carla',
      status: 'REMOVIDO',
    });
    const planejamentoInicial = makePlanejamento({
      descricao: 'Descricao preservada',
      participantes: [
        proprietario,
        participanteAtivo,
        participanteHistorico,
      ],
    });
    mockGetPlanejamentoById.mockResolvedValueOnce(planejamentoInicial);
    const { result } = renderDataHook(PLANEJAMENTO_ID);

    await waitFor(() => {
      expect(result.current?.planejamento).toBe(planejamentoInicial);
    });

    const participanteRemovido = makeParticipante({
      status: 'REMOVIDO',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });

    act(() => {
      result.current?.applyParticipantUpdate(participanteRemovido);
    });

    expect(result.current?.planejamento).toEqual({
      ...planejamentoInicial,
      participantes: [
        proprietario,
        participanteRemovido,
        participanteHistorico,
      ],
    });
    expect(result.current?.planejamento).not.toBe(planejamentoInicial);
    expect(result.current?.planejamento?.participantes?.[0]).toBe(
      proprietario,
    );
    expect(result.current?.planejamento?.participantes?.[1]).toBe(
      participanteRemovido,
    );
    expect(result.current?.planejamento?.participantes?.[2]).toBe(
      participanteHistorico,
    );
    expect(result.current?.planejamento?.descricao).toBe(
      'Descricao preservada',
    );
  });

  it('limpa o erro de identidade quando uma leitura posterior tem sucesso', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('SecureStore indisponivel'));
    const onUnauthorized = jest.fn<() => void>();
    const { result, rerender } = renderDataHook(
      'planejamento-a',
      onUnauthorized,
    );

    await waitFor(() => {
      expect(result.current?.participantPermissionError).toBe(
        'Não foi possível verificar sua permissão para gerenciar participantes.',
      );
    });

    const planejamentoB = makePlanejamento({ id: 'planejamento-b' });
    mockGetPlanejamentoById.mockResolvedValueOnce(planejamentoB);
    mockGetResumoPlanejamento.mockResolvedValueOnce(
      makeResumo({ planejamentoId: 'planejamento-b' }),
    );
    mockListGastosPlanejamento.mockResolvedValueOnce([]);
    mockListAcertosPlanejamento.mockResolvedValueOnce([]);
    mockGetUser.mockResolvedValueOnce({
      email: 'b@example.com',
      id: 'usuario-b',
      nome: 'Usuario B',
    });

    rerender({
      onUnauthorized,
      planejamentoId: 'planejamento-b',
    });

    await waitFor(() => {
      expect(result.current?.planejamento).toBe(planejamentoB);
      expect(result.current?.usuarioAutenticadoId).toBe('usuario-b');
      expect(result.current?.participantPermissionError).toBe('');
    });
  });
});
