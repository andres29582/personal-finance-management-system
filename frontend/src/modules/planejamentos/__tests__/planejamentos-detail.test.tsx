import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { PlanejamentoDetailScreen } from '../screens/PlanejamentoDetailScreen';
import * as planejamentoService from '../services/planejamentoService';
import { confirmAction } from '../../../../utils/confirm-action';
import {
  AcertoPlanejamento,
  GastoPlanejamento,
  Planejamento,
  ResumoFinanceiroPlanejamento,
} from '../types/planejamento';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
let mockLocalSearchParams: Record<string, string> = { id: 'planejamento-1' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
  useRouter: () => mockRouter,
}));

jest.mock('../services/planejamentoService');
jest.mock('../../../../utils/confirm-action');

const mockConfirmAction = confirmAction as jest.MockedFunction<
  typeof confirmAction
>;

const mockGetPlanejamentoById =
  planejamentoService.getPlanejamentoById as jest.MockedFunction<
    typeof planejamentoService.getPlanejamentoById
  >;
const mockListGastosPlanejamento =
  planejamentoService.listGastosPlanejamento as jest.MockedFunction<
    typeof planejamentoService.listGastosPlanejamento
  >;
const mockGetResumoPlanejamento =
  planejamentoService.getResumoPlanejamento as jest.MockedFunction<
    typeof planejamentoService.getResumoPlanejamento
  >;
const mockListAcertosPlanejamento =
  planejamentoService.listAcertosPlanejamento as jest.MockedFunction<
    typeof planejamentoService.listAcertosPlanejamento
  >;
const mockSyncAcertosPlanejamento =
  planejamentoService.syncAcertosPlanejamento as jest.MockedFunction<
    typeof planejamentoService.syncAcertosPlanejamento
  >;
const mockPayAcertoPlanejamento =
  planejamentoService.payAcertoPlanejamento as jest.MockedFunction<
    typeof planejamentoService.payAcertoPlanejamento
  >;
const mockCancelAcertoPlanejamento =
  planejamentoService.cancelAcertoPlanejamento as jest.MockedFunction<
    typeof planejamentoService.cancelAcertoPlanejamento
  >;
const mockReopenAcertoPlanejamento =
  planejamentoService.reopenAcertoPlanejamento as jest.MockedFunction<
    typeof planejamentoService.reopenAcertoPlanejamento
  >;
const mockFecharPlanejamento =
  planejamentoService.fecharPlanejamento as jest.MockedFunction<
    typeof planejamentoService.fecharPlanejamento
  >;
const mockArquivarPlanejamento =
  planejamentoService.arquivarPlanejamento as jest.MockedFunction<
    typeof planejamentoService.arquivarPlanejamento
  >;
const mockCancelarPlanejamento =
  planejamentoService.cancelarPlanejamento as jest.MockedFunction<
    typeof planejamentoService.cancelarPlanejamento
  >;

function makePlanejamento(
  overrides: Partial<Planejamento> = {},
): Planejamento {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    dataFim: '2026-01-20',
    dataInicio: '2026-01-10',
    deletedAt: null,
    descricao: 'Custos compartilhados',
    id: 'planejamento-1',
    nome: 'Viagem de ferias',
    participantes: [
      {
        createdAt: '2026-01-01T00:00:00.000Z',
        email: 'ana@example.com',
        id: 'participante-1',
        nome: 'Ana',
        planejamentoId: 'planejamento-1',
        status: 'ATIVO',
        tipo: 'VINCULADO',
        updatedAt: '2026-01-01T00:00:00.000Z',
        usuarioId: 'usuario-1',
      },
      {
        createdAt: '2026-01-01T00:00:00.000Z',
        email: 'bruno@example.com',
        id: 'participante-2',
        nome: 'Bruno',
        planejamentoId: 'planejamento-1',
        status: 'ATIVO',
        tipo: 'MANUAL',
        updatedAt: '2026-01-01T00:00:00.000Z',
        usuarioId: null,
      },
    ],
    status: 'ABERTO',
    tipo: 'VIAGEM',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioCriadorId: 'usuario-1',
    ...overrides,
  };
}

