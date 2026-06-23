import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TransacoesScreen } from '../screens/TransacoesScreen';
import * as categoriaService from '../../categorias/services/categoriaService';
import * as contaService from '../../contas/services/contaService';
import * as transacaoService from '../services/transacaoService';
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

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: (callback: () => void) => {
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
const mockListCategorias = categoriaService.listCategorias as jest.MockedFunction<typeof categoriaService.listCategorias>;
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

  it('applies selected type filter when user presses filter button', async () => {
    mockSuccessfulLoad();

    render(<TransacoesScreen />);

    await waitFor(() => {
      expect(mockListTransacoes).toHaveBeenCalledWith({
        mes: expect.any(String),
        tipo: undefined,
      });
    });

    fireEvent.press(screen.getByText('Receitas'));
    fireEvent.press(screen.getByText('Aplicar filtros'));

    await waitFor(() => {
      expect(mockListTransacoes).toHaveBeenLastCalledWith({
        mes: expect.any(String),
        tipo: 'receita',
      });
    });
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

    fireEvent.press(screen.getByText('Excluir'));

    await waitFor(() => {
      expect(mockConfirmAction).toHaveBeenCalledWith(
        'Excluir transacao',
        'Deseja remover esta transacao?',
      );
      expect(mockRemoveTransacao).toHaveBeenCalledWith('transacao1');
      expect(mockListTransacoes).toHaveBeenCalledTimes(2);
    });
  });

  it('redirects to login when loading fails with unauthorized error', async () => {
    mockListContas.mockRejectedValue({
      response: { status: 401, data: { message: 'Unauthorized' } },
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
