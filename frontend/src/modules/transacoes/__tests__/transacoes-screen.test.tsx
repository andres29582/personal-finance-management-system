import { act } from '@testing-library/react-native';
import { getSessionAuthority } from '../../auth/services/sessionAuthority';
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
jest.mock('../../auth/services/sessionAuthority', () => ({getSessionAuthority: require('@jest/globals').jest.fn(), subscribeSessionAuthority: () => () => {}}));
beforeEach(() => {
  jest.mocked(authStorage.getSessionGeneration).mockReturnValue(1);
  jest.mocked(authStorage.isLocallySignedOut).mockReturnValue(false);
  jest.mocked(getSessionAuthority).mockReturnValue({snapshot:{incarnation:'owner',sessionId:'session',generation:1}} as never);
});

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

  it('groups transactions by date and renders compact row semantics', async () => {
    mockSuccessfulLoad();

    render(<TransacoesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Transacoes')).toBeTruthy();
      expect(screen.getByText('01/05/2026')).toBeTruthy();
      expect(screen.getByText('Compra mercado')).toBeTruthy();
      expect(screen.getByText('Conta Corrente - Alimentacao')).toBeTruthy();
      expect(screen.getByText('- R$ 50,00')).toBeTruthy();
      expect(screen.getByText('Despesa')).toBeTruthy();
    });
  });

  it('applies type immediately and a valid month when the field loses focus', async () => {
    mockSuccessfulLoad();

    render(<TransacoesScreen />);

    await waitFor(() => {
      expect(mockListTransacoes).toHaveBeenCalledWith({
        mes: expect.any(String), limit: 50, offset: 0,
        tipo: undefined,
      });
    });

    fireEvent.press(screen.getByText('Receitas'));
    fireEvent.changeText(screen.getByPlaceholderText('2026-04'), '2026-06');

    await waitFor(() => {
      expect(mockListTransacoes).toHaveBeenLastCalledWith({
        mes: expect.any(String), limit: 50, offset: 0,
        tipo: 'receita',
      });
    });

    fireEvent(screen.getByPlaceholderText('2026-04'), 'blur');

    await waitFor(() => {
      expect(mockListTransacoes).toHaveBeenLastCalledWith({
        mes: '2026-06', limit: 50, offset: 0,
        tipo: 'receita',
      });
    });
  });

  it('renders inactive historical account and category labels without duplicate lookups', async () => {
    const contaHistorica = makeConta({ ativa: false, id: 'conta-historica', nome: 'Conta encerrada' });
    const categoriaHistorica = makeCategoria({
      ativa: false,
      id: 'categoria-historica',
      nome: 'Categoria arquivada',
      tipo: 'despesa',
    });
    const transacaoHistorica = makeTransacao({
      categoriaId: categoriaHistorica.id,
      contaId: contaHistorica.id,
      data: '2026-05-01',
      descricao: null,
      id: 'transacao-historica-1',
    });

    mockListContas.mockResolvedValue([conta]);
    mockListCategorias.mockResolvedValue([categoria]);
    mockListTransacoes.mockResolvedValue([
      transacaoHistorica,
      { ...transacaoHistorica, id: 'transacao-historica-2' },
    ]);
    mockGetContaById.mockResolvedValue(contaHistorica);
    mockGetCategoriaById.mockResolvedValue(categoriaHistorica);

    render(<TransacoesScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('Categoria arquivada')).toHaveLength(2);
      expect(screen.getAllByText('Conta encerrada - Categoria arquivada')).toHaveLength(2);
      expect(mockGetContaById).toHaveBeenCalledTimes(1);
      expect(mockGetContaById).toHaveBeenCalledWith('conta-historica');
      expect(mockGetCategoriaById).toHaveBeenCalledTimes(1);
      expect(mockGetCategoriaById).toHaveBeenCalledWith('categoria-historica');
    });
  });

  it('opens the profile, uses global quick actions, and opens the edit sheet', async () => {
    mockSuccessfulLoad();

    render(<TransacoesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Compra mercado')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Abrir perfil do usuário'));
    expect(mockPush).toHaveBeenCalledWith('/usuario');

    fireEvent.press(screen.getByLabelText('Abrir ações rápidas'));
    fireEvent.press(screen.getByLabelText('Nova despesa'));
    expect(mockPush).toHaveBeenCalledWith('/transacoes-form?tipo=despesa');

    fireEvent.press(screen.getByText('Compra mercado'));
    await waitFor(() => expect(screen.getByText('Editar')).toBeTruthy());
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
      expect(screen.getByText('Compra mercado')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Compra mercado'));
    await waitFor(() => expect(screen.getByText('Excluir')).toBeTruthy());
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
      response: { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } } },
    });
    mockListCategorias.mockResolvedValue([categoria]);
    mockListTransacoes.mockResolvedValue([]);

    render(<TransacoesScreen />);

    await waitFor(() => {
      expect(mockClearSession).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });
});

it('requests real pages and resets offset with a type filter', async () => {
  mockSuccessfulLoad();
  mockListTransacoes.mockResolvedValue(Array.from({length:50},(_,index)=>({...transacao,id:String(index)})));
  render(<TransacoesScreen />);
  await screen.findByText('Pagina 1');
  await waitFor(() => expect(screen.getByRole('button', {name: 'Proxima pagina'}).props.accessibilityState?.disabled ?? false).toBe(false));
  fireEvent.press(screen.getByText('Proxima pagina'));
  await waitFor(()=>expect(mockListTransacoes).toHaveBeenLastCalledWith(expect.objectContaining({limit:50,offset:50})));
  fireEvent.press(screen.getByText('Receitas'));
  await waitFor(()=>expect(mockListTransacoes).toHaveBeenLastCalledWith(expect.objectContaining({tipo:'receita',limit:50,offset:0})));
});

it('ignores historical labels completed after a newer filter request', async()=>{
  jest.clearAllMocks(); mockSuccessfulLoad();
  let finish: (value: typeof conta) => void = () => {};
  mockListTransacoes.mockResolvedValueOnce([{...transacao,contaId:'archived',descricao:'Obsolete transaction'}]).mockResolvedValue([{...transacao,descricao:'Current transaction'}]);
  mockGetContaById.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
  render(<TransacoesScreen/>);
  await waitFor(()=>expect(mockGetContaById).toHaveBeenCalledWith('archived'));
  fireEvent.press(screen.getByText('Receitas'));
  await screen.findByText('Current transaction');
  await act(async()=>finish({...conta,id:'archived'}));
  expect(screen.queryByText('Obsolete transaction')).toBeNull();
  expect(screen.getByText('Current transaction')).toBeTruthy();
});
