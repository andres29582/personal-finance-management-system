import { describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import DashboardScreen from '../app/dashboard';
import * as authService from '../services/authService';
import * as dashboardService from '../services/dashboardService';
import * as authStorage from '../storage/authStorage';

// Mock expo-router
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
jest.mock('expo-router', () => {
  const React = require('react');

  return {
    useFocusEffect: (callback: () => void) => {
      React.useEffect(callback, [callback]);
    },
    useRouter: () => mockRouter,
  };
});

// Mock services
jest.mock('../services/authService');
jest.mock('../services/dashboardService');
jest.mock('../storage/authStorage');

const mockGetUser = authStorage.getUser as jest.MockedFunction<typeof authStorage.getUser>;
const mockGetDashboard = dashboardService.getDashboard as jest.MockedFunction<typeof dashboardService.getDashboard>;
const mockLogoutSession = authService.logoutSession as jest.MockedFunction<typeof authService.logoutSession>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<typeof authStorage.clearSession>;

const makeDashboard = (overrides = {}) => ({
  contas: [],
  despesasMes: 0,
  economiaMes: 0,
  gastosPorCategoria: [],
  mesReferencia: '2026-05',
  receitasMes: 0,
  saldoTotal: 0,
  totalContas: 0,
  transacoesRecentes: [],
  ...overrides,
});

async function renderDashboard() {
  const result = render(<DashboardScreen />);

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  return result;
}

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard with user greeting and shortcuts', async () => {
    const mockUser = { id: '1', nome: 'João Silva', email: 'joao@example.com' };
    const mockDashboard = makeDashboard();

    mockGetUser.mockResolvedValue(mockUser);
    mockGetDashboard.mockResolvedValue(mockDashboard);

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Ola, João Silva')).toBeTruthy();
      expect(screen.getByText('Contas')).toBeTruthy();
      expect(screen.getByText('Transacoes')).toBeTruthy();
      expect(screen.getByText('Sair')).toBeTruthy();
    });
  });

  it('displays dashboard data correctly', async () => {
    const mockUser = { id: '1', nome: 'João Silva', email: 'joao@example.com' };
    const mockDashboard = makeDashboard({
      saldoTotal: 5000,
      receitasMes: 8000,
      despesasMes: 3000,
      economiaMes: 2000,
      transacoesRecentes: [
        {
          categoriaId: '1',
          categoriaNome: 'Alimentacao',
          contaId: '1',
          contaNome: 'Conta Corrente',
          data: '2026-05-01',
          descricao: 'Compra mercado',
          id: '1',
          tipo: 'despesa',
          valor: -50,
        },
      ],
      contas: [{ id: '1', nome: 'Conta Corrente', saldo: 1000 }],
      totalContas: 1,
    });

    mockGetUser.mockResolvedValue(mockUser);
    mockGetDashboard.mockResolvedValue(mockDashboard);

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('R$ 5.000,00')).toBeTruthy(); // saldoTotal
      expect(screen.getByText('R$ 8.000,00')).toBeTruthy(); // receitasTotais
      expect(screen.getByText('R$ 3.000,00')).toBeTruthy(); // despesasTotais
      expect(screen.getByText('Compra mercado')).toBeTruthy();
    });
  });

  it('navigates to shortcut routes', async () => {
    const mockUser = { id: '1', nome: 'João Silva', email: 'joao@example.com' };
    const mockDashboard = makeDashboard();

    mockGetUser.mockResolvedValue(mockUser);
    mockGetDashboard.mockResolvedValue(mockDashboard);

    await renderDashboard();

    await waitFor(() => {
      const contasButton = screen.getByText('Contas');
      fireEvent.press(contasButton);
      expect(mockPush).toHaveBeenCalledWith('/contas');
    });
  });

  it('handles logout correctly', async () => {
    const mockUser = { id: '1', nome: 'João Silva', email: 'joao@example.com' };
    const mockDashboard = makeDashboard();

    mockGetUser.mockResolvedValue(mockUser);
    mockGetDashboard.mockResolvedValue(mockDashboard);
    mockLogoutSession.mockResolvedValue({ message: 'Logged out' });
    mockClearSession.mockResolvedValue(undefined);

    await renderDashboard();

    await waitFor(() => {
      const logoutButton = screen.getByText('Sair');
      fireEvent.press(logoutButton);
    });

    await waitFor(() => {
      expect(mockLogoutSession).toHaveBeenCalled();
      expect(mockClearSession).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('shows error message when data loading fails', async () => {
    mockGetUser.mockResolvedValue({ id: '1', nome: 'João Silva', email: 'joao@example.com' });
    mockGetDashboard.mockRejectedValue({
      response: { status: 401, data: { message: 'Unauthorized' } },
    });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });
});
