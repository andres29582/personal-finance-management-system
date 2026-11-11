import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { RegisterScreen } from '../screens/RegisterScreen';
import * as authService from '../services/authService';

// Mock expo-router
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockCepAutofillState: {
  cepLookupLoading: boolean;
  cepLookupMessage: string;
  cepLookupTone: 'error' | 'muted' | 'success';
  handleCepValueChange: (value: string) => string;
} = {
  cepLookupLoading: false,
  cepLookupMessage: '',
  cepLookupTone: 'muted',
  handleCepValueChange: (value: string) => value,
};
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
}));

// Mock services
jest.mock('../services/authService');
jest.mock('../../../shared/hooks/use-cep-autofill', () => ({
  useCepAutofill: () => mockCepAutofillState,
}));

const mockRegister = authService.register as jest.MockedFunction<typeof authService.register>;

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegister.mockReset();
    mockCepAutofillState = {
      cepLookupLoading: false,
      cepLookupMessage: '',
      cepLookupTone: 'muted',
      handleCepValueChange: (value: string) => value,
    };
  });

  it('renders the AEPV.ia.finance registration form without legacy security chrome', () => {
    render(<RegisterScreen />);

    expect(screen.getByText('Cadastro')).toBeTruthy();
    expect(screen.getByText('Criar conta')).toBeTruthy();
    expect(screen.getByText('Preencha seus dados para criar uma conta completa e segura.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Seu nome completo')).toBeTruthy();
    expect(screen.getByPlaceholderText('voce@exemplo.com')).toBeTruthy();
    expect(screen.getByText('Criar conta')).toBeTruthy();
    expect(screen.getByText('Voltar para login')).toBeTruthy();
    expect(screen.getAllByText(/AEPV/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\.ia\.finance/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('ACESSO SEGURO')).toBeNull();
    expect(screen.queryByLabelText('Acesso seguro')).toBeNull();
    expect(screen.queryByText(/AquaFinance/i)).toBeNull();
  });

  it('shows validation errors for empty required fields', async () => {
    render(<RegisterScreen />);

    const registerButton = screen.getByText('Criar conta');
    fireEvent.press(registerButton);

    await waitFor(() => {
      expect(screen.getByText('Revise os campos destacados para continuar.')).toBeTruthy();
      expect(screen.getByText('Informe seu nome completo.')).toBeTruthy();
      expect(screen.getByText('Informe seu e-mail.')).toBeTruthy();
      expect(screen.getByText('Digite um CPF com 11 digitos.')).toBeTruthy();
      expect(screen.getByText('Digite um CEP valido.')).toBeTruthy();
      expect(screen.getByText('Informe sua rua, avenida ou logradouro.')).toBeTruthy();
      expect(screen.getByText('Informe o numero da residencia.')).toBeTruthy();
      expect(screen.getByText('Informe sua cidade.')).toBeTruthy();
      expect(screen.getByText('Confirme a senha.')).toBeTruthy();
      expect(screen.getByText('Aceite a politica de privacidade para continuar.')).toBeTruthy();
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

  it('associates password mismatch and privacy consent errors with their fields', async () => {
    render(<RegisterScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Entre 6 e 64 caracteres'), 'password123');
    fireEvent.changeText(screen.getByPlaceholderText('Repita a senha'), 'password456');
    fireEvent.press(screen.getByText('Criar conta'));

    await waitFor(() => {
      expect(screen.getByText('As senhas precisam ser iguais.')).toBeTruthy();
      expect(screen.getByText('Aceite a politica de privacidade para continuar.')).toBeTruthy();
    });
  });

  it('shows each password independently on demand', () => {
    render(<RegisterScreen />);

    const passwordInput = screen.getByPlaceholderText('Entre 6 e 64 caracteres');
    const confirmPasswordInput = screen.getByPlaceholderText('Repita a senha');

    expect(passwordInput.props.secureTextEntry).toBe(true);
    expect(confirmPasswordInput.props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByTestId('toggle-password-visibility'));
    expect(passwordInput.props.secureTextEntry).toBe(false);
    expect(confirmPasswordInput.props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByTestId('toggle-confirm-password-visibility'));
    expect(confirmPasswordInput.props.secureTextEntry).toBe(false);
  });

  it('announces CEP lookup states without hiding the form', () => {
    const { rerender } = render(<RegisterScreen />);
    expect(screen.getByTestId('cep-lookup-status')).toHaveTextContent(
      'Digite os 8 digitos para preencher o endereco automaticamente.',
    );

    mockCepAutofillState = { ...mockCepAutofillState, cepLookupLoading: true };
    rerender(<RegisterScreen />);
    expect(screen.getByTestId('cep-lookup-status')).toHaveTextContent('Buscando CEP...');

    mockCepAutofillState = {
      ...mockCepAutofillState,
      cepLookupLoading: false,
      cepLookupMessage: 'Endereco preenchido automaticamente.',
      cepLookupTone: 'success',
    };
    rerender(<RegisterScreen />);
    expect(screen.getByTestId('cep-lookup-status')).toHaveTextContent(
      'Endereco preenchido automaticamente.',
    );

    mockCepAutofillState = {
      ...mockCepAutofillState,
      cepLookupMessage: 'CEP nao encontrado.',
      cepLookupTone: 'error',
    };
    rerender(<RegisterScreen />);
    expect(screen.getByTestId('cep-lookup-status')).toHaveTextContent('CEP nao encontrado.');
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
    fireEvent.changeText(screen.getByPlaceholderText('Entre 6 e 64 caracteres'), ' password123 ');
    fireEvent.changeText(screen.getByPlaceholderText('Repita a senha'), ' password123 ');

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
        senha: ' password123 ',
        aceitoPoliticaPrivacidade: true,
      });
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('associates an email conflict with the email field and preserves values', async () => {
    mockRegister.mockRejectedValue({
      response: { status: 409, data: { error: { code: 'AUTH_EMAIL_ALREADY_EXISTS', message: 'E-mail ja cadastrado' } } },
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
    fireEvent.changeText(screen.getByPlaceholderText('Entre 6 e 64 caracteres'), 'password123');
    fireEvent.changeText(screen.getByPlaceholderText('Repita a senha'), 'password123');

    const privacyCheckbox = screen.getByRole('checkbox');
    fireEvent.press(privacyCheckbox);

    const registerButton = screen.getByText('Criar conta');
    fireEvent.press(registerButton);

    await waitFor(() => {
      expect(screen.getByText('Este e-mail ja esta cadastrado.')).toBeTruthy();
      expect(screen.getByText('Corrija o campo destacado para continuar.')).toBeTruthy();
    });

    expect(screen.getByPlaceholderText('Seu nome completo').props.value).toBe('Test User');
    expect(screen.getByPlaceholderText('voce@exemplo.com').props.value).toBe('test@example.com');
    expect(screen.getByPlaceholderText('00000-000').props.value).toBe('12345678');
    expect(screen.getByPlaceholderText('Rua, avenida ou logradouro').props.value).toBe('Test Street');
    expect(screen.getByPlaceholderText('Repita a senha').props.value).toBe('password123');
  });

  it('opens the privacy summary without changing the registration route', () => {
    render(<RegisterScreen />);

    fireEvent.press(screen.getByText('Politica de Privacidade e LGPD (resumo)'));
    expect(mockPush).toHaveBeenCalledWith('/privacidade');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('clears only the edited field error after a specific conflict', async () => {
    mockRegister.mockReset();
    mockRegister.mockRejectedValue({
      response: { status: 409, data: { error: { code: 'AUTH_CPF_ALREADY_EXISTS', message: 'CPF ja cadastrado' } } },
    });
    render(<RegisterScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Seu nome completo'), 'Test User');
    fireEvent.changeText(screen.getByPlaceholderText('voce@exemplo.com'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('000.000.000-00'), '12345678901');
    fireEvent.changeText(screen.getByPlaceholderText('00000-000'), '12345678');
    fireEvent.changeText(screen.getByPlaceholderText('Rua, avenida ou logradouro'), 'Test Street');
    fireEvent.changeText(screen.getByPlaceholderText('123 ou S/N'), '123');
    fireEvent.changeText(screen.getByPlaceholderText('Sua cidade'), 'Test City');
    fireEvent.changeText(screen.getByPlaceholderText('Entre 6 e 64 caracteres'), 'password123');
    fireEvent.changeText(screen.getByPlaceholderText('Repita a senha'), 'password123');
    fireEvent.press(screen.getByRole('checkbox'));
    fireEvent.press(screen.getByText('Criar conta'));

    await waitFor(() => expect(screen.getByText('Este CPF ja esta cadastrado.')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('voce@exemplo.com'), 'other@example.com');
    expect(screen.getByText('Este CPF ja esta cadastrado.')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('000.000.000-00'), '98765432100');
    expect(screen.queryByText('Este CPF ja esta cadastrado.')).toBeNull();
  });

  it('uses a truthful generic message when a conflict cannot identify the field', async () => {
    mockRegister.mockReset();
    mockRegister.mockRejectedValue({ response: { status: 409, data: { error: { code: 'CONFLICT' } } } });
    render(<RegisterScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Seu nome completo'), 'Test User');
    fireEvent.changeText(screen.getByPlaceholderText('voce@exemplo.com'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('000.000.000-00'), '12345678901');
    fireEvent.changeText(screen.getByPlaceholderText('00000-000'), '12345678');
    fireEvent.changeText(screen.getByPlaceholderText('Rua, avenida ou logradouro'), 'Test Street');
    fireEvent.changeText(screen.getByPlaceholderText('123 ou S/N'), '123');
    fireEvent.changeText(screen.getByPlaceholderText('Sua cidade'), 'Test City');
    fireEvent.changeText(screen.getByPlaceholderText('Entre 6 e 64 caracteres'), 'password123');
    fireEvent.changeText(screen.getByPlaceholderText('Repita a senha'), 'password123');
    fireEvent.press(screen.getByRole('checkbox'));
    fireEvent.press(screen.getByText('Criar conta'));

    await waitFor(() => {
      expect(screen.getByText('Ja existe um usuario com este e-mail ou CPF.')).toBeTruthy();
    });
  });

  it('keeps an unknown registration outcome recoverable without claiming rollback or retrying automatically', async () => {
    mockRegister.mockRejectedValue({ isAxiosError: true, code: 'ERR_NETWORK' });
    render(<RegisterScreen />);
    for (const [placeholder, value] of [
      ['Seu nome completo', 'Test User'], ['voce@exemplo.com', 'test@example.com'],
      ['000.000.000-00', '12345678901'], ['00000-000', '12345678'],
      ['Rua, avenida ou logradouro', 'Test Street'], ['123 ou S/N', '123'],
      ['Sua cidade', 'Test City'], ['Entre 6 e 64 caracteres', 'password123'],
      ['Repita a senha', 'password123'],
    ]) fireEvent.changeText(screen.getByPlaceholderText(placeholder), value);
    fireEvent.press(screen.getByRole('checkbox'));
    fireEvent.press(screen.getByText('Criar conta'));

    await waitFor(() => expect(screen.getByText(
      'Nao foi possivel confirmar a criacao da conta. Ela pode ter sido criada. Tente entrar ou recuperar sua senha pelo login.',
    )).toBeTruthy());
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('voce@exemplo.com').props.value).toBe('test@example.com');
    fireEvent.press(screen.getByText('Voltar para login'));
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});
