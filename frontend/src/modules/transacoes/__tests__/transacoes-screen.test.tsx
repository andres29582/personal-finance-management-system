import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TransacoesScreen } from '../screens/TransacoesScreen';
import * as categoriaService from '../../categorias/services/categoriaService';
import * as contaService from '../../contas/services/contaService';
import * as transacaoService from '../services/transacaoService';
import { Transacao } from '../types/transacao';
import * as authStorage from '../../../../storage/authStorage';
import { confirmAction } from '../../../../utils/confirm-action';
import {
  makeCategoria,
  makeConta,
  makeTransacao,
} from '../../../shared/test/builders';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
let mockFocusCallback: (() => void) | undefined;

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: (callback: () => void) => {
      mockFocusCallback = callback;
      React.useEffect(callback, [callback]);
    },
    useRouter: () => mockRouter,
  };
});

jest.mock('../../categorias/services/categoriaService');
jest.mock('../../contas/services/contaService');
jest.mock('../services/transacaoService');
jest.mock('../../../../storage/authStorage');
jest.mock('../../../../utils/confirm-action');

const mockListContas = contaService.listContas as jest.MockedFunction<typeof contaService.listContas>;
const mockGetContaById = contaService.getContaById as jest.MockedFunction<typeof contaService.getContaById>;
const mockListCategorias = categoriaService.listCategorias as jest.MockedFunction<typeof categoriaService.listCategorias>;
const mockGetCategoriaById = categoriaService.getCategoriaById as jest.MockedFunction<typeof categoriaService.getCategoriaById>;
const mockListTransacoes = transacaoService.listTransacoes as jest.MockedFunction<typeof transacaoService.listTransacoes>;
const mockRemoveTransacao = transacaoService.removeTransacao as jest.MockedFunction<typeof transacaoService.removeTransacao>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<typeof authStorage.clearSession>;
const mockConfirmAction = confirmAction as jest.MockedFunction<typeof confirmAction>;

const conta = makeConta({ id: 'conta1', nome: 'Conta Corrente' });
const categoria = makeCategoria({ id: 'cat1', nome: 'Alimentacao', tipo: 'despesa' });
const transacao = makeTransacao({
  categoriaId: categoria.id,
  contaId: conta.id,
  data: '2026-05-01',
  descricao: 'Compra mercado',
  id: 'transacao1',
  tipo: 'despesa',
  valor: 50,
});

function mockSuccessfulLoad() {
  mockListContas.mockResolvedValue([conta]);
  mockListCategorias.mockResolvedValue([categoria]);
  mockListTransacoes.mockResolvedValue([transacao]);
}

