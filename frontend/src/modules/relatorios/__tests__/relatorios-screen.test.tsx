import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { RelatoriosScreen } from '../screens/RelatoriosScreen';
import * as categoriaService from '../../categorias/services/categoriaService';
import * as contaService from '../../contas/services/contaService';
import * as relatorioService from '../services/relatorioService';
import * as authStorage from '../../../../storage/authStorage';
import {
  makeCategoria,
  makeConta,
  makeRelatorio,
} from '../../../shared/test/builders';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('../components/RelatorioGestaoCharts', () => ({
  RelatorioGestaoCharts: () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Graficos do relatorio</Text>;
  },
}));

jest.mock('../../categorias/services/categoriaService');
jest.mock('../../contas/services/contaService');
jest.mock('../services/relatorioService');
jest.mock('../../../../storage/authStorage');

const mockListCategorias = categoriaService.listCategorias as jest.MockedFunction<typeof categoriaService.listCategorias>;
const mockListContas = contaService.listContas as jest.MockedFunction<typeof contaService.listContas>;
const mockGetRelatorio = relatorioService.getRelatorio as jest.MockedFunction<typeof relatorioService.getRelatorio>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<typeof authStorage.clearSession>;

const conta = makeConta({ id: 'conta1', nome: 'Conta Corrente' });
const categoria = makeCategoria({ id: 'cat1', nome: 'Alimentacao' });
const relatorio = makeRelatorio({
  despesasPorCategoria: [
    {
      categoriaId: 'cat1',
      categoriaNome: 'Alimentacao',
      percentual: 100,
      total: 300,
    },
  ],
  periodo: 'mensal',
  periodoReferencia: '2026-06',
  resumo: {
    economia: 2000,
    totalDespesas: 3000,
    totalReceitas: 5000,
    totalTransacoes: 1,
  },
  transacoes: [
    {
      categoriaId: 'cat1',
      categoriaNome: 'Alimentacao',
      contaId: 'conta1',
      contaNome: 'Conta Corrente',
      data: '2026-06-01',
      descricao: 'Mercado',
      id: 'transacao1',
      tipo: 'despesa',
      valor: 300,
    },
  ],
});

describe('RelatoriosScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearSession.mockResolvedValue(undefined);
    mockListCategorias.mockResolvedValue([categoria]);
    mockListContas.mockResolvedValue([conta]);
    mockGetRelatorio.mockResolvedValue(relatorio);
  });

  it('renders report summary, category totals and transactions', async () => {
    render(<RelatoriosScreen />);

    await waitFor(() => {
      expect(screen.getByText('Relatorios')).toBeTruthy();
      expect(screen.getByText('2026-06')).toBeTruthy();
      expect(screen.getByText('R$ 5.000,00')).toBeTruthy();
      expect(screen.getByText('R$ 3.000,00')).toBeTruthy();
      expect(screen.getByText('R$ 2.000,00')).toBeTruthy();
      expect(screen.getByText('Alimentacao: R$ 300,00 (100%)')).toBeTruthy();
      expect(screen.getByText('Mercado')).toBeTruthy();
      expect(screen.getByText('Conta Corrente - 01/06/2026 - despesa')).toBeTruthy();
    });
  });

  it('generates report with selected type, account and category filters', async () => {
    render(<RelatoriosScreen />);

    await waitFor(() => {
      expect(mockGetRelatorio).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(screen.getAllByText('Despesas')[0]);
    fireEvent.press(screen.getByText('Conta Corrente'));
    fireEvent.press(screen.getByText('Alimentacao'));
    fireEvent.press(screen.getByText('Gerar relatorio'));

    await waitFor(() => {
      expect(mockGetRelatorio).toHaveBeenLastCalledWith({
        categoriaId: 'cat1',
        contaId: 'conta1',
        mes: expect.any(String),
        periodo: 'mensal',
        tipo: 'despesa',
      });
    });
  });

  it('redirects to login when report generation returns unauthorized', async () => {
    mockGetRelatorio.mockRejectedValue({
      response: { status: 401, data: { message: 'Unauthorized' } },
    });

    render(<RelatoriosScreen />);

    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });
});
