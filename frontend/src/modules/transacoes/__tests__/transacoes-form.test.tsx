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
jest.mock('@react-native-community/datetimepicker', () => {
  function MockDateTimePicker({
    onChange,
  }: {
    onChange: (event: { type: 'set' }, date: Date) => void;
  }) {
    const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <Pressable
        accessibilityLabel="Selecionar 07/04/2026"
        onPress={() => onChange({ type: 'set' }, new Date(2026, 3, 7, 12))}
      >
        <Text>Seletor de data nativo</Text>
      </Pressable>
    );
  }

  return { __esModule: true, default: MockDateTimePicker };
});

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

  it('renders form for creating new transaction with a working profile action', async () => {
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
      expect(screen.getByLabelText('Abrir ações rápidas')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Abrir perfil do usuário'));
    expect(mockPush).toHaveBeenCalledWith('/usuario');
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
      expect(screen.getByDisplayValue('01/05/2026')).toBeTruthy();
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
      fireEvent.changeText(screen.getByPlaceholderText('07/04/2026'), '07042026');

      fireEvent.press(salvarButton);
    });

    await waitFor(() => {
      expect(mockCreateTransacao).toHaveBeenCalledWith({
        tipo: 'despesa',
        contaId: '1',
        categoriaId: '1',
        valor: 50,
        data: '2026-04-07',
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

  it('uses the transaction type provided by quick actions', async () => {
    mockLocalSearchParams = { tipo: 'receita' };
    mockListContas.mockResolvedValue(makeFormContas());
    mockListCategorias.mockResolvedValue([
      makeCategoria({ id: '2', nome: 'Salario', tipo: 'receita' }),
    ]);
    mockCreateTransacao.mockResolvedValue(
      makeTransacao({ contaId: '1', categoriaId: '2', tipo: 'receita' }),
    );

    render(<TransacaoFormScreen />);

    await waitFor(() => {
      fireEvent.changeText(screen.getByPlaceholderText('0,00'), '1000');
      fireEvent.press(screen.getByText('Salvar transacao'));
    });

    await waitFor(() => {
      expect(mockCreateTransacao).toHaveBeenCalledWith(
        expect.objectContaining({ categoriaId: '2', tipo: 'receita' }),
      );
    });
  });

  it('clears the description when editing with blank text', async () => {
    const mockContas = makeFormContas();
    const mockCategorias = makeFormCategorias();
    const mockTransacao = makeFormTransacao();

    mockListContas.mockResolvedValue(mockContas);
    mockListCategorias.mockResolvedValue(mockCategorias);
    mockGetTransacaoById.mockResolvedValue(mockTransacao);
    mockUpdateTransacao.mockResolvedValue({ ...mockTransacao, descricao: null });
    mockLocalSearchParams = { id: '1' };

    render(<TransacaoFormScreen />);

    await waitFor(() => {
      fireEvent.changeText(screen.getByDisplayValue('Compra mercado'), '   ');
      fireEvent.press(screen.getByText('Salvar transacao'));
    });

    await waitFor(() => {
      expect(mockUpdateTransacao).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ descricao: null }),
      );
    });
  });

  it('preserves an inactive category when editing a transaction', async () => {
    const mockContas = makeFormContas();
    const activeCategory = makeCategoria({ id: 'active', nome: 'AlimentaÃ§Ã£o', tipo: 'despesa' });
    const mockTransacao = { ...makeFormTransacao(), categoriaId: 'inactive' };

    mockListContas.mockResolvedValue(mockContas);
    mockListCategorias.mockResolvedValue([activeCategory]);
    mockGetTransacaoById.mockResolvedValue(mockTransacao);
    mockUpdateTransacao.mockResolvedValue(mockTransacao);
    mockLocalSearchParams = { id: '1' };

    render(<TransacaoFormScreen />);

    await waitFor(() => {
      fireEvent.press(screen.getByText('Salvar transacao'));
    });

    await waitFor(() => {
      expect(mockUpdateTransacao).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ categoriaId: 'inactive' }),
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
      const dataInput = screen.getByPlaceholderText('07/04/2026');
      const salvarButton = screen.getByText('Salvar transacao');

      fireEvent.changeText(valorInput, '50,00');
      fireEvent.changeText(dataInput, '31022026');
      fireEvent.press(salvarButton);
    });

    await waitFor(() => {
      expect(
        screen.getByText('Informe uma data valida no formato DD/MM/AAAA. Ex.: 07/04/2026'),
      ).toBeTruthy();
      expect(mockCreateTransacao).not.toHaveBeenCalled();
    });
  });

  it('formats typed dates and accepts a date selected from the calendar', async () => {
    mockListContas.mockResolvedValue(makeFormContas());
    mockListCategorias.mockResolvedValue(makeFormCategorias());

    render(<TransacaoFormScreen />);

    await waitFor(() => {
      const dataInput = screen.getByPlaceholderText('07/04/2026');
      fireEvent.changeText(dataInput, '07042026');
      expect(screen.getByDisplayValue('07/04/2026')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Abrir calendario para selecionar a data'));
    fireEvent.press(screen.getByLabelText('Selecionar 07/04/2026'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('07/04/2026')).toBeTruthy();
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
