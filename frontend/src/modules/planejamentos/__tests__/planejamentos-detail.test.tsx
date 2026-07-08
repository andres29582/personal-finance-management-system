import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PlanejamentoDetailScreen } from '../screens/PlanejamentoDetailScreen';
import * as planejamentoService from '../services/planejamentoService';
import { Planejamento } from '../types/planejamento';

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
    ],
    status: 'ABERTO',
    tipo: 'VIAGEM',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioCriadorId: 'usuario-1',
    ...overrides,
  };
}

describe('PlanejamentoDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = { id: 'planejamento-1' };
  });

  it('carrega e renderiza detalhe basico do planejamento', async () => {
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(mockGetPlanejamentoById).toHaveBeenCalledWith('planejamento-1');
      expect(screen.getAllByText('Viagem de ferias')).toBeTruthy();
      expect(screen.getByText('Custos compartilhados')).toBeTruthy();
      expect(screen.getByText('Aberto')).toBeTruthy();
      expect(screen.getByText('Viagem')).toBeTruthy();
      expect(screen.getByText('10/01/2026')).toBeTruthy();
      expect(screen.getByText('Participantes')).toBeTruthy();
      expect(screen.getByText('Ana')).toBeTruthy();
      expect(screen.getByText('ana@example.com')).toBeTruthy();
      expect(screen.getByText('Vinculado')).toBeTruthy();
      expect(screen.getByText('Ativo')).toBeTruthy();
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

  it('mostra erro quando id nao foi informado', async () => {
    mockLocalSearchParams = {};

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Planejamento nao informado.')).toBeTruthy();
      expect(mockGetPlanejamentoById).not.toHaveBeenCalled();
    });
  });
});
