import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as authStorage from '../../../../storage/authStorage';
import * as orcamentoService from '../services/orcamentoService';
import { Orcamento } from '../types/orcamento';
import { OrcamentosScreen } from '../screens/OrcamentosScreen';

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

jest.mock('../services/orcamentoService');
jest.mock('../../../../storage/authStorage');

const mockListOrcamentos = orcamentoService.listOrcamentos as jest.MockedFunction<
  typeof orcamentoService.listOrcamentos
>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<
  typeof authStorage.clearSession
>;

const orcamento: Orcamento = {
  createdAt: '2026-01-01T00:00:00.000Z',
  gastoAtual: 250,
  id: 'orcamento-1',
  mesReferencia: '2026-04',
  percentualUtilizado: 25,
  restante: 750,
  statusAlerta: 'normal',
  updatedAt: '2026-01-01T00:00:00.000Z',
  usuarioId: 'usuario-1',
  valorPlanejado: 1000,
};

describe('OrcamentosScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearSession.mockResolvedValue(undefined);
  });

  it('opens profile, creates globally and keeps contextual edit', async () => {
    mockListOrcamentos.mockResolvedValue([orcamento]);

    render(<OrcamentosScreen />);

    await waitFor(() => expect(screen.getByText('2026-04')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Abrir perfil do usuário'));
    expect(mockPush).toHaveBeenCalledWith('/usuario');

    fireEvent.press(screen.getByLabelText('Abrir ações rápidas'));
    fireEvent.press(screen.getByLabelText('Novo orçamento'));
    expect(mockPush).toHaveBeenCalledWith('/orcamentos-form');

    fireEvent.press(screen.getByText('Editar'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/orcamentos-form',
      params: { id: 'orcamento-1' },
    });
  });

  it('redirects to login when loading fails with unauthorized error', async () => {
    mockListOrcamentos.mockRejectedValue({
      response: { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } } },
    });

    render(<OrcamentosScreen />);

    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });
});
