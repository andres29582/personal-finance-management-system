import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { ResetPasswordTokenScreen } from '../screens/ResetPasswordTokenScreen';
import * as authService from '../services/authService';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: mockReplace },
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ token: 'valid-token' }),
}));
jest.mock('../services/authService');
jest.mock('../../../../storage/authStorage', () => ({
  clearSession: jest.fn().mockResolvedValue(undefined),
  getToken: jest.fn().mockResolvedValue('access-token'),
}));

const mockResetPassword = authService.resetPassword as jest.MockedFunction<
  typeof authService.resetPassword
>;
const mockResetPasswordWithToken =
  authService.resetPasswordWithToken as jest.MockedFunction<
    typeof authService.resetPasswordWithToken
  >;

describe('password reset screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an oversized password in the authenticated reset screen', () => {
    render(<ResetPasswordScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Entre 6 e 64 caracteres'),
      'a'.repeat(65),
    );
    fireEvent.press(screen.getByText('Atualizar senha'));

    expect(
      screen.getAllByText('A senha deve ter entre 6 e 64 caracteres.'),
    ).not.toHaveLength(0);
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('preserves surrounding spaces when resetting with a token', async () => {
    mockResetPasswordWithToken.mockResolvedValue({ message: 'Senha atualizada.' });
    render(<ResetPasswordTokenScreen />);
    const password = ' senha segura ';

    fireEvent.changeText(screen.getByPlaceholderText('Entre 6 e 64 caracteres'), password);
    fireEvent.changeText(screen.getByPlaceholderText('Repita a nova senha'), password);
    fireEvent.press(screen.getByText('Redefinir senha'));

    await waitFor(() => {
      expect(mockResetPasswordWithToken).toHaveBeenCalledWith({
        token: 'valid-token',
        novaSenha: password,
      });
    });
  });
});
