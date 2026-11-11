import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as authStorage from '../../../../storage/authStorage';
import { PrivacidadeScreen } from '../screens/PrivacidadeScreen';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));
jest.mock('../../../../storage/authStorage');

describe('PrivacidadeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(authStorage.getToken).mockResolvedValue(null);
    jest.mocked(authStorage.subscribeAuthState).mockReturnValue(jest.fn());
  });

  it('shows privacy content without authenticated navigation to a guest', async () => {
    render(<PrivacidadeScreen />);

    await waitFor(() => expect(screen.getByText('Privacidade e LGPD')).toBeTruthy());
    expect(screen.getByText('Resumo para o usuario final')).toBeTruthy();
    expect(screen.getByText(/endereco IP/)).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByLabelText(/Abrir perfil/)).toBeNull();
    expect(screen.queryByLabelText(/Abrir ações rápidas/)).toBeNull();
  });

  it('preserves the public login and registration actions', async () => {
    render(<PrivacidadeScreen />);

    await waitFor(() => expect(screen.getByText('Ir ao login')).toBeTruthy());
    fireEvent.press(screen.getByText('Ir ao login'));
    fireEvent.press(screen.getByText('Ir ao cadastro'));

    expect(mockReplace).toHaveBeenNthCalledWith(1, '/login');
    expect(mockReplace).toHaveBeenNthCalledWith(2, '/register');
  });

  it('shows authenticated navigation and a return to profile', async () => {
    jest.mocked(authStorage.getToken).mockResolvedValue('token');
    render(<PrivacidadeScreen />);

    await waitFor(() => expect(screen.getByLabelText(/Abrir perfil/)).toBeTruthy());
    fireEvent.press(screen.getByLabelText(/Abrir perfil/));
    expect(mockPush).toHaveBeenCalledWith('/usuario');
    fireEvent.press(screen.getByRole('button', { name: 'Voltar ao perfil' }));
    expect(mockReplace).toHaveBeenCalledWith('/usuario');
    expect(screen.queryByText('Ir ao login')).toBeNull();
    expect(screen.queryByText('Ir ao cadastro')).toBeNull();
  });
});
