import { describe, expect, it, jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as authStorage from '../../../../storage/authStorage';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import * as authService from '../services/authService';
import { getVisibleResetToken } from '../utils/resetTokenVisibility';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock('../services/authService');
jest.mock('../../../../storage/authStorage');

const mockForgotPassword = authService.forgotPassword as jest.MockedFunction<
  typeof authService.forgotPassword
>;
const mockSaveToken = authStorage.saveToken as jest.MockedFunction<
  typeof authStorage.saveToken
>;
const mockSaveRefreshToken =
  authStorage.saveRefreshToken as jest.MockedFunction<
    typeof authStorage.saveRefreshToken
  >;
const mockSaveUser = authStorage.saveUser as jest.MockedFunction<
  typeof authStorage.saveUser
>;

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the development token block when a dev build receives a reset token', async () => {
    mockForgotPassword.mockResolvedValue({
      message: 'Mensagem generica enviada.',
      resetToken: 'dev-reset-token-for-test',
    });

    render(<ForgotPasswordScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('voce@exemplo.com'),
      'ana@example.com',
    );
    fireEvent.press(screen.getByText('Enviar instrucoes'));

    await waitFor(() => {
      expect(
        screen.getByText('Token (ambiente de desenvolvimento)'),
      ).toBeTruthy();
      expect(screen.getByText('dev-reset-token-for-test')).toBeTruthy();
    });
  });

  it('keeps the token block hidden when the response has no reset token', async () => {
    mockForgotPassword.mockResolvedValue({
      message: 'Mensagem generica enviada.',
    });

    render(<ForgotPasswordScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('voce@exemplo.com'),
      'ana@example.com',
    );
    fireEvent.press(screen.getByText('Enviar instrucoes'));

    await waitFor(() => {
      expect(screen.getByText('Mensagem generica enviada.')).toBeTruthy();
      expect(
        screen.queryByText('Token (ambiente de desenvolvimento)'),
      ).toBeNull();
    });
  });

  it('ignores reset tokens outside development builds', () => {
    expect(getVisibleResetToken(false, 'dev-reset-token-for-test')).toBe('');
  });

  it('clears a previous token on a later response without a token', async () => {
    mockForgotPassword
      .mockResolvedValueOnce({
        message: 'Primeira mensagem.',
        resetToken: 'first-dev-reset-token',
      })
      .mockResolvedValueOnce({
        message: 'Segunda mensagem.',
      });

    render(<ForgotPasswordScreen />);

    const emailInput = screen.getByPlaceholderText('voce@exemplo.com');
    const submitButton = screen.getByText('Enviar instrucoes');

    fireEvent.changeText(emailInput, 'ana@example.com');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(screen.getByText('first-dev-reset-token')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Enviar instrucoes'));

    await waitFor(() => {
      expect(screen.getByText('Segunda mensagem.')).toBeTruthy();
      expect(screen.queryByText('first-dev-reset-token')).toBeNull();
    });
  });

  it('clears a previous token when a later request fails', async () => {
    mockForgotPassword
      .mockResolvedValueOnce({
        message: 'Primeira mensagem.',
        resetToken: 'first-dev-reset-token',
      })
      .mockRejectedValueOnce({
        response: { status: 500, data: { message: 'Erro interno' } },
      });

    render(<ForgotPasswordScreen />);

    const emailInput = screen.getByPlaceholderText('voce@exemplo.com');

    fireEvent.changeText(emailInput, 'ana@example.com');
    fireEvent.press(screen.getByText('Enviar instrucoes'));

    await waitFor(() => {
      expect(screen.getByText('first-dev-reset-token')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Enviar instrucoes'));

    await waitFor(() => {
      expect(screen.getAllByText('Erro interno').length).toBeGreaterThan(0);
      expect(screen.queryByText('first-dev-reset-token')).toBeNull();
    });
  });

  it('does not persist reset tokens in auth storage', async () => {
    mockForgotPassword.mockResolvedValue({
      message: 'Mensagem generica enviada.',
      resetToken: 'dev-reset-token-for-test',
    });

    render(<ForgotPasswordScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('voce@exemplo.com'),
      'ana@example.com',
    );
    fireEvent.press(screen.getByText('Enviar instrucoes'));

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalled();
    });
    expect(mockSaveToken).not.toHaveBeenCalled();
    expect(mockSaveRefreshToken).not.toHaveBeenCalled();
    expect(mockSaveUser).not.toHaveBeenCalled();
  });

  it('keeps the normal success message flow', async () => {
    mockForgotPassword.mockResolvedValue({
      message: 'Mensagem generica enviada.',
    });

    render(<ForgotPasswordScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('voce@exemplo.com'),
      'ana@example.com',
    );
    fireEvent.press(screen.getByText('Enviar instrucoes'));

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith({
        email: 'ana@example.com',
      });
      expect(screen.getByText('Mensagem generica enviada.')).toBeTruthy();
    });
  });
});
