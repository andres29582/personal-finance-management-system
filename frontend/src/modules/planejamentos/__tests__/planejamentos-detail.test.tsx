import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PlanejamentoDetailScreen } from '../screens/PlanejamentoDetailScreen';
import * as planejamentoService from '../services/planejamentoService';
import { GastoPlanejamento, Planejamento } from '../types/planejamento';

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

function makePlanejamento(
  overrides: Partial<Planejamento> = {},
): Planejamento {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    dataFim: '2026-01-20',
    dataInicio: '2026-01-10',
    deletedAt: null,
    descricao: 'Custos compartilhados',
    gastos: [],
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

describe('PlanejamentoDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = { id: 'planejamento-1' };
    mockListGastosPlanejamento.mockResolvedValue([]);
  });

  it('carrega e renderiza detalhe basico do planejamento', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockListGastosPlanejamento.mockResolvedValue([makeGasto()]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(mockGetPlanejamentoById).toHaveBeenCalledWith('planejamento-1');
      expect(mockListGastosPlanejamento).toHaveBeenCalledWith('planejamento-1');
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

  it('mostra erro quando id nao foi informado', async () => {
    mockLocalSearchParams = {};

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Planejamento nao informado.')).toBeTruthy();
      expect(mockGetPlanejamentoById).not.toHaveBeenCalled();
    });
  });
});
