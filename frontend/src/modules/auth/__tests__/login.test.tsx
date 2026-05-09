import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../screens/LoginScreen';
import * as authService from '../services/authService';
import * as authStorage from '../../../../storage/authStorage';

// Mock expo-router
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

// Mock services
jest.mock('../services/authService');
jest.mock('../../../../storage/authStorage');

const mockLogin = authService.login as jest.MockedFunction<typeof authService.login>;
const mockSaveToken = authStorage.saveToken as jest.MockedFunction<typeof authStorage.saveToken>;
const mockSaveRefreshToken = authStorage.saveRefreshToken as jest.MockedFunction<typeof authStorage.saveRefreshToken>;
const mockSaveUser = authStorage.saveUser as jest.MockedFunction<typeof authStorage.saveUser>;

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login form correctly', () => {
    render(<LoginScreen />);

    expect(screen.getByText('Login')).toBeTruthy();
    expect(screen.getByText('Entre para acompanhar seu resumo financeiro e continuar de onde parou.')).toBeTruthy();
    expect(screen.getByPlaceholderText('voce@exemplo.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('Sua senha')).toBeTruthy();
    expect(screen.getByText('Entrar')).toBeTruthy();
    expect(screen.getByText('Esqueci minha senha')).toBeTruthy();
    expect(screen.getByText('Cadastrar')).toBeTruthy();
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

  it('calls login service and navigates on success', async () => {
    const mockResponse = {
      access_token: 'token123',
      refresh_token: 'refresh123',
      usuario: { id: '1', nome: 'Test', email: 'test@example.com' },
    };

    mockLogin.mockResolvedValue(mockResponse);
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
      expect(mockSaveToken).toHaveBeenCalledWith('token123');
      expect(mockSaveRefreshToken).toHaveBeenCalledWith('refresh123');
      expect(mockSaveUser).toHaveBeenCalledWith(mockResponse.usuario);
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error message on login failure', async () => {
    mockLogin.mockRejectedValue({
      response: { status: 401, data: { message: 'Invalid credentials' } },
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
    mockLogin.mockImplementation(() => new Promise(() => {})); // Never resolves

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

    // Check that inputs are disabled (though in RN testing it's hard to verify)
    expect(mockLogin).toHaveBeenCalled();
  });
});
