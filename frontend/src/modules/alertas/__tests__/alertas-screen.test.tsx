import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as authStorage from '../../../../storage/authStorage';
import { confirmAction } from '../../../../utils/confirm-action';
import * as alertaService from '../services/alertaService';
import { Alerta } from '../types/alerta';
import { AlertasScreen } from '../screens/AlertasScreen';

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

jest.mock('../services/alertaService');
jest.mock('../../../../storage/authStorage');
jest.mock('../../../../utils/confirm-action');

const mockListAlertas = alertaService.listAlertas as jest.MockedFunction<
  typeof alertaService.listAlertas
>;
const mockDeactivateAlerta = alertaService.deactivateAlerta as jest.MockedFunction<
  typeof alertaService.deactivateAlerta
>;
const mockMarkAlertaAsNotified = alertaService.markAlertaAsNotified as jest.MockedFunction<
  typeof alertaService.markAlertaAsNotified
>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<
  typeof authStorage.clearSession
>;
const mockConfirmAction = confirmAction as jest.MockedFunction<typeof confirmAction>;

const alerta: Alerta = {
  ativa: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  diasAnticipacion: 3,
  id: 'alerta-1',
  referenciaId: 'meta-1',
  tipo: 'vencimento_meta',
  ultimaNotificacion: null,
  usuarioId: 'usuario-1',
};

describe('AlertasScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearSession.mockResolvedValue(undefined);
    mockConfirmAction.mockResolvedValue(true);
  });

  it('opens profile, creates globally and keeps contextual actions', async () => {
    mockListAlertas.mockResolvedValue([alerta]);
    mockMarkAlertaAsNotified.mockResolvedValue(undefined);
    mockDeactivateAlerta.mockResolvedValue(undefined);

    render(<AlertasScreen />);

    await waitFor(() => expect(screen.getByText('vencimento_meta')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Abrir perfil do usuário'));
    expect(mockPush).toHaveBeenCalledWith('/usuario');

    fireEvent.press(screen.getByLabelText('Abrir ações rápidas'));
    fireEvent.press(screen.getByLabelText('Novo alerta'));
    expect(mockPush).toHaveBeenCalledWith('/alertas-form');

    fireEvent.press(screen.getByText('Editar'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/alertas-form',
      params: { id: 'alerta-1' },
    });

    fireEvent.press(screen.getByText('Notificado'));
    await waitFor(() => expect(mockMarkAlertaAsNotified).toHaveBeenCalledWith('alerta-1'));

    fireEvent.press(screen.getByText('Desativar'));
    await waitFor(() => expect(mockDeactivateAlerta).toHaveBeenCalledWith('alerta-1'));
  });

  it('redirects to login when loading fails with unauthorized error', async () => {
    mockListAlertas.mockRejectedValue({
      response: { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } } },
    });

    render(<AlertasScreen />);

    await waitFor(() => {
      expect(mockClearSession).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });
});
