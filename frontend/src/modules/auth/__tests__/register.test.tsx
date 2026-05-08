import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { RegisterScreen } from '../screens/RegisterScreen';
import * as authService from '../services/authService';

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
jest.mock('../../../../hooks/use-cep-autofill', () => ({
  useCepAutofill: () => ({
    cepLookupLoading: false,
    cepLookupMessage: '',
    cepLookupTone: 'muted',
    handleCepValueChange: (value: string) => value,
  }),
}));

const mockRegister = authService.register as jest.MockedFunction<typeof authService.register>;

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders register form correctly', () => {
    render(<RegisterScreen />);

    expect(screen.getByText('Criar conta')).toBeTruthy();
    expect(screen.getByText('Preencha seus dados para criar uma conta completa e segura.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Seu nome completo')).toBeTruthy();
    expect(screen.getByPlaceholderText('voce@exemplo.com')).toBeTruthy();
    expect(screen.getByText('Criar conta')).toBeTruthy();
    expect(screen.getByText('Voltar para login')).toBeTruthy();
  });

  it('shows validation errors for empty required fields', async () => {
    render(<RegisterScreen />);

    const registerButton = screen.getByText('Criar conta');
    fireEvent.press(registerButton);

    await waitFor(() => {
      expect(screen.getByText('Revise os campos destacados para continuar.')).toBeTruthy();
      expect(screen.getByText('Informe seu nome completo.')).toBeTruthy();
      expect(screen.getByText('Informe seu e-mail.')).toBeTruthy();
    });
  });

  it('validates email format', async () => {
    render(<RegisterScreen />);

    const emailInput = screen.getByPlaceholderText('voce@exemplo.com');
    const registerButton = screen.getByText('Criar conta');

    fireEvent.changeText(emailInput, 'invalid-email');
    fireEvent.press(registerButton);

    await waitFor(() => {
      expect(screen.getByText('Digite um e-mail valido.')).toBeTruthy();
    });
  });

  it('calls register service and navigates on success', async () => {
    const mockResponse = {
      usuario: { id: '1', nome: 'Test User', email: 'test@example.com' },
      message: 'User registered successfully',
    };

    mockRegister.mockResolvedValue(mockResponse);

    render(<RegisterScreen />);

    // Fill required fields
    fireEvent.changeText(screen.getByPlaceholderText('Seu nome completo'), 'Test User');
    fireEvent.changeText(screen.getByPlaceholderText('voce@exemplo.com'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('000.000.000-00'), '12345678901');
    fireEvent.changeText(screen.getByPlaceholderText('00000-000'), '12345678');
    fireEvent.changeText(screen.getByPlaceholderText('Rua, avenida ou logradouro'), 'Test Street');
    fireEvent.changeText(screen.getByPlaceholderText('123 ou S/N'), '123');
    fireEvent.changeText(screen.getByPlaceholderText('Sua cidade'), 'Test City');
    fireEvent.changeText(screen.getByPlaceholderText('Crie uma senha'), 'password123');
    fireEvent.changeText(screen.getByPlaceholderText('Repita a senha'), 'password123');

    // Check privacy policy
    const privacyCheckbox = screen.getByRole('checkbox');
    fireEvent.press(privacyCheckbox);

    const registerButton = screen.getByText('Criar conta');
    fireEvent.press(registerButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        nome: 'Test User',
        email: 'test@example.com',
        cpf: '123.456.789-01',
        cep: '12345678',
        endereco: 'Test Street',
        numero: '123',
        cidade: 'Test City',
        senha: 'password123',
        aceitoPoliticaPrivacidade: true,
      });
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('shows error message on register failure', async () => {
    mockRegister.mockRejectedValue({
      response: { status: 400, data: { message: 'Email already exists' } },
    });

    render(<RegisterScreen />);

    // Fill minimal fields
    fireEvent.changeText(screen.getByPlaceholderText('Seu nome completo'), 'Test User');
    fireEvent.changeText(screen.getByPlaceholderText('voce@exemplo.com'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('000.000.000-00'), '12345678901');
    fireEvent.changeText(screen.getByPlaceholderText('00000-000'), '12345678');
    fireEvent.changeText(screen.getByPlaceholderText('Rua, avenida ou logradouro'), 'Test Street');
    fireEvent.changeText(screen.getByPlaceholderText('123 ou S/N'), '123');
    fireEvent.changeText(screen.getByPlaceholderText('Sua cidade'), 'Test City');
    fireEvent.changeText(screen.getByPlaceholderText('Crie uma senha'), 'password123');
    fireEvent.changeText(screen.getByPlaceholderText('Repita a senha'), 'password123');

    const privacyCheckbox = screen.getByRole('checkbox');
    fireEvent.press(privacyCheckbox);

    const registerButton = screen.getByText('Criar conta');
    fireEvent.press(registerButton);

    await waitFor(() => {
      expect(screen.getByText('Confira CPF, CEP e os demais dados informados.')).toBeTruthy();
    });
  });
});
