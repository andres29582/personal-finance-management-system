import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as authStorage from '../../../../storage/authStorage';
import { confirmAction } from '../../../../utils/confirm-action';
import { makeCategoria } from '../../../shared/test/builders';
import * as categoriaService from '../services/categoriaService';
import { CategoriasScreen } from '../screens/CategoriasScreen';

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

jest.mock('../services/categoriaService');
jest.mock('../../../../storage/authStorage');
jest.mock('../../../../utils/confirm-action');

const mockListCategorias = categoriaService.listCategorias as jest.MockedFunction<
  typeof categoriaService.listCategorias
>;
const mockDeactivateCategoria = categoriaService.deactivateCategoria as jest.MockedFunction<
  typeof categoriaService.deactivateCategoria
>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<
  typeof authStorage.clearSession
>;
const mockConfirmAction = confirmAction as jest.MockedFunction<typeof confirmAction>;
const categoria = makeCategoria({ id: 'categoria1', nome: 'Alimentacao', tipo: 'despesa' });

describe('CategoriasScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearSession.mockResolvedValue(undefined);
    mockConfirmAction.mockResolvedValue(true);
  });

  it('opens profile and creates from the global actions menu', async () => {
    mockListCategorias.mockResolvedValue([categoria]);

    render(<CategoriasScreen />);

    await waitFor(() => expect(screen.getByText('Alimentacao')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Abrir perfil do usuário'));
    expect(mockPush).toHaveBeenCalledWith('/usuario');

    fireEvent.press(screen.getByLabelText('Abrir ações rápidas'));
    fireEvent.press(screen.getByLabelText('Nova categoria'));
    expect(mockPush).toHaveBeenCalledWith('/categorias-form');
  });

  it('keeps edit and deactivate actions with the selected category', async () => {
    mockListCategorias.mockResolvedValue([categoria]);
    mockDeactivateCategoria.mockResolvedValue(undefined);

    render(<CategoriasScreen />);

    await waitFor(() => expect(screen.getByText('Editar')).toBeTruthy());

    fireEvent.press(screen.getByText('Editar'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/categorias-form',
      params: { id: 'categoria1' },
    });

    fireEvent.press(screen.getByText('Desativar'));

    await waitFor(() => {
      expect(mockConfirmAction).toHaveBeenCalledWith(
        'Desativar categoria',
        'Deseja desativar Alimentacao?',
      );
      expect(mockDeactivateCategoria).toHaveBeenCalledWith('categoria1');
      expect(mockListCategorias).toHaveBeenCalledTimes(2);
    });
  });

  it('redirects to login when loading fails with an unauthorized error', async () => {
    mockListCategorias.mockRejectedValue({
      response: { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } } },
    });

    render(<CategoriasScreen />);

    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });
});
