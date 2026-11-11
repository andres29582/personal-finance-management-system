import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as authStorage from '../../../../storage/authStorage';
import { UsuarioScreen } from '../screens/UsuarioScreen';
import * as userService from '../services/userService';
import { UserProfile } from '../types/user';

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

jest.mock('../services/userService');
jest.mock('../../../../storage/authStorage');
jest.mock('../../../shared/hooks/use-cep-autofill', () => ({
  useCepAutofill: () => ({
    cepLookupLoading: false,
    cepLookupMessage: '',
    cepLookupTone: 'muted',
    handleCepValueChange: (value: string) => value,
  }),
}));

const mockGetProfile = userService.getCurrentUserProfile as jest.MockedFunction<
  typeof userService.getCurrentUserProfile
>;
const mockUpdateProfile = userService.updateCurrentUserProfile as jest.MockedFunction<
  typeof userService.updateCurrentUserProfile
>;
const mockSaveUser = authStorage.saveUser as jest.MockedFunction<typeof authStorage.saveUser>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<
  typeof authStorage.clearSession
>;

const profile: UserProfile = {
  cep: '01001-000',
  cidade: 'Sao Paulo',
  cpf: '12345678901',
  dataRegistro: '2026-01-01',
  email: 'user@example.com',
  endereco: 'Rua Teste',
  id: 'usuario-1',
  moedaPadrao: 'BRL',
  nome: 'Usuario Teste',
  numero: '123',
};

describe('UsuarioScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProfile.mockResolvedValue(profile);
    mockSaveUser.mockResolvedValue(undefined);
    mockClearSession.mockResolvedValue(undefined);
    jest.mocked(authStorage.getSessionSnapshot).mockResolvedValue({ generation: 0, incarnation: 'profile-origin', revision: 0, sessionId: 'profile-session', accessToken: 'test', refreshToken: 'test' });
    jest.mocked(authStorage.isSessionCurrent).mockResolvedValue(true);
    jest.mocked(authStorage.getSessionGeneration).mockReturnValue(0);
    jest.mocked(authStorage.subscribeAuthState).mockReturnValue(() => { });
  });

  it('loads the profile in the shared shell with accessible fields', async () => {
    render(<UsuarioScreen />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Usuario Teste')).toBeTruthy();
      expect(screen.getByDisplayValue('user@example.com')).toBeTruthy();
    });

    expect(screen.getByLabelText('Nome completo')).toBeTruthy();
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.getByLabelText('CPF')).toBeTruthy();
    expect(screen.getByLabelText('CEP')).toBeTruthy();

    fireEvent.press(screen.getByLabelText(/Abrir perfil/));
    expect(mockReplace).toHaveBeenCalledWith('/usuario');
  });

  it('opens password, privacy, and audit from the loaded profile', async () => {
    render(<UsuarioScreen />);

    await waitFor(() => expect(screen.getByDisplayValue('Usuario Teste')).toBeTruthy());

    for (const [label, route] of [
      ['Alterar senha', '/reset-password'],
      ['Privacidade', '/privacidade'],
      ['Log de auditoria', '/audit-logs'],
    ]) {
      fireEvent.press(screen.getByRole('button', { name: label }));
      expect(mockPush).toHaveBeenLastCalledWith(route);
    }
  });

  it('preserves the profile update payload and success feedback', async () => {
    mockUpdateProfile.mockResolvedValue({ ...profile, email: 'novo@example.com' });
    render(<UsuarioScreen />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('user@example.com')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText('E-mail'), 'novo@example.com');
    fireEvent.press(screen.getByText('Salvar alteracoes'));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        cep: '01001-000',
        cidade: 'Sao Paulo',
        cpf: '123.456.789-01',
        email: 'novo@example.com',
        endereco: 'Rua Teste',
        nome: 'Usuario Teste',
        numero: '123',
      });
      expect(screen.getByText('Perfil atualizado com sucesso.')).toBeTruthy();
    });
  });

  it('keeps the 401 redirect and load error state', async () => {
    mockGetProfile.mockRejectedValue({
      response: {
        status: 401,
        data: { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      },
    });

    render(<UsuarioScreen />);

    await waitFor(() => {
      expect(mockClearSession).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Nao foi possivel carregar o perfil')).toBeTruthy();
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });
});
