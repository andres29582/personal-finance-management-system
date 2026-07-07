import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PlanejamentosScreen } from '../screens/PlanejamentosScreen';
import * as planejamentoService from '../services/planejamentoService';
import { Planejamento } from '../types/planejamento';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: (callback: () => void) => {
      React.useEffect(callback, [callback]);
    },
    useRouter: () => mockRouter,
  };
});

jest.mock('../services/planejamentoService');

const mockListPlanejamentos =
  planejamentoService.listPlanejamentos as jest.MockedFunction<
    typeof planejamentoService.listPlanejamentos
  >;

function makePlanejamento(
  overrides: Partial<Planejamento> = {},
): Planejamento {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    dataFim: '2026-01-20',
    dataInicio: '2026-01-10',
    deletedAt: null,
    descricao: 'Custos compartilhados da viagem',
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

describe('PlanejamentosScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renderiza planejamentos e navega para criar e detalhe', async () => {
    mockListPlanejamentos.mockResolvedValue([makePlanejamento()]);

    render(<PlanejamentosScreen />);

    await waitFor(() => {
      expect(screen.getByText('Planejamentos')).toBeTruthy();
      expect(screen.getByText('Viagem de ferias')).toBeTruthy();
      expect(screen.getByText('Custos compartilhados da viagem')).toBeTruthy();
      expect(screen.getByText('Inicio: 10/01/2026')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Novo'));
    expect(mockPush).toHaveBeenCalledWith('/planejamentos-form');

    fireEvent.press(screen.getByText('Ver detalhe'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/planejamentos-detail',
      params: { id: 'planejamento-1' },
    });
  });

  it('aplica filtro de status ao atualizar a lista', async () => {
    mockListPlanejamentos.mockResolvedValue([makePlanejamento()]);

    render(<PlanejamentosScreen />);

    await waitFor(() => {
      expect(mockListPlanejamentos).toHaveBeenCalledWith(undefined);
    });

    fireEvent.press(screen.getByText('Fechados'));
    fireEvent.press(screen.getByText('Atualizar lista'));

    await waitFor(() => {
      expect(mockListPlanejamentos).toHaveBeenLastCalledWith('FECHADO');
    });
  });
});
