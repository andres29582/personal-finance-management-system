import { describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { DashboardScreen } from '../screens/DashboardScreen';
import * as authService from '../../auth/services/authService';
import * as dashboardService from '../services/dashboardService';
import * as authStorage from '../../../../storage/authStorage';
import * as metaService from '../../metas/services/metaService';
import * as orcamentoService from '../../orcamentos/services/orcamentoService';

// Mock expo-router
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

// Mock services
jest.mock('../../auth/services/authService');
jest.mock('../services/dashboardService');
jest.mock('../../../../storage/authStorage');
jest.mock('../../metas/services/metaService');
jest.mock('../../orcamentos/services/orcamentoService');

const mockGetUser = authStorage.getUser as jest.MockedFunction<typeof authStorage.getUser>;
const mockGetDashboard = dashboardService.getDashboard as jest.MockedFunction<typeof dashboardService.getDashboard>;
const mockLogoutSession = authService.logoutSession as jest.MockedFunction<typeof authService.logoutSession>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<typeof authStorage.clearSession>;
const mockListMetas = metaService.listMetas as jest.MockedFunction<typeof metaService.listMetas>;
const mockListOrcamentos = orcamentoService.listOrcamentos as jest.MockedFunction<typeof orcamentoService.listOrcamentos>;

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
    mockListMetas.mockResolvedValue([]);
    mockListOrcamentos.mockResolvedValue([]);
  });

  it('renders dashboard with user greeting and sidebar navigation', async () => {
    const mockUser = { id: '1', nome: 'João Silva', email: 'joao@example.com' };
    const mockDashboard = makeDashboard();

    mockGetUser.mockResolvedValue(mockUser);
    mockGetDashboard.mockResolvedValue(mockDashboard);

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Ola, João Silva')).toBeTruthy();
      expect(screen.getByLabelText('Contas')).toBeTruthy();
      expect(screen.getByLabelText('Transacoes')).toBeTruthy();
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
      expect(screen.getByText('Ultimas transacoes')).toBeTruthy();
    });
  });

  it('navigates through sidebar routes', async () => {
    const mockUser = { id: '1', nome: 'João Silva', email: 'joao@example.com' };
    const mockDashboard = makeDashboard();

    mockGetUser.mockResolvedValue(mockUser);
    mockGetDashboard.mockResolvedValue(mockDashboard);

    await renderDashboard();

    await waitFor(() => {
      const contasButton = screen.getByLabelText('Contas');
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

  it('opens full histories from collapsible dashboard panels', async () => {
    const mockUser = { id: '1', nome: 'JoÃ£o Silva', email: 'joao@example.com' };
    const mockDashboard = makeDashboard({
      gastosPorCategoria: [
        {
          categoriaId: '1',
          categoriaNome: 'Alimentacao',
          percentual: 100,
          total: 250,
        },
      ],
      totalContas: 1,
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
    });

    mockGetUser.mockResolvedValue(mockUser);
    mockGetDashboard.mockResolvedValue(mockDashboard);

    await renderDashboard();

    await waitFor(() => {
      fireEvent.press(screen.getByText('Historico categorias'));
      expect(mockPush).toHaveBeenCalledWith('/relatorios');

      fireEvent.press(screen.getByText('Historico transacoes'));
      expect(mockPush).toHaveBeenCalledWith('/transacoes');
    });
  });

  it('expands category and transaction panels on demand', async () => {
    const mockUser = { id: '1', nome: 'JoÃ£o Silva', email: 'joao@example.com' };
    const mockDashboard = makeDashboard({
      gastosPorCategoria: [
        {
          categoriaId: '1',
          categoriaNome: 'Alimentacao',
          percentual: 100,
          total: 250,
        },
      ],
      totalContas: 1,
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
    });

    mockGetUser.mockResolvedValue(mockUser);
    mockGetDashboard.mockResolvedValue(mockDashboard);

    await renderDashboard();

    await waitFor(() => {
      fireEvent.press(screen.getByLabelText('Alternar gastos por categoria'));
      expect(screen.getByText('R$ 250,00 (100%)')).toBeTruthy();

      fireEvent.press(screen.getByLabelText('Alternar ultimas transacoes'));
      expect(screen.getByText('Conta Corrente - 01/05/2026')).toBeTruthy();
    });
  });

  it('renders monthly budget and highlighted goal cards', async () => {
    const mockUser = { id: '1', nome: 'JoÃ£o Silva', email: 'joao@example.com' };
    const mockDashboard = makeDashboard({ totalContas: 1 });

    mockGetUser.mockResolvedValue(mockUser);
    mockGetDashboard.mockResolvedValue(mockDashboard);
    mockListOrcamentos.mockResolvedValue([
      {
        createdAt: '2026-05-01',
        gastoAtual: 400,
        id: 'orc-1',
        mesReferencia: '2026-05',
        percentualUtilizado: 40,
        restante: 600,
        statusAlerta: 'normal',
        updatedAt: '2026-05-01',
        usuarioId: '1',
        valorPlanejado: 1000,
      },
    ]);
    mockListMetas.mockResolvedValue([
      {
        ativa: true,
        contaId: null,
        createdAt: '2026-05-01',
        dividaId: null,
        fechaLimite: '2026-12-31',
        id: 'meta-1',
        montoActual: 250,
        montoObjetivo: 1000,
        nome: 'Viagem a Europa',
        tipo: 'economia',
        usuarioId: '1',
      },
    ]);

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Orcamento do mes')).toBeTruthy();
      expect(screen.getAllByText('R$ 1.000,00')).toHaveLength(2);
      expect(screen.getByText('R$ 400,00')).toBeTruthy();
      expect(screen.getByText('R$ 600,00')).toBeTruthy();
      expect(screen.getByText('Meta em destaque')).toBeTruthy();
      expect(screen.getByText('Viagem a Europa')).toBeTruthy();
      expect(screen.getByText('Falta R$ 750,00 · 25% completo')).toBeTruthy();
    });
  });

  it('opens budget and goal pages from planning cards', async () => {
    const mockUser = { id: '1', nome: 'JoÃ£o Silva', email: 'joao@example.com' };
    const mockDashboard = makeDashboard({ totalContas: 1 });

    mockGetUser.mockResolvedValue(mockUser);
    mockGetDashboard.mockResolvedValue(mockDashboard);

    await renderDashboard();

    await waitFor(() => {
      fireEvent.press(screen.getByText('Orcamentos'));
      expect(mockPush).toHaveBeenCalledWith('/orcamentos');

      fireEvent.press(screen.getByText('Metas'));
      expect(mockPush).toHaveBeenCalledWith('/metas');
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
