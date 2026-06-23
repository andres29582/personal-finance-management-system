import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ContasScreen } from '../screens/ContasScreen';
import * as contaService from '../services/contaService';
import * as authStorage from '../../../../storage/authStorage';
import { confirmAction } from '../../../../utils/confirm-action';
import { makeConta } from '../../../shared/test/builders';

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

jest.mock('../services/contaService');
jest.mock('../../../../storage/authStorage');
jest.mock('../../../../utils/confirm-action');

const mockListContas = contaService.listContas as jest.MockedFunction<typeof contaService.listContas>;
const mockDeactivateConta = contaService.deactivateConta as jest.MockedFunction<typeof contaService.deactivateConta>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<typeof authStorage.clearSession>;
const mockConfirmAction = confirmAction as jest.MockedFunction<typeof confirmAction>;

const conta = makeConta({
  id: 'conta1',
  nome: 'Conta Corrente',
  saldoAtual: 1250,
  saldoInicial: 1000,
  tipo: 'banco',
});

describe('ContasScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearSession.mockResolvedValue(undefined);
    mockConfirmAction.mockResolvedValue(true);
  });

  it('renders account data with balance and account type', async () => {
    mockListContas.mockResolvedValue([conta]);

    render(<ContasScreen />);

    await waitFor(() => {
      expect(screen.getByText('Conta Corrente')).toBeTruthy();
      expect(screen.getByText('Banco')).toBeTruthy();
      expect(screen.getByText('R$ 1.250,00')).toBeTruthy();
      expect(screen.getByText('Saldo inicial: R$ 1.000,00')).toBeTruthy();
      expect(screen.getByText('Moeda: BRL')).toBeTruthy();
    });
  });

  it('navigates to create and edit account screens', async () => {
    mockListContas.mockResolvedValue([conta]);

    render(<ContasScreen />);

    await waitFor(() => {
      expect(screen.getByText('Conta Corrente')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Nova'));
    expect(mockPush).toHaveBeenCalledWith('/contas-create');

    fireEvent.press(screen.getByText('Editar'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/contas-edit',
      params: { id: 'conta1' },
    });
  });

  it('deactivates account after confirmation and reloads list', async () => {
    mockListContas.mockResolvedValue([conta]);
    mockDeactivateConta.mockResolvedValue(undefined);

    render(<ContasScreen />);

    await waitFor(() => {
      expect(screen.getByText('Desativar')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Desativar'));

    await waitFor(() => {
      expect(mockConfirmAction).toHaveBeenCalledWith(
        'Desativar conta',
        'Deseja desativar a conta Conta Corrente?',
      );
      expect(mockDeactivateConta).toHaveBeenCalledWith('conta1');
      expect(mockListContas).toHaveBeenCalledTimes(2);
    });
  });

  it('redirects to login when loading fails with unauthorized error', async () => {
    mockListContas.mockRejectedValue({
      response: { status: 401, data: { message: 'Unauthorized' } },
    });

    render(<ContasScreen />);

    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });
});