describe('TransacoesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearSession.mockResolvedValue(undefined);
    mockConfirmAction.mockResolvedValue(true);
  });

  it('uses the local month for the initial API query at a UTC year boundary', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2027-01-01T02:30:00.000Z'));
      mockSuccessfulLoad();
      render(<TransacoesScreen />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('2026-12')).toBeTruthy();
        expect(mockListTransacoes).toHaveBeenCalledWith({ mes: '2026-12', tipo: undefined });
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('renders transactions with category, account and formatted amount', async () => {
    mockSuccessfulLoad();

    render(<TransacoesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Transacoes')).toBeTruthy();
      expect(screen.getByText('Compra mercado')).toBeTruthy();
      expect(screen.getByText('01/05/2026 - Alimentacao')).toBeTruthy();
      expect(screen.getByText('Conta: Conta Corrente')).toBeTruthy();
      expect(screen.getByText('R$ 50,00')).toBeTruthy();
      expect(screen.getByText('Despesa')).toBeTruthy();
    });
  });

  it('loads inactive historical labels once per missing reference', async () => {
    const oldAccount = makeConta({ ativa: false, id: 'old-account', nome: 'Conta encerrada' });
    const oldCategory = makeCategoria({ ativa: false, id: 'old-category', nome: 'Categoria arquivada' });
    const oldTransaction = makeTransacao({
      categoriaId: oldCategory.id,
      contaId: oldAccount.id,
      descricao: null,
      id: 'old-transaction-1',
    });
    mockListContas.mockResolvedValue([conta]);
    mockListCategorias.mockResolvedValue([categoria]);
    mockListTransacoes.mockResolvedValue([
      oldTransaction,
      { ...oldTransaction, id: 'old-transaction-2' },
    ]);
    mockGetContaById.mockResolvedValue(oldAccount);
    mockGetCategoriaById.mockResolvedValue(oldCategory);

    render(<TransacoesScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Categoria arquivada')).toHaveLength(2);
      expect(screen.getAllByText('Conta: Conta encerrada')).toHaveLength(2);
    });
    expect(mockGetContaById).toHaveBeenCalledTimes(1);
    expect(mockGetContaById).toHaveBeenCalledWith(oldAccount.id);
    expect(mockGetCategoriaById).toHaveBeenCalledTimes(1);
    expect(mockGetCategoriaById).toHaveBeenCalledWith(oldCategory.id);
  });

  it('keeps transactions and fallback labels when historical lookups fail', async () => {
    const oldTransaction = makeTransacao({
      categoriaId: 'missing-category',
      contaId: 'missing-account',
      descricao: null,
      id: 'old-transaction',
    });
    mockListContas.mockResolvedValue([conta]);
    mockListCategorias.mockResolvedValue([categoria]);
    mockListTransacoes.mockResolvedValue([oldTransaction]);
    mockGetContaById.mockRejectedValue(new Error('Account not found'));
    mockGetCategoriaById.mockRejectedValue(new Error('Category not found'));

    render(<TransacoesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Conta: -')).toBeTruthy();
      expect(screen.getByText('Transacao')).toBeTruthy();
      expect(screen.getByText(/Categoria$/)).toBeTruthy();
      expect(screen.queryByText('Nao foi possivel carregar as transacoes')).toBeNull();
    });
  });

  it('still surfaces a failed transaction-list request', async () => {
    mockListContas.mockResolvedValue([conta]);
    mockListCategorias.mockResolvedValue([categoria]);
    mockListTransacoes.mockRejectedValue(new Error('List failed'));

    render(<TransacoesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nao foi possivel carregar as transacoes')).toBeTruthy();
      expect(screen.getByText('Nao foi possivel carregar as transacoes.')).toBeTruthy();
    });
  });

  it('fetches only applied filters, including after focus refresh', async () => {
    mockSuccessfulLoad();

    render(<TransacoesScreen />);

    await waitFor(() => {
      expect(mockListTransacoes).toHaveBeenCalledWith({
        mes: expect.any(String),
        tipo: undefined,
      });
    });

    fireEvent.press(screen.getByText('Receitas'));
    fireEvent.changeText(screen.getByPlaceholderText('2026-04'), '2026-06');
    expect(mockListTransacoes).toHaveBeenCalledTimes(1);

    act(() => mockFocusCallback?.());
    await waitFor(() => expect(mockListTransacoes).toHaveBeenCalledTimes(2));
    expect(mockListTransacoes).toHaveBeenLastCalledWith({
      mes: expect.any(String),
      tipo: undefined,
    });

    fireEvent.press(screen.getByText('Aplicar filtros'));

    await waitFor(() => {
      expect(mockListTransacoes).toHaveBeenLastCalledWith({
        mes: '2026-06',
        tipo: 'receita',
      });
      expect(mockListTransacoes).toHaveBeenCalledTimes(3);
    });

    fireEvent.press(screen.getByText('Aplicar filtros'));
    expect(mockListTransacoes).toHaveBeenCalledTimes(3);

    fireEvent.press(screen.getByText('Despesas'));
    fireEvent.changeText(screen.getByPlaceholderText('2026-04'), '2026-07');
    act(() => mockFocusCallback?.());
    await waitFor(() => expect(mockListTransacoes).toHaveBeenCalledTimes(4));
    expect(mockListTransacoes).toHaveBeenLastCalledWith({ mes: '2026-06', tipo: 'receita' });
  });

  it('keeps newer filter results when an older request finishes last', async () => {
    mockSuccessfulLoad();
    render(<TransacoesScreen />);
    await waitFor(() => expect(mockListTransacoes).toHaveBeenCalledTimes(1));

    let resolveSlow!: (transactions: Transacao[]) => void;
    mockListTransacoes.mockReturnValueOnce(new Promise((resolve) => { resolveSlow = resolve; }));
    mockListTransacoes.mockResolvedValueOnce([
      makeTransacao({ ...transacao, id: 'newer', descricao: 'Newer transaction' }),
    ]);

    fireEvent.changeText(screen.getByPlaceholderText('2026-04'), '2026-06');
    fireEvent.press(screen.getByText('Aplicar filtros'));
    await waitFor(() => expect(mockListTransacoes).toHaveBeenCalledTimes(2));

    fireEvent.changeText(screen.getByPlaceholderText('2026-04'), '2026-07');
    fireEvent.press(screen.getByText('Aplicar filtros'));
    await waitFor(() => expect(screen.getByText('Newer transaction')).toBeTruthy());

    await act(async () => {
      resolveSlow([makeTransacao({ ...transacao, id: 'older', descricao: 'Stale transaction' })]);
    });
    expect(screen.getByText('Newer transaction')).toBeTruthy();
    expect(screen.queryByText('Stale transaction')).toBeNull();
  });

  it('navigates to create and edit transaction screens', async () => {
    mockSuccessfulLoad();

    render(<TransacoesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Compra mercado')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Nova'));
    expect(mockPush).toHaveBeenCalledWith('/transacoes-form');

    fireEvent.press(screen.getByText('Editar'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transacoes-form',
      params: { id: 'transacao1' },
    });
  });

  it('removes transaction after confirmation and reloads data', async () => {
    mockSuccessfulLoad();
    mockRemoveTransacao.mockResolvedValue(undefined);

    render(<TransacoesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Excluir')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Receitas'));
    fireEvent.changeText(screen.getByPlaceholderText('2026-04'), '2026-06');
    fireEvent.press(screen.getByText('Aplicar filtros'));
    await waitFor(() => expect(mockListTransacoes).toHaveBeenCalledTimes(2));
    fireEvent.press(screen.getByText('Despesas'));
    fireEvent.changeText(screen.getByPlaceholderText('2026-04'), '2026-07');

    fireEvent.press(screen.getByText('Excluir'));

    await waitFor(() => {
      expect(mockConfirmAction).toHaveBeenCalledWith(
        'Excluir transacao',
        'Deseja remover esta transacao?',
      );
      expect(mockRemoveTransacao).toHaveBeenCalledWith('transacao1');
      expect(mockListTransacoes).toHaveBeenCalledTimes(3);
      expect(mockListTransacoes).toHaveBeenLastCalledWith({
        mes: '2026-06',
        tipo: 'receita',
      });
    });
  });

  it('reloads current filters when an in-flight deletion finishes after Apply', async () => {
    mockSuccessfulLoad();
    let resolveDelete!: () => void;
    mockRemoveTransacao.mockReturnValue(new Promise<void>((resolve) => { resolveDelete = resolve; }));

    render(<TransacoesScreen />);
    await waitFor(() => expect(screen.getByText('Excluir')).toBeTruthy());

    fireEvent.press(screen.getByText('Excluir'));
    await waitFor(() => expect(mockRemoveTransacao).toHaveBeenCalledWith('transacao1'));

    fireEvent.press(screen.getByText('Receitas'));
    fireEvent.changeText(screen.getByPlaceholderText('2026-04'), '2026-06');
    fireEvent.press(screen.getByText('Aplicar filtros'));
    await waitFor(() => expect(mockListTransacoes).toHaveBeenCalledTimes(2));

    await act(async () => resolveDelete());
    await waitFor(() => expect(mockListTransacoes).toHaveBeenCalledTimes(3));
    expect(mockListTransacoes).toHaveBeenLastCalledWith({ mes: '2026-06', tipo: 'receita' });
  });

  it('redirects to login when loading fails with unauthorized error', async () => {
    mockListContas.mockRejectedValue({
      response: { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } } },
    });
    mockListCategorias.mockResolvedValue([categoria]);
    mockListTransacoes.mockResolvedValue([]);

    render(<TransacoesScreen />);

    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });
});
