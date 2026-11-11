import { act } from '@testing-library/react-native';
import { getSessionAuthority } from '../../auth/services/sessionAuthority';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TransferenciasScreen } from '../screens/TransferenciasScreen';
import * as contaService from '../../contas/services/contaService';
import * as transferenciaService from '../services/transferenciaService';
import * as authStorage from '../../../../storage/authStorage';
import { confirmAction } from '../../../../utils/confirm-action';
import { makeConta, makeTransferencia } from '../../../shared/test/builders';

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

jest.mock('../../contas/services/contaService');
jest.mock('../services/transferenciaService');
jest.mock('../../../../storage/authStorage');
jest.mock('../../../../utils/confirm-action');
jest.mock('../../auth/services/sessionAuthority', () => ({getSessionAuthority: require('@jest/globals').jest.fn(), subscribeSessionAuthority: () => () => {}}));
beforeEach(() => {
  jest.mocked(authStorage.getSessionGeneration).mockReturnValue(1);
  jest.mocked(authStorage.isLocallySignedOut).mockReturnValue(false);
  jest.mocked(getSessionAuthority).mockReturnValue({snapshot:{incarnation:'owner',sessionId:'session',generation:1}} as never);
});

const mockListContas = contaService.listContas as jest.MockedFunction<typeof contaService.listContas>;
const mockListTransferencias = transferenciaService.listTransferencias as jest.MockedFunction<typeof transferenciaService.listTransferencias>;
const mockRemoveTransferencia = transferenciaService.removeTransferencia as jest.MockedFunction<typeof transferenciaService.removeTransferencia>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<typeof authStorage.clearSession>;
const mockConfirmAction = confirmAction as jest.MockedFunction<typeof confirmAction>;

const contaOrigem = makeConta({ id: 'conta1', nome: 'Conta Corrente' });
const contaDestino = makeConta({ id: 'conta2', nome: 'Poupanca' });
const transferencia = makeTransferencia({
  contaDestinoId: 'conta2',
  contaOrigemId: 'conta1',
  data: '2026-05-01',
  descricao: 'Reserva mensal',
  id: 'transferencia1',
  valor: 200,
});

function mockSuccessfulLoad() {
  mockListContas.mockResolvedValue([contaOrigem, contaDestino]);
  mockListTransferencias.mockResolvedValue([transferencia]);
}

describe('TransferenciasScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearSession.mockResolvedValue(undefined);
    mockConfirmAction.mockResolvedValue(true);
  });

  it('renders transfer data with source, destination and amount', async () => {
    mockSuccessfulLoad();

    render(<TransferenciasScreen />);

    await waitFor(() => {
      expect(screen.getByText('Reserva mensal')).toBeTruthy();
      expect(screen.getByText('Conta Corrente -> Poupanca')).toBeTruthy();
      expect(screen.getByText('01/05/2026')).toBeTruthy();
      expect(screen.getByText('Comissao: R$ 0,00')).toBeTruthy();
      expect(screen.getByText('R$ 200,00')).toBeTruthy();
    });
  });

  it('opens profile, creates from global actions and edits contextually', async () => {
    mockSuccessfulLoad();

    render(<TransferenciasScreen />);

    await waitFor(() => {
      expect(screen.getByText('Reserva mensal')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Abrir perfil do usuário'));
    expect(mockPush).toHaveBeenCalledWith('/usuario');

    fireEvent.press(screen.getByLabelText('Abrir ações rápidas'));
    fireEvent.press(screen.getByLabelText('Transferência'));
    expect(mockPush).toHaveBeenCalledWith('/transferencias-form');

    fireEvent.press(screen.getByText('Editar'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transferencias-form',
      params: { id: 'transferencia1' },
    });
  });

  it('removes transfer after confirmation and reloads list', async () => {
    mockSuccessfulLoad();
    mockRemoveTransferencia.mockResolvedValue(undefined);

    render(<TransferenciasScreen />);

    await waitFor(() => {
      expect(screen.getByText('Excluir')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Excluir'));

    await waitFor(() => {
      expect(mockConfirmAction).toHaveBeenCalledWith(
        'Excluir transferencia',
        'Deseja remover esta transferencia?',
      );
      expect(mockRemoveTransferencia).toHaveBeenCalledWith('transferencia1');
      expect(mockListTransferencias).toHaveBeenCalledTimes(2);
    });
  });

  it('redirects to login when loading fails with unauthorized error', async () => {
    mockListContas.mockRejectedValue({
      response: { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } } },
    });
    mockListTransferencias.mockResolvedValue([]);

    render(<TransferenciasScreen />);

    await waitFor(() => {
      expect(mockClearSession).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });
});

it('requests a bounded next page and retreats when deleting its last row', async () => {
  jest.clearAllMocks(); mockListTransferencias.mockReset(); mockConfirmAction.mockResolvedValue(true);
  mockSuccessfulLoad();
  mockListTransferencias.mockResolvedValueOnce(Array.from({length:50},(_,index)=>({...transferencia,id:String(index)}))).mockResolvedValueOnce([transferencia]).mockResolvedValueOnce([]).mockResolvedValue([transferencia]);
  mockRemoveTransferencia.mockResolvedValue(undefined);
  render(<TransferenciasScreen />);
  await screen.findByText('Pagina 1');
  await waitFor(() => expect(screen.getByRole('button', {name: 'Proxima pagina'}).props.accessibilityState?.disabled ?? false).toBe(false));
  fireEvent.press(screen.getByText('Proxima pagina'));
  await screen.findByText('Pagina 2');
  await waitFor(()=>expect(screen.getAllByText('Excluir')).toHaveLength(1));
  fireEvent.press(screen.getByText('Excluir'));
  await waitFor(()=>expect(mockListTransferencias).toHaveBeenLastCalledWith({limit:50,offset:0}));
  await screen.findByText('Pagina 1');
});

it('ignores a failed load completed after focus cleanup', async()=>{
  jest.clearAllMocks(); mockListTransferencias.mockReset(); mockSuccessfulLoad();
  let reject: (error:unknown)=>void=()=>{};
  mockListTransferencias.mockReturnValueOnce(new Promise((_,fail)=>{reject=fail;}));
  const view=render(<TransferenciasScreen/>);
  await waitFor(()=>expect(mockListTransferencias).toHaveBeenCalled());view.unmount();
  await act(async()=>reject({response:{status:401}}));
  expect(mockReplace).not.toHaveBeenCalled();
});
