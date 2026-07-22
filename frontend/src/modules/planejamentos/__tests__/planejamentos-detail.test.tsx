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
import {
  AcertoPlanejamento,
  GastoPlanejamento,
  Planejamento,
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

const mockGetPlanejamentoById =
  planejamentoService.getPlanejamentoById as jest.MockedFunction<
    typeof planejamentoService.getPlanejamentoById
  >;
const mockListGastosPlanejamento =
  planejamentoService.listGastosPlanejamento as jest.MockedFunction<
    typeof planejamentoService.listGastosPlanejamento
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

describe('PlanejamentoDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = { id: 'planejamento-1' };
    mockListGastosPlanejamento.mockResolvedValue([]);
    mockListAcertosPlanejamento.mockResolvedValue([]);
    mockSyncAcertosPlanejamento.mockResolvedValue([]);
  });

  it('carrega e renderiza detalhe basico do planejamento', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockListGastosPlanejamento.mockResolvedValue([makeGasto()]);
    mockListAcertosPlanejamento.mockResolvedValue([makeAcerto()]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(mockGetPlanejamentoById).toHaveBeenCalledWith('planejamento-1');
      expect(mockListGastosPlanejamento).toHaveBeenCalledWith('planejamento-1');
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
      expect(screen.getByText('12/01/2026 - Eventual - Hospedagem')).toBeTruthy();
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
    });
  });

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

  it('mostra erro quando id nao foi informado', async () => {
    mockLocalSearchParams = {};

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Planejamento nao informado.')).toBeTruthy();
      expect(mockGetPlanejamentoById).not.toHaveBeenCalled();
    });
  });
});
