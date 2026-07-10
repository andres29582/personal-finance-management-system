import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { DividasScreen } from '../screens/DividasScreen';
import * as dividaService from '../services/dividaService';
import * as authStorage from '../../../../storage/authStorage';
import { confirmAction } from '../../../../utils/confirm-action';
import { makeDivida } from '../../../shared/test/builders';

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

jest.mock('../services/dividaService');
jest.mock('../../../../storage/authStorage');
jest.mock('../../../../utils/confirm-action');

const mockListDividas = dividaService.listDividas as jest.MockedFunction<typeof dividaService.listDividas>;
const mockDeactivateDivida = dividaService.deactivateDivida as jest.MockedFunction<typeof dividaService.deactivateDivida>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<typeof authStorage.clearSession>;
const mockConfirmAction = confirmAction as jest.MockedFunction<typeof confirmAction>;

const divida = makeDivida({
  fechaInicio: '2026-05-01',
  fechaVencimiento: '2026-12-01',
  id: 'divida1',
  montoTotal: 5000,
  nome: 'Emprestimo banco',
});

describe('DividasScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearSession.mockResolvedValue(undefined);
    mockConfirmAction.mockResolvedValue(true);
  });

  it('renders debt data with total amount and dates', async () => {
    mockListDividas.mockResolvedValue([divida]);

    render(<DividasScreen />);

    await waitFor(() => {
      expect(screen.getByText('Emprestimo banco')).toBeTruthy();
      expect(screen.getByText('Valor total: R$ 5.000,00')).toBeTruthy();
      expect(screen.getByText('Inicio: 01/05/2026')).toBeTruthy();
      expect(screen.getByText('Vencimento: 01/12/2026')).toBeTruthy();
    });
  });

  it('navigates to create, edit and payment screens', async () => {
    mockListDividas.mockResolvedValue([divida]);

    render(<DividasScreen />);

    await waitFor(() => {
      expect(screen.getByText('Emprestimo banco')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Nova'));
    expect(mockPush).toHaveBeenCalledWith('/dividas-form');

    fireEvent.press(screen.getByText('Editar'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/dividas-form',
      params: { id: 'divida1' },
    });

    fireEvent.press(screen.getByText('Pagamentos'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/pagos-divida',
      params: { dividaId: 'divida1' },
    });
  });

  it('does not show payment action for inactive debt', async () => {
    mockListDividas.mockResolvedValue([
      makeDivida({
        ativa: false,
        id: 'divida-inativa',
        nome: 'Emprestimo encerrado',
      }),
    ]);

    render(<DividasScreen />);

    await waitFor(() => {
      expect(screen.getByText('Emprestimo encerrado')).toBeTruthy();
      expect(screen.getByText('Inativa')).toBeTruthy();
    });

    expect(screen.queryByText('Pagamentos')).toBeNull();
  });

  it('deactivates debt after confirmation and reloads list', async () => {
    mockListDividas.mockResolvedValue([divida]);
    mockDeactivateDivida.mockResolvedValue(undefined);

    render(<DividasScreen />);

    await waitFor(() => {
      expect(screen.getByText('Desativar')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Desativar'));

    await waitFor(() => {
      expect(mockConfirmAction).toHaveBeenCalledWith(
        'Desativar divida',
        'Deseja desativar Emprestimo banco?',
      );
      expect(mockDeactivateDivida).toHaveBeenCalledWith('divida1');
      expect(mockListDividas).toHaveBeenCalledTimes(2);
    });
  });

  it('redirects to login when loading fails with unauthorized error', async () => {
    mockListDividas.mockRejectedValue({
      response: { status: 401, data: { message: 'Unauthorized' } },
    });

    render(<DividasScreen />);

    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });
});
