import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as authStorage from '../../../../storage/authStorage';
import { confirmAction } from '../../../../utils/confirm-action';
import * as metaService from '../services/metaService';
import { Meta } from '../types/meta';
import { MetasScreen } from '../screens/MetasScreen';

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

jest.mock('../services/metaService');
jest.mock('../../../../storage/authStorage');
jest.mock('../../../../utils/confirm-action');

const mockListMetas = metaService.listMetas as jest.MockedFunction<typeof metaService.listMetas>;
const mockDeactivateMeta = metaService.deactivateMeta as jest.MockedFunction<
  typeof metaService.deactivateMeta
>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<
  typeof authStorage.clearSession
>;
const mockConfirmAction = confirmAction as jest.MockedFunction<typeof confirmAction>;

const meta: Meta = {
  ativa: true,
  contaId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  dividaId: null,
  fechaLimite: '2026-12-31',
  id: 'meta-1',
  montoActual: 100,
  montoObjetivo: 1000,
  nome: 'Reserva',
  tipo: 'economia',
  usuarioId: 'usuario-1',
};

describe('MetasScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearSession.mockResolvedValue(undefined);
    mockConfirmAction.mockResolvedValue(true);
  });

  it('opens profile, creates globally and keeps contextual actions', async () => {
    mockListMetas.mockResolvedValue([meta]);
    mockDeactivateMeta.mockResolvedValue(undefined);

    render(<MetasScreen />);

    await waitFor(() => expect(screen.getByText('Reserva')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Abrir perfil do usuário'));
    expect(mockPush).toHaveBeenCalledWith('/usuario');

    fireEvent.press(screen.getByLabelText('Abrir ações rápidas'));
    fireEvent.press(screen.getByLabelText('Nova meta'));
    expect(mockPush).toHaveBeenCalledWith('/metas-form');

    fireEvent.press(screen.getByText('Editar'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/metas-form',
      params: { id: 'meta-1' },
    });

    fireEvent.press(screen.getByText('Desativar'));
    await waitFor(() => {
      expect(mockDeactivateMeta).toHaveBeenCalledWith('meta-1');
      expect(mockListMetas).toHaveBeenCalledTimes(2);
    });
  });

  it('redirects to login when loading fails with unauthorized error', async () => {
    mockListMetas.mockRejectedValue({
      response: { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } } },
    });

    render(<MetasScreen />);

    await waitFor(() => {
      expect(mockClearSession).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });
});