function makeGasto(overrides: Partial<GastoPlanejamento> = {}): GastoPlanejamento {
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
    pagoPorParticipante: {
      createdAt: '2026-01-01T00:00:00.000Z',
      email: 'ana@example.com',
      id: 'participante-1',
      nome: 'Ana',
      planejamentoId: 'planejamento-1',
      status: 'ATIVO',
      tipo: 'VINCULADO',
      updatedAt: '2026-01-01T00:00:00.000Z',
      usuarioId: 'usuario-1',
    },
    pagoPorParticipanteId: 'participante-1',
    planejamentoId: 'planejamento-1',
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

function makeResumo(
  overrides: Partial<ResumoFinanceiroPlanejamento> = {},
): ResumoFinanceiroPlanejamento {
  return {
    obrigacaoResidualCentavos: 0,
    participantes: [],
    planejamentoId: 'planejamento-1',
    situacaoFinanceira: 'QUITADO',
    statusOperacional: 'ABERTO',
    totalGastosAtivosCentavos: 0,
    ...overrides,
  };
}

describe('PlanejamentoDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = { id: 'planejamento-1' };
    mockConfirmAction.mockResolvedValue(true);
    mockGetResumoPlanejamento.mockResolvedValue(makeResumo());
    mockListGastosPlanejamento.mockResolvedValue([]);
    mockListAcertosPlanejamento.mockResolvedValue([]);
    mockSyncAcertosPlanejamento.mockResolvedValue([]);
  });

  it('carrega e renderiza detalhe basico do planejamento', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockListGastosPlanejamento.mockResolvedValue([makeGasto()]);
    mockListAcertosPlanejamento.mockResolvedValue([makeAcerto()]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(
      () => {
        expect(mockGetPlanejamentoById).toHaveBeenCalledWith('planejamento-1');
        expect(mockGetResumoPlanejamento).toHaveBeenCalledWith(
          'planejamento-1',
        );
        expect(mockListGastosPlanejamento).toHaveBeenCalledWith(
          'planejamento-1',
        );
        expect(mockListAcertosPlanejamento).toHaveBeenCalledWith(
          'planejamento-1',
        );
        expect(screen.getAllByText('Viagem de ferias')).toBeTruthy();
        expect(screen.getByText('Custos compartilhados')).toBeTruthy();
        expect(screen.getByText('Aberto')).toBeTruthy();
        expect(screen.getByText('Viagem')).toBeTruthy();
        expect(screen.getByText('10/01/2026')).toBeTruthy();
        expect(screen.getByText('Participantes')).toBeTruthy();
        expect(screen.getByText('Ana')).toBeTruthy();
        expect(screen.getByText('ana@example.com')).toBeTruthy();
        expect(screen.getByText('Vinculado')).toBeTruthy();
        expect(screen.getAllByText('Ativo')).toBeTruthy();
        expect(screen.getByText('Gastos')).toBeTruthy();
        expect(screen.getByText('Hotel')).toBeTruthy();
        expect(
          screen.getByText('12/01/2026 - Eventual - Hospedagem'),
        ).toBeTruthy();
        expect(screen.getByText('Pago por Ana')).toBeTruthy();
        expect(screen.getByText(/123,45/)).toBeTruthy();
        expect(screen.getByText('Acertos')).toBeTruthy();
        expect(screen.getByText('Bruno deve pagar Ana')).toBeTruthy();
        expect(screen.getByText('Devedor: Bruno')).toBeTruthy();
        expect(screen.getByText('Recebedor: Ana')).toBeTruthy();
        expect(screen.getByText('Pendente')).toBeTruthy();
        expect(screen.getByText(/50,00/)).toBeTruthy();
        expect(screen.getByText('Marcar como pago')).toBeTruthy();
        expect(screen.getByText('Cancelar')).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });

  it('renderiza o resumo financeiro oficial e os saldos dos participantes', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockGetResumoPlanejamento.mockResolvedValue(
      makeResumo({
        obrigacaoResidualCentavos: 5000,
        participantes: [
          {
            participante: {
              id: 'participante-1',
              nome: 'Ana',
              status: 'ATIVO',
              tipo: 'VINCULADO',
            },
            saldoAbertoCentavos: 5000,
            saldoBrutoCentavos: 5000,
            statusFinanceiro: 'RECEBEDOR',
            totalDevidoCentavos: 5001,
            totalPagoCentavos: 10001,
            totalPagoEmAcertosCentavos: 0,
            totalRecebidoEmAcertosCentavos: 0,
          },
          {
            participante: {
              id: 'participante-2',
              nome: 'Bruno',
              status: 'ATIVO',
              tipo: 'MANUAL',
            },
            saldoAbertoCentavos: -5000,
            saldoBrutoCentavos: -5000,
            statusFinanceiro: 'DEVEDOR',
            totalDevidoCentavos: 5000,
            totalPagoCentavos: 0,
            totalPagoEmAcertosCentavos: 0,
            totalRecebidoEmAcertosCentavos: 0,
          },
          {
            participante: {
              id: 'participante-3',
              nome: 'Carla',
              status: 'ATIVO',
              tipo: 'MANUAL',
            },
            saldoAbertoCentavos: 0,
            saldoBrutoCentavos: 0,
            statusFinanceiro: 'QUITADO',
            totalDevidoCentavos: 0,
            totalPagoCentavos: 0,
            totalPagoEmAcertosCentavos: 0,
            totalRecebidoEmAcertosCentavos: 0,
          },
        ],
        situacaoFinanceira: 'PENDENTE',
        totalGastosAtivosCentavos: 10001,
      }),
    );

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Resumo financeiro')).toBeTruthy();
      expect(screen.getByText('Situacao financeira')).toBeTruthy();
      expect(screen.getByText('Pendente')).toBeTruthy();
      expect(screen.getByText('Total de gastos ativos')).toBeTruthy();
      expect(screen.getByText(/100,01/)).toBeTruthy();
      expect(screen.getByText('Obrigacao residual')).toBeTruthy();
      expect(screen.getAllByText(/50,00/)).toHaveLength(3);
      expect(screen.getByText('RECEBEDOR')).toBeTruthy();
      expect(screen.getByText('DEVEDOR')).toBeTruthy();
      expect(screen.getByText('QUITADO')).toBeTruthy();
      expect(screen.getByText('Carla')).toBeTruthy();
    });
  });

  it('aplica a matriz de acoes de um planejamento aberto', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Adicionar participante')).toBeTruthy();
      expect(screen.getByText('Adicionar gasto')).toBeTruthy();
      expect(screen.getByText('Sincronizar acertos')).toBeTruthy();
      expect(screen.getByText('Fechar planejamento')).toBeTruthy();
      expect(screen.getByText('Cancelar planejamento')).toBeTruthy();
      expect(screen.queryByText('Arquivar planejamento')).toBeNull();
    });
  });

  it('bloqueia o cancelamento aberto enquanto houver pendencia financeira', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockGetResumoPlanejamento.mockResolvedValue(
      makeResumo({
        obrigacaoResidualCentavos: 100,
        situacaoFinanceira: 'PENDENTE',
      }),
    );

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'O cancelamento fica disponivel quando a situacao financeira estiver quitada.',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Cancelar planejamento'));

    expect(mockConfirmAction).not.toHaveBeenCalled();
  });

  it('bloqueia mutacoes estruturais no fechado, mas mantem operacoes de acerto', async () => {
    mockGetPlanejamentoById.mockResolvedValue(
      makePlanejamento({ status: 'FECHADO' }),
    );
    mockGetResumoPlanejamento.mockResolvedValue(
      makeResumo({
        obrigacaoResidualCentavos: 5000,
        situacaoFinanceira: 'PENDENTE',
        statusOperacional: 'FECHADO',
      }),
    );
    mockListAcertosPlanejamento.mockResolvedValue([makeAcerto()]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Adicionar participante')).toBeNull();
      expect(screen.queryByText('Adicionar gasto')).toBeNull();
      expect(screen.getByText('Sincronizar acertos')).toBeTruthy();
      expect(screen.getByText('Marcar como pago')).toBeTruthy();
      expect(screen.getByText('Cancelar')).toBeTruthy();
      expect(screen.queryByText('Fechar planejamento')).toBeNull();
    });

    fireEvent.press(screen.getByText('Arquivar planejamento'));

    expect(mockConfirmAction).not.toHaveBeenCalled();
  });

  it.each(['ARQUIVADO', 'CANCELADO'] as const)(
    'torna o planejamento %s totalmente somente leitura',
    async (status) => {
      mockGetPlanejamentoById.mockResolvedValue(makePlanejamento({ status }));
      mockGetResumoPlanejamento.mockResolvedValue(
        makeResumo({ statusOperacional: status }),
      );
      mockListAcertosPlanejamento.mockResolvedValue([makeAcerto()]);

      render(<PlanejamentoDetailScreen />);

      await waitFor(() => {
        expect(
          screen.getByText('Este planejamento esta em modo somente leitura.'),
        ).toBeTruthy();
        expect(screen.queryByText('Adicionar participante')).toBeNull();
        expect(screen.queryByText('Adicionar gasto')).toBeNull();
        expect(screen.queryByText('Sincronizar acertos')).toBeNull();
        expect(screen.queryByText('Marcar como pago')).toBeNull();
        expect(screen.queryByText('Cancelar')).toBeNull();
        expect(screen.queryByText('Reabrir')).toBeNull();
        expect(screen.queryByText('Fechar planejamento')).toBeNull();
        expect(screen.queryByText('Arquivar planejamento')).toBeNull();
        expect(screen.queryByText('Cancelar planejamento')).toBeNull();
      });
    },
  );

  it('mostra empty state quando nao existem participantes', async () => {
    mockGetPlanejamentoById.mockResolvedValue(
      makePlanejamento({ participantes: [] }),
    );

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Participantes')).toBeTruthy();
      expect(screen.getByText('Nenhum participante cadastrado.')).toBeTruthy();
    });
  });

  it('navega para adicionar participante', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Adicionar participante')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Adicionar participante'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/planejamentos-participante-form',
      params: { id: 'planejamento-1' },
    });
  });

  it('mostra empty state quando nao existem gastos', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockListGastosPlanejamento.mockResolvedValue([]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Gastos')).toBeTruthy();
      expect(screen.getByText('Nenhum gasto cadastrado.')).toBeTruthy();
    });
  });

  it('navega para adicionar gasto', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Adicionar gasto')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Adicionar gasto'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/planejamentos-gasto-form',
      params: { id: 'planejamento-1' },
    });
  });

  it('confirma o fechamento e recarrega planejamento, resumo, gastos e acertos', async () => {
    const planejamentoAberto = makePlanejamento();
    const planejamentoFechado = makePlanejamento({ status: 'FECHADO' });
    mockGetPlanejamentoById
      .mockResolvedValueOnce(planejamentoAberto)
      .mockResolvedValueOnce(planejamentoFechado);
    mockGetResumoPlanejamento
      .mockResolvedValueOnce(makeResumo())
      .mockResolvedValueOnce(
        makeResumo({ statusOperacional: 'FECHADO' }),
      );
    mockFecharPlanejamento.mockResolvedValue(planejamentoFechado);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Fechar planejamento')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Fechar planejamento'));

    await waitFor(() => {
      expect(mockConfirmAction).toHaveBeenCalledWith(
        'Fechar planejamento',
        'Deseja fechar este planejamento? Participantes e gastos ficarao bloqueados para alteracoes.',
      );
      expect(mockFecharPlanejamento).toHaveBeenCalledWith('planejamento-1');
      expect(mockGetPlanejamentoById).toHaveBeenCalledTimes(2);
      expect(mockGetResumoPlanejamento).toHaveBeenCalledTimes(2);
      expect(mockListGastosPlanejamento).toHaveBeenCalledTimes(2);
      expect(mockListAcertosPlanejamento).toHaveBeenCalledTimes(2);
      expect(
        screen.getByText('Planejamento fechado com sucesso.'),
      ).toBeTruthy();
      expect(screen.queryByText('Adicionar participante')).toBeNull();
      expect(screen.queryByText('Adicionar gasto')).toBeNull();
    });
  });

  it.each([
    {
      confirmationMessage:
        'Deseja arquivar este planejamento quitado? Ele ficara somente leitura.',
      confirmationTitle: 'Arquivar planejamento',
      initialStatus: 'FECHADO',
      label: 'Arquivar planejamento',
      request: () => mockArquivarPlanejamento,
      resultStatus: 'ARQUIVADO',
    },
    {
      confirmationMessage:
        'Deseja cancelar este planejamento quitado? Ele ficara somente leitura.',
      confirmationTitle: 'Cancelar planejamento',
      initialStatus: 'ABERTO',
      label: 'Cancelar planejamento',
      request: () => mockCancelarPlanejamento,
      resultStatus: 'CANCELADO',
    },
  ] as const)(
    'confirma explicitamente a acao $confirmationTitle',
    async ({
      confirmationMessage,
      confirmationTitle,
      initialStatus,
      label,
      request,
      resultStatus,
    }) => {
      const planejamentoInicial = makePlanejamento({ status: initialStatus });
      const planejamentoFinal = makePlanejamento({ status: resultStatus });
      mockGetPlanejamentoById
        .mockResolvedValueOnce(planejamentoInicial)
        .mockResolvedValueOnce(planejamentoFinal);
      mockGetResumoPlanejamento
        .mockResolvedValueOnce(
          makeResumo({ statusOperacional: initialStatus }),
        )
        .mockResolvedValueOnce(
          makeResumo({ statusOperacional: resultStatus }),
        );
      request().mockResolvedValue(planejamentoFinal);

      render(<PlanejamentoDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText(label)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(label));

      await waitFor(() => {
        expect(mockConfirmAction).toHaveBeenCalledWith(
          confirmationTitle,
          confirmationMessage,
        );
        expect(request()).toHaveBeenCalledWith('planejamento-1');
        expect(
          screen.getByText('Este planejamento esta em modo somente leitura.'),
        ).toBeTruthy();
      });
    },
  );

  it('nao executa a transicao quando a confirmacao e recusada', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockConfirmAction.mockResolvedValueOnce(false);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Cancelar planejamento')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Cancelar planejamento'));

    await waitFor(() => {
      expect(mockConfirmAction).toHaveBeenCalledTimes(1);
      expect(mockCancelarPlanejamento).not.toHaveBeenCalled();
    });
  });

  it('libera o lock quando a confirmacao falha', async () => {
    const planejamentoAberto = makePlanejamento();
    const planejamentoFechado = makePlanejamento({ status: 'FECHADO' });
    mockGetPlanejamentoById
      .mockResolvedValueOnce(planejamentoAberto)
      .mockResolvedValueOnce(planejamentoFechado);
    mockConfirmAction
      .mockRejectedValueOnce(new Error('Falha ao abrir confirmacao'))
      .mockResolvedValueOnce(true);
    mockFecharPlanejamento.mockResolvedValue(planejamentoFechado);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Fechar planejamento')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Fechar planejamento'));

    await waitFor(() => {
      expect(
        screen.getByText('Nao foi possivel fechar o planejamento.'),
      ).toBeTruthy();
      expect(mockFecharPlanejamento).not.toHaveBeenCalled();
    });

    fireEvent.press(screen.getByText('Fechar planejamento'));

    await waitFor(() => {
      expect(mockConfirmAction).toHaveBeenCalledTimes(2);
      expect(mockFecharPlanejamento).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText('Planejamento fechado com sucesso.'),
      ).toBeTruthy();
    });
  });

  it('mostra loading e bloqueia duplo envio durante uma transicao', async () => {
    let resolveClose: (value: Planejamento) => void = () => undefined;
    const planejamentoAberto = makePlanejamento();
    const planejamentoFechado = makePlanejamento({ status: 'FECHADO' });
    mockGetPlanejamentoById
      .mockResolvedValueOnce(planejamentoAberto)
      .mockResolvedValueOnce(planejamentoFechado);
    mockFecharPlanejamento.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveClose = resolve;
        }),
    );

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Fechar planejamento')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Fechar planejamento'));

    await waitFor(() => {
      expect(screen.getByText('Fechando...')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Fechando...'));

    expect(mockConfirmAction).toHaveBeenCalledTimes(1);
    expect(mockFecharPlanejamento).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveClose(planejamentoFechado);
    });

    await waitFor(() => {
      expect(screen.getByText('Arquivar planejamento')).toBeTruthy();
    });
  });

  it('mostra a mensagem da API quando uma transicao falha', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockFecharPlanejamento.mockRejectedValueOnce({
      response: {
        data: { message: 'Existe gasto pendente de revisao.' },
        status: 422,
      },
    });

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Fechar planejamento')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Fechar planejamento'));

    await waitFor(() => {
      expect(
        screen.getByText('Existe gasto pendente de revisao.'),
      ).toBeTruthy();
      expect(screen.getByText('Fechar planejamento')).toBeTruthy();
    });
  });

  it('redireciona para login quando uma transicao retorna 401', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockCancelarPlanejamento.mockRejectedValueOnce({
      response: { data: { message: 'Unauthorized' }, status: 401 },
    });

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Cancelar planejamento')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Cancelar planejamento'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(
        screen.getByText('Sessao expirada. Faca login novamente.'),
      ).toBeTruthy();
    });
  });

  it('mostra acertos oficiais com data de pagamento e observacao', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockListAcertosPlanejamento.mockResolvedValue([
      makeAcerto({
        dataPagamento: '2026-01-15T00:00:00.000Z',
        observacao: 'Pix confirmado',
        status: 'PAGO',
      }),
    ]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Bruno deve pagar Ana')).toBeTruthy();
      expect(screen.getByText('Pago')).toBeTruthy();
      expect(screen.getByText('Pago em 15/01/2026')).toBeTruthy();
      expect(screen.getByText('Observacao: Pix confirmado')).toBeTruthy();
      expect(screen.getByText(/50,00/)).toBeTruthy();
    });
  });

  it('mostra empty state quando nao existem acertos', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockListAcertosPlanejamento.mockResolvedValue([]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Acertos')).toBeTruthy();
      expect(
        screen.getByText(
          'Nenhum acerto encontrado. Cadastre gastos e participantes ativos para calcular os acertos.',
        ),
      ).toBeTruthy();
    });
  });

  it('sincroniza acertos e atualiza a lista', async () => {
    const acerto = makeAcerto();
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockListAcertosPlanejamento
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([acerto]);
    mockSyncAcertosPlanejamento.mockResolvedValue([acerto]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Sincronizar acertos')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Sincronizar acertos'));

    await waitFor(() => {
      expect(mockSyncAcertosPlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
      );
      expect(mockListAcertosPlanejamento).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Acertos sincronizados com sucesso.')).toBeTruthy();
      expect(screen.getByText('Bruno deve pagar Ana')).toBeTruthy();
      expect(screen.getByText('Marcar como pago')).toBeTruthy();
      expect(screen.getByText('Cancelar')).toBeTruthy();
    });
  });

  it.each([
    {
      lifecycleLabels: ['Fechar planejamento', 'Cancelar planejamento'],
      status: 'ABERTO',
    },
    {
      lifecycleLabels: ['Arquivar planejamento'],
      status: 'FECHADO',
    },
  ] as const)(
    'desabilita lifecycle durante sincronizacao em planejamento $status',
    async ({ lifecycleLabels, status }) => {
      let resolveSync: (value: AcertoPlanejamento[]) => void = () => undefined;
      mockGetPlanejamentoById.mockResolvedValue(
        makePlanejamento({ status }),
      );
      mockGetResumoPlanejamento.mockResolvedValue(
        makeResumo({ statusOperacional: status }),
      );
      mockSyncAcertosPlanejamento.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSync = resolve;
          }),
      );

      render(<PlanejamentoDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText('Sincronizar acertos')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Sincronizar acertos'));

      await waitFor(() => {
        expect(screen.getByText('Sincronizando...')).toBeTruthy();
      });

      lifecycleLabels.forEach((label) => {
        expect(
          screen.getByRole('button', { name: label }).props.accessibilityState,
        ).toEqual(expect.objectContaining({ disabled: true }));
        fireEvent.press(screen.getByText(label));
      });

      expect(mockConfirmAction).not.toHaveBeenCalled();
      expect(mockFecharPlanejamento).not.toHaveBeenCalled();
      expect(mockCancelarPlanejamento).not.toHaveBeenCalled();
      expect(mockArquivarPlanejamento).not.toHaveBeenCalled();

      await act(async () => {
        resolveSync([]);
      });

      await waitFor(() => {
        expect(screen.getByText('Sincronizar acertos')).toBeTruthy();
      });
    },
  );

  it('mostra loading e mensagem amigavel ao sincronizar sem dados suficientes', async () => {
    let resolveSync: (value: AcertoPlanejamento[]) => void = () => undefined;
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockSyncAcertosPlanejamento.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSync = resolve;
        }),
    );

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Sincronizar acertos')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Sincronizar acertos'));

    expect(screen.getByText('Sincronizando...')).toBeTruthy();

    await act(async () => {
      resolveSync([]);
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          'Ainda nao ha dados suficientes para gerar acertos. Cadastre gastos e participantes ativos e tente novamente.',
        ),
      ).toBeTruthy();
    });
  });

  it('mostra erro ao sincronizar acertos', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockSyncAcertosPlanejamento.mockRejectedValueOnce({
      response: { data: { message: 'Calculo indisponivel' }, status: 400 },
    });

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Sincronizar acertos')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Sincronizar acertos'));

    await waitFor(() => {
      expect(screen.getByText('Calculo indisponivel')).toBeTruthy();
    });
  });

  it('marca acerto pendente como pago', async () => {
    const acerto = makeAcerto();
    const acertoPago = makeAcerto({
      dataPagamento: '2026-01-15T00:00:00.000Z',
      status: 'PAGO',
    });
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockListAcertosPlanejamento
      .mockResolvedValueOnce([acerto])
      .mockResolvedValueOnce([acertoPago]);
    mockPayAcertoPlanejamento.mockResolvedValue(acertoPago);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Marcar como pago')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Marcar como pago'));

    await waitFor(() => {
      expect(mockPayAcertoPlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
        'acerto-1',
      );
      expect(mockListAcertosPlanejamento).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Acerto atualizado com sucesso.')).toBeTruthy();
      expect(screen.getByText('Pago')).toBeTruthy();
      expect(screen.getByText('Reabrir')).toBeTruthy();
    });
  });

  it('cancela acerto pendente', async () => {
    const acerto = makeAcerto();
    const acertoCancelado = makeAcerto({ status: 'CANCELADO' });
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockListAcertosPlanejamento
      .mockResolvedValueOnce([acerto])
      .mockResolvedValueOnce([acertoCancelado]);
    mockCancelAcertoPlanejamento.mockResolvedValue(acertoCancelado);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Cancelar')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Cancelar'));

    await waitFor(() => {
      expect(mockCancelAcertoPlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
        'acerto-1',
      );
      expect(mockListAcertosPlanejamento).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Cancelado')).toBeTruthy();
      expect(screen.queryByText('Reabrir')).toBeNull();
    });
  });

  it('reabre acerto pago e recarrega a lista oficial', async () => {
    const acerto = makeAcerto({ status: 'PAGO' });
    const acertoReaberto = makeAcerto({ status: 'PENDENTE' });
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockListAcertosPlanejamento
      .mockResolvedValueOnce([acerto])
      .mockResolvedValueOnce([acertoReaberto]);
    mockReopenAcertoPlanejamento.mockResolvedValue(acertoReaberto);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Reabrir')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Reabrir'));

    await waitFor(() => {
      expect(mockReopenAcertoPlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
        'acerto-1',
      );
      expect(mockListAcertosPlanejamento).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Pendente')).toBeTruthy();
      expect(screen.getByText('Marcar como pago')).toBeTruthy();
    });
  });

  it.each([
    {
      acertoStatus: 'PENDENTE',
      actionLabel: 'Marcar como pago',
      lifecycleLabels: ['Fechar planejamento', 'Cancelar planejamento'],
      loadingLabel: 'Marcando...',
      planejamentoStatus: 'ABERTO',
      request: () => mockPayAcertoPlanejamento,
    },
    {
      acertoStatus: 'PENDENTE',
      actionLabel: 'Cancelar',
      lifecycleLabels: ['Fechar planejamento', 'Cancelar planejamento'],
      loadingLabel: 'Cancelando...',
      planejamentoStatus: 'ABERTO',
      request: () => mockCancelAcertoPlanejamento,
    },
    {
      acertoStatus: 'PAGO',
      actionLabel: 'Reabrir',
      lifecycleLabels: ['Arquivar planejamento'],
      loadingLabel: 'Reabrindo...',
      planejamentoStatus: 'FECHADO',
      request: () => mockReopenAcertoPlanejamento,
    },
  ] as const)(
    'desabilita lifecycle durante a operacao de acerto $actionLabel',
    async ({
      acertoStatus,
      actionLabel,
      lifecycleLabels,
      loadingLabel,
      planejamentoStatus,
      request,
    }) => {
      let resolveAction: (value: AcertoPlanejamento) => void = () => undefined;
      const acerto = makeAcerto({ status: acertoStatus });
      mockGetPlanejamentoById.mockResolvedValue(
        makePlanejamento({ status: planejamentoStatus }),
      );
      mockGetResumoPlanejamento.mockResolvedValue(
        makeResumo({ statusOperacional: planejamentoStatus }),
      );
      mockListAcertosPlanejamento.mockResolvedValue([acerto]);
      request().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveAction = resolve;
          }),
      );

      render(<PlanejamentoDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText(actionLabel)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(actionLabel));

      await waitFor(() => {
        expect(screen.getByText(loadingLabel)).toBeTruthy();
      });

      lifecycleLabels.forEach((label) => {
        expect(
          screen.getByRole('button', { name: label }).props.accessibilityState,
        ).toEqual(expect.objectContaining({ disabled: true }));
        fireEvent.press(screen.getByText(label));
      });

      expect(request()).toHaveBeenCalledWith('planejamento-1', 'acerto-1');
      expect(mockConfirmAction).not.toHaveBeenCalled();
      expect(mockFecharPlanejamento).not.toHaveBeenCalled();
      expect(mockCancelarPlanejamento).not.toHaveBeenCalled();
      expect(mockArquivarPlanejamento).not.toHaveBeenCalled();

      await act(async () => {
        resolveAction(acerto);
      });

      await waitFor(() => {
        expect(screen.getByText(actionLabel)).toBeTruthy();
      });
    },
  );

  it('mostra acoes conforme status do acerto', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockListAcertosPlanejamento.mockResolvedValue([
      makeAcerto({ id: 'acerto-pendente', status: 'PENDENTE' }),
      makeAcerto({ id: 'acerto-pago', status: 'PAGO' }),
      makeAcerto({ id: 'acerto-cancelado', status: 'CANCELADO' }),
      makeAcerto({ id: 'acerto-confirmado', status: 'CONFIRMADO' }),
    ]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Confirmado')).toBeTruthy();
      expect(screen.getAllByText('Marcar como pago')).toHaveLength(1);
      expect(screen.getAllByText('Cancelar')).toHaveLength(1);
      expect(screen.getAllByText('Reabrir')).toHaveLength(1);
    });
  });

  it('mantem as acoes apos reload porque o GET retorna ids persistidos', async () => {
    const acertoPago = makeAcerto({ status: 'PAGO' });
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockListAcertosPlanejamento.mockResolvedValue([acertoPago]);

    const primeiraRenderizacao = render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Reabrir')).toBeTruthy();
    });

    primeiraRenderizacao.unmount();
    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(mockListAcertosPlanejamento).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Reabrir')).toBeTruthy();
    });
  });

  it('nao cria sugestoes operaveis quando a listagem oficial falha', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockListAcertosPlanejamento.mockRejectedValue({
      response: {
        data: { message: 'Falha ao listar acertos oficiais' },
        status: 500,
      },
    });

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Falha ao listar acertos oficiais')).toBeTruthy();
      expect(screen.queryByText('Marcar como pago')).toBeNull();
      expect(screen.queryByText('Cancelar')).toBeNull();
      expect(screen.queryByText('Reabrir')).toBeNull();
    });
  });

  it('mostra loading e erro ao executar acao de acerto', async () => {
    let rejectPay: (reason?: unknown) => void = () => undefined;
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockListAcertosPlanejamento.mockResolvedValue([makeAcerto()]);
    mockPayAcertoPlanejamento.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectPay = reject;
        }),
    );

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Marcar como pago')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Marcar como pago'));

    expect(screen.getByText('Marcando...')).toBeTruthy();

    await act(async () => {
      rejectPay({
        response: { data: { message: 'Sem permissao para pagar' }, status: 403 },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Sem permissao para pagar')).toBeTruthy();
      expect(screen.getByText('Marcar como pago')).toBeTruthy();
    });
  });

  it('trata erro de API ao carregar o resumo financeiro', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockGetResumoPlanejamento.mockRejectedValueOnce({
      response: {
        data: { message: 'Resumo financeiro indisponivel.' },
        status: 500,
      },
    });

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Resumo financeiro indisponivel.')).toBeTruthy();
      expect(
        screen.getByText('Nao foi possivel carregar o planejamento'),
      ).toBeTruthy();
    });
  });

  it('mostra erro quando id nao foi informado', async () => {
    mockLocalSearchParams = {};

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Planejamento nao informado.')).toBeTruthy();
      expect(mockGetPlanejamentoById).not.toHaveBeenCalled();
    });
  });
});
