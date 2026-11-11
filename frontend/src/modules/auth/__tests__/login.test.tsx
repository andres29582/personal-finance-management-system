import { describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../screens/LoginScreen';
import * as authService from '../services/authService';
import * as authStorage from '../../../../storage/authStorage';

// Mock expo-router
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
}));

// Mock services
jest.mock('../services/authService');
jest.mock('../../../../storage/authStorage');

const mockLogin = authService.login as jest.MockedFunction<typeof authService.login>;
const mockInstallSession = authStorage.installSession as jest.MockedFunction<typeof authStorage.installSession>;
const mockGetSessionGeneration = authStorage.getSessionGeneration as jest.MockedFunction<typeof authStorage.getSessionGeneration>;
const mockSaveToken = authStorage.saveToken as jest.MockedFunction<typeof authStorage.saveToken>;
const mockSaveRefreshToken = authStorage.saveRefreshToken as jest.MockedFunction<typeof authStorage.saveRefreshToken>;
const mockSaveUser = authStorage.saveUser as jest.MockedFunction<typeof authStorage.saveUser>;

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessionGeneration.mockReturnValue(7);
    jest.mocked(authStorage.reconcileSession).mockResolvedValue({ generation: 7, incarnation: 'login-origin', revision: 0, sessionId: null, accessToken: null, refreshToken: null });
    mockInstallSession.mockResolvedValue(true);
  });

  it('renders login form correctly with AEPV.ia.finance brand and Stitch controls', () => {
    render(<LoginScreen />);

    expect(screen.getByText('Login')).toBeTruthy();
    expect(screen.getByText('Entre para acompanhar seu resumo financeiro e continuar de onde parou.')).toBeTruthy();
    expect(screen.getByPlaceholderText('voce@exemplo.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('Sua senha')).toBeTruthy();
    expect(screen.getByText('Entrar')).toBeTruthy();
    expect(screen.queryByText('Esqueci minha senha')).toBeNull();
    expect(screen.getByText('Esqueceu a senha?')).toBeTruthy();
    expect(screen.getByText('Cadastrar')).toBeTruthy();
    expect(screen.getAllByText(/AEPV/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\.ia\.finance/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('ACESSO SEGURO')).toBeNull();
    expect(screen.queryByLabelText('Acesso seguro')).toBeNull();
    expect(screen.getByLabelText('Marca AEPV.ia.finance')).toBeTruthy();
    expect(screen.queryByText(/AquaFinance/i)).toBeNull();
    expect(screen.getAllByText('Login')).toHaveLength(1);
    expect(screen.getByLabelText('Conexao protegida')).toBeTruthy();
    expect(screen.queryByText(/biometr/i)).toBeNull();
  });

  it('toggles password visibility when toggle button is pressed', () => {
    render(<LoginScreen />);

    const passwordInput = screen.getByPlaceholderText('Sua senha');
    expect(passwordInput.props.secureTextEntry).toBe(true);

    const toggleBtn = screen.getByTestId('toggle-password-visibility');
    fireEvent.press(toggleBtn);

    expect(passwordInput.props.secureTextEntry).toBe(false);

    fireEvent.press(toggleBtn);
    expect(passwordInput.props.secureTextEntry).toBe(true);
  });

  it('navigates to forgot password and register routes', () => {
    render(<LoginScreen />);

    const forgotPasswordLink = screen.getByText('Esqueceu a senha?');
    fireEvent.press(forgotPasswordLink);
    expect(mockPush).toHaveBeenCalledWith('/forgot-password');

    const registerLink = screen.getByText('Cadastrar');
    fireEvent.press(registerLink);
    expect(mockPush).toHaveBeenCalledWith('/register');
  });

  it('shows validation errors for empty fields', async () => {
    render(<LoginScreen />);

    const loginButton = screen.getByText('Entrar');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Preencha e-mail e senha para continuar.')).toBeTruthy();
      expect(screen.getByText('Informe seu e-mail.')).toBeTruthy();
      expect(screen.getByText('Informe sua senha.')).toBeTruthy();
    });
  });

  it('awaits coherent session installation before navigating', async () => {
    const mockResponse = {
      access_token: 'token123',
      refresh_token: 'refresh123',
      usuario: { id: '1', nome: 'Test', email: 'test@example.com' },
    };

    mockLogin.mockResolvedValue(mockResponse);
    let completeInstallation!: (installed: boolean) => void;
    mockInstallSession.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
      completeInstallation = resolve;
    }));
    mockSaveToken.mockResolvedValue(undefined);
    mockSaveRefreshToken.mockResolvedValue(undefined);
    mockSaveUser.mockResolvedValue(undefined);

    render(<LoginScreen />);

    const emailInput = screen.getByPlaceholderText('voce@exemplo.com');
    const passwordInput = screen.getByPlaceholderText('Sua senha');
    const loginButton = screen.getByText('Entrar');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        senha: 'password123',
      });
      expect(mockInstallSession).toHaveBeenCalledWith(mockResponse, expect.objectContaining({ generation: 7, incarnation: 'login-origin' }));
      expect(mockSaveToken).not.toHaveBeenCalled();
      expect(mockSaveRefreshToken).not.toHaveBeenCalled();
      expect(mockSaveUser).not.toHaveBeenCalled();
    });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Entrando' }).props.accessibilityState.busy).toBe(true);

    await act(async () => completeInstallation(true));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('does not navigate when session installation is superseded', async () => {
    mockLogin.mockResolvedValue({
      access_token: 'token123',
      refresh_token: 'refresh123',
      usuario: { id: '1', nome: 'Test', email: 'test@example.com' },
    });
    mockInstallSession.mockResolvedValueOnce(false);
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('voce@exemplo.com'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Sua senha'), 'password123');
    fireEvent.press(screen.getByText('Entrar'));

    await waitFor(() => expect(mockInstallSession).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' }).props.accessibilityState.busy).toBe(false));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSaveToken).not.toHaveBeenCalled();
    expect(mockSaveRefreshToken).not.toHaveBeenCalled();
    expect(mockSaveUser).not.toHaveBeenCalled();
  });

  it('does not navigate when session installation fails', async () => {
    mockLogin.mockResolvedValue({
      access_token: 'token123',
      refresh_token: 'refresh123',
      usuario: { id: '1', nome: 'Test', email: 'test@example.com' },
    });
    mockInstallSession.mockRejectedValueOnce(new Error('Storage unavailable'));
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('voce@exemplo.com'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Sua senha'), 'password123');
    fireEvent.press(screen.getByText('Entrar'));

    await waitFor(() => expect(screen.getByText('Nao foi possivel entrar agora.')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSaveToken).not.toHaveBeenCalled();
    expect(mockSaveRefreshToken).not.toHaveBeenCalled();
    expect(mockSaveUser).not.toHaveBeenCalled();
  });

  it('shows error message on login failure', async () => {
    mockLogin.mockRejectedValue({
      response: { status: 401, data: { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'E-mail ou senha invalidos' } } },
    });

    render(<LoginScreen />);

    const emailInput = screen.getByPlaceholderText('voce@exemplo.com');
    const passwordInput = screen.getByPlaceholderText('Sua senha');
    const loginButton = screen.getByText('Entrar');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'wrongpassword');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(screen.getByText('E-mail ou senha invalidos.')).toBeTruthy();
    });
  });

  it('disables form during loading', async () => {
    mockLogin.mockImplementation(() => new Promise(() => { })); // Never resolves

    render(<LoginScreen />);

    const emailInput = screen.getByPlaceholderText('voce@exemplo.com');
    const passwordInput = screen.getByPlaceholderText('Sua senha');
    const loginButton = screen.getByText('Entrar');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Entrando...')).toBeTruthy();
    });

    expect(mockLogin).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Entrando' }).props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });
  });
});
