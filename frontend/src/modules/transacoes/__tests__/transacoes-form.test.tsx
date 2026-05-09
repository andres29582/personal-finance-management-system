import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TransacaoFormScreen } from '../screens/TransacaoFormScreen';
import * as categoriaService from '../../categorias/services/categoriaService';
import * as contaService from '../../contas/services/contaService';
import * as transacaoService from '../services/transacaoService';
import {
  makeCategoria,
  makeConta,
  makeTransacao,
} from '../../../shared/test/builders';

// Mock expo-router
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockLocalSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
    replace: mockReplace,
  }),
}));

// Mock services
jest.mock('../../categorias/services/categoriaService');
jest.mock('../../contas/services/contaService');
jest.mock('../services/transacaoService');

const mockListContas = contaService.listContas as jest.MockedFunction<typeof contaService.listContas>;
const mockListCategorias = categoriaService.listCategorias as jest.MockedFunction<typeof categoriaService.listCategorias>;
const mockCreateTransacao = transacaoService.createTransacao as jest.MockedFunction<typeof transacaoService.createTransacao>;
const mockUpdateTransacao = transacaoService.updateTransacao as jest.MockedFunction<typeof transacaoService.updateTransacao>;
const mockGetTransacaoById = transacaoService.getTransacaoById as jest.MockedFunction<typeof transacaoService.getTransacaoById>;

const makeFormContas = () => [
  makeConta({ id: '1', nome: 'Conta Corrente', saldoAtual: 1000 }),
];
const makeFormCategorias = () => [
  makeCategoria({ id: '1', nome: 'Alimentação', tipo: 'despesa' }),
];
const makeFormTransacao = () =>
  makeTransacao({
    id: '1',
    tipo: 'despesa',
    contaId: '1',
    categoriaId: '1',
    valor: 50,
    data: '2026-05-01',
    descricao: 'Compra mercado',
  });

describe('TransacaoFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = {};
  });

  it('renders form for creating new transaction', async () => {
    const mockContas = makeFormContas();
    const mockCategorias = makeFormCategorias();

    mockListContas.mockResolvedValue(mockContas);
    mockListCategorias.mockResolvedValue(mockCategorias);

    render(<TransacaoFormScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nova transacao')).toBeTruthy();
      expect(screen.getByText('Despesa')).toBeTruthy();
      expect(screen.getByText('Receita')).toBeTruthy();
      expect(screen.getByText('Salvar transacao')).toBeTruthy();
    });
  });

  it('loads data for editing existing transaction', async () => {
    const mockContas = makeFormContas();
    const mockCategorias = makeFormCategorias();
    const mockTransacao = makeFormTransacao();

    mockListContas.mockResolvedValue(mockContas);
    mockListCategorias.mockResolvedValue(mockCategorias);
    mockGetTransacaoById.mockResolvedValue(mockTransacao);

    mockLocalSearchParams = { id: '1' };

    render(<TransacaoFormScreen />);

    await waitFor(() => {
      expect(screen.getByText('Editar transacao')).toBeTruthy();
      expect(screen.getByDisplayValue('Compra mercado')).toBeTruthy();
    });
  });

  it('creates new transaction successfully', async () => {
    const mockContas = makeFormContas();
    const mockCategorias = makeFormCategorias();

    mockListContas.mockResolvedValue(mockContas);
    mockListCategorias.mockResolvedValue(mockCategorias);
    mockCreateTransacao.mockResolvedValue(makeFormTransacao());

    render(<TransacaoFormScreen />);

    await waitFor(() => {
      const descricaoInput = screen.getByPlaceholderText('Descricao da transacao');
      const valorInput = screen.getByPlaceholderText('0,00');
      const salvarButton = screen.getByText('Salvar transacao');

      fireEvent.changeText(descricaoInput, 'Compra mercado');
      fireEvent.changeText(valorInput, '50,00');

      fireEvent.press(salvarButton);
    });

    await waitFor(() => {
      expect(mockCreateTransacao).toHaveBeenCalledWith({
        tipo: 'despesa',
        contaId: '1',
        categoriaId: '1',
        valor: 50,
        data: expect.any(String),
        descricao: 'Compra mercado',
      });
      expect(mockReplace).toHaveBeenCalledWith('/transacoes');
    });
  });

  it('updates existing transaction successfully', async () => {
    const mockContas = makeFormContas();
    const mockCategorias = makeFormCategorias();
    const mockTransacao = makeFormTransacao();

    mockListContas.mockResolvedValue(mockContas);
    mockListCategorias.mockResolvedValue(mockCategorias);
    mockGetTransacaoById.mockResolvedValue(mockTransacao);
    mockUpdateTransacao.mockResolvedValue(mockTransacao);

    mockLocalSearchParams = { id: '1' };

    render(<TransacaoFormScreen />);

    await waitFor(() => {
      const descricaoInput = screen.getByDisplayValue('Compra mercado');
      const salvarButton = screen.getByText('Salvar transacao');

      fireEvent.changeText(descricaoInput, 'Compra mercado atualizada');
      fireEvent.press(salvarButton);
    });

    await waitFor(() => {
      expect(mockUpdateTransacao).toHaveBeenCalledWith('1', {
        tipo: 'despesa',
        contaId: '1',
        categoriaId: '1',
        valor: 50,
        data: '2026-05-01',
        descricao: 'Compra mercado atualizada',
      });
      expect(mockReplace).toHaveBeenCalledWith('/transacoes');
    });
  });

  it('shows validation errors for required fields', async () => {
    const mockContas = makeFormContas();
    const mockCategorias = makeFormCategorias();

    mockListContas.mockResolvedValue(mockContas);
    mockListCategorias.mockResolvedValue(mockCategorias);

    render(<TransacaoFormScreen />);

    await waitFor(() => {
      const salvarButton = screen.getByText('Salvar transacao');
      fireEvent.press(salvarButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Informe um valor valido. Ex.: 150,90')).toBeTruthy();
    });
  });

  it('shows error message on save failure', async () => {
    const mockContas = makeFormContas();
    const mockCategorias = makeFormCategorias();

    mockListContas.mockResolvedValue(mockContas);
    mockListCategorias.mockResolvedValue(mockCategorias);
    mockCreateTransacao.mockRejectedValue({
      response: { status: 400, data: { message: 'Invalid data' } },
    });

    render(<TransacaoFormScreen />);

    await waitFor(() => {
      const descricaoInput = screen.getByPlaceholderText('Descricao da transacao');
      const valorInput = screen.getByPlaceholderText('0,00');
      const salvarButton = screen.getByText('Salvar transacao');

      fireEvent.changeText(descricaoInput, 'Compra mercado');
      fireEvent.changeText(valorInput, '50,00');

      fireEvent.press(salvarButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Invalid data')).toBeTruthy();
    });
  });
});
