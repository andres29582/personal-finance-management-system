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
const mockGetCategoriaById = categoriaService.getCategoriaById as jest.MockedFunction<typeof categoriaService.getCategoriaById>;
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
    mockGetCategoriaById.mockReset();
    mockLocalSearchParams = {};
  });

  it('submits the local default date without converting the civil API date', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2027-01-01T02:30:00.000Z'));
      mockListContas.mockResolvedValue(makeFormContas());
      mockListCategorias.mockResolvedValue(makeFormCategorias());
      mockCreateTransacao.mockResolvedValue(makeFormTransacao());

      render(<TransacaoFormScreen />);
      await waitFor(() => expect(screen.getByDisplayValue('2026-12-31')).toBeTruthy());
      fireEvent.changeText(screen.getByPlaceholderText('0,00'), '50,00');
      fireEvent.press(screen.getByText('Salvar transacao'));

      await waitFor(() => expect(mockCreateTransacao).toHaveBeenCalledWith({
        tipo: 'despesa',
        contaId: '1',
        categoriaId: '1',
        valor: 50,
        data: '2026-12-31',
      }));
    } finally {
      jest.useRealTimers();
    }
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

  it('omits a blank description when creating a transaction', async () => {
    mockListContas.mockResolvedValue(makeFormContas());
    mockListCategorias.mockResolvedValue(makeFormCategorias());
    mockCreateTransacao.mockResolvedValue(makeFormTransacao());

    render(<TransacaoFormScreen />);

    await waitFor(() => expect(screen.getByText('Salvar transacao')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('0,00'), '50,00');
    fireEvent.press(screen.getByText('Salvar transacao'));

    await waitFor(() => expect(mockCreateTransacao).toHaveBeenCalledTimes(1));
    expect(mockCreateTransacao.mock.calls[0][0]).not.toHaveProperty('descricao');
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

  it('clears the description when editing with blank text', async () => {
    const mockTransacao = makeFormTransacao();
    mockListContas.mockResolvedValue(makeFormContas());
    mockListCategorias.mockResolvedValue(makeFormCategorias());
    mockGetTransacaoById.mockResolvedValue(mockTransacao);
    mockUpdateTransacao.mockResolvedValue({ ...mockTransacao, descricao: null });
    mockLocalSearchParams = { id: '1' };

    render(<TransacaoFormScreen />);

    await waitFor(() => expect(screen.getByDisplayValue('Compra mercado')).toBeTruthy());
    fireEvent.changeText(screen.getByDisplayValue('Compra mercado'), '   ');
    fireEvent.press(screen.getByText('Salvar transacao'));

    await waitFor(() => {
      expect(mockUpdateTransacao).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ descricao: null }),
      );
    });
  });

  it('preserves an inactive category when editing a transaction', async () => {
    const mockTransacao = { ...makeFormTransacao(), categoriaId: 'inactive' };
    const historicalCategory = makeCategoria({
      ativa: false,
      id: 'inactive',
      nome: 'Historica',
      tipo: 'despesa',
    });

    mockListContas.mockResolvedValue(makeFormContas());
    mockListCategorias.mockResolvedValue(makeFormCategorias());
    mockGetCategoriaById.mockResolvedValue(historicalCategory);
    mockGetTransacaoById.mockResolvedValue(mockTransacao);
    mockUpdateTransacao.mockResolvedValue(mockTransacao);
    mockLocalSearchParams = { id: '1' };

    render(<TransacaoFormScreen />);

    await waitFor(() => {
      expect(screen.getByText('Historica (inativa)')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Historica (inativa)' }).props.accessibilityState).toEqual({
      disabled: false,
      selected: true,
    });
    expect(mockGetCategoriaById).toHaveBeenCalledWith('inactive');
    fireEvent.press(screen.getByText('Salvar transacao'));

    await waitFor(() => {
      expect(mockUpdateTransacao).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ categoriaId: 'inactive' }),
      );
    });
  });

  it('selects an active compatible category when changing type in edit mode', async () => {
    const mockTransacao = { ...makeFormTransacao(), categoriaId: 'inactive' };
    mockListContas.mockResolvedValue(makeFormContas());
    mockListCategorias.mockResolvedValue([
      ...makeFormCategorias(),
      makeCategoria({ id: 'income', nome: 'Salario', tipo: 'receita' }),
    ]);
    mockGetCategoriaById.mockResolvedValue(
      makeCategoria({ ativa: false, id: 'inactive', nome: 'Historica', tipo: 'despesa' }),
    );
    mockGetTransacaoById.mockResolvedValue(mockTransacao);
    mockUpdateTransacao.mockResolvedValue(mockTransacao);
    mockLocalSearchParams = { id: '1' };

    render(<TransacaoFormScreen />);

    await waitFor(() => expect(screen.getByText('Historica (inativa)')).toBeTruthy());
    fireEvent.press(screen.getByText('Receita'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Salario' }).props.accessibilityState.selected).toBe(true);
    });
    fireEvent.press(screen.getByText('Salvar transacao'));

    await waitFor(() => {
      expect(mockUpdateTransacao).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ categoriaId: 'income', tipo: 'receita' }),
      );
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

  it('shows a specific validation error for invalid date', async () => {
    const mockContas = makeFormContas();
    const mockCategorias = makeFormCategorias();

    mockListContas.mockResolvedValue(mockContas);
    mockListCategorias.mockResolvedValue(mockCategorias);

    render(<TransacaoFormScreen />);

    await waitFor(() => {
      const valorInput = screen.getByPlaceholderText('0,00');
      const dataInput = screen.getByPlaceholderText('2026-04-07');
      const salvarButton = screen.getByText('Salvar transacao');

      fireEvent.changeText(valorInput, '50,00');
      fireEvent.changeText(dataInput, '2026-99-99');
      fireEvent.press(salvarButton);
    });

    await waitFor(() => {
      expect(
        screen.getByText('Informe uma data valida no formato YYYY-MM-DD. Ex.: 2026-04-07'),
      ).toBeTruthy();
      expect(mockCreateTransacao).not.toHaveBeenCalled();
    });
  });

  it('shows error message on save failure', async () => {
    const mockContas = makeFormContas();
    const mockCategorias = makeFormCategorias();

    mockListContas.mockResolvedValue(mockContas);
    mockListCategorias.mockResolvedValue(mockCategorias);
    mockCreateTransacao.mockRejectedValue({
      response: { status: 400, data: { error: { code: 'CATEGORIA_INACTIVE', message: 'Não é possível realizar operações financeiras com uma categoria inativa.' } } },
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
      expect(
        screen.getByText(
          'Não é possível realizar operações financeiras com uma categoria inativa.',
        ),
      ).toBeTruthy();
    });
  });
});
