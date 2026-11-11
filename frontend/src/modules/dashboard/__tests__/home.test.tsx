import { logout } from '../../auth/services/logoutCoordinator';
jest.mock('../../auth/services/logoutCoordinator');
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as authStorage from '../../../../storage/authStorage';
import * as authService from '../../auth/services/authService';
import { HomeScreen } from '../screens/HomeScreen';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));
jest.mock('../../../../storage/authStorage');
jest.mock('../../auth/services/authService');

const mockGetUser = authStorage.getUser as jest.MockedFunction<typeof authStorage.getUser>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<
  typeof authStorage.clearSession
>;
const mockLogoutSession = authService.logoutSession as jest.MockedFunction<
  typeof authService.logoutSession
>;

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(authStorage.subscribeAuthState).mockReturnValue(() => {});
    jest.mocked(authStorage.getSessionGeneration).mockReturnValue(0);
    jest.mocked(logout).mockReturnValue({generation:1, completion:Promise.resolve({localDurable:true,cleanupComplete:true,remote:'confirmed'})});
    mockGetUser.mockResolvedValue({ id: '1', nome: 'Ana', email: 'ana@example.com' });
    mockClearSession.mockResolvedValue(undefined);
    mockLogoutSession.mockResolvedValue({ message: 'Logged out' });
  });

  it('keeps the greeting, shortcuts and shared navigation', async () => {
    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText('Bem-vindo, Ana')).toBeTruthy();
      expect(screen.getByText('Email: ana@example.com')).toBeTruthy();
    });

    expect(screen.getByText('Atalhos')).toBeTruthy();
    expect(screen.getByLabelText('Dashboard')).toBeTruthy();
    fireEvent.press(screen.getByText('Minhas contas'));
    fireEvent.press(screen.getByText('Alterar senha'));
    fireEvent.press(screen.getByLabelText('Planejamentos'));
    fireEvent.press(screen.getByLabelText(/Abrir perfil/));

    expect(mockPush).toHaveBeenCalledWith('/contas');
    expect(mockPush).toHaveBeenCalledWith('/reset-password');
    expect(mockPush).toHaveBeenCalledWith('/planejamentos');
    expect(mockPush).toHaveBeenCalledWith('/usuario');
  });

  it('clears the session and redirects on logout', async () => {
    render(<HomeScreen />);

    fireEvent.press(screen.getByLabelText('Sair da conta'));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });
});
