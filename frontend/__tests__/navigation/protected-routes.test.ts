import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { createElement } from 'react';
import { RootLayout } from '../../src/navigation/RootLayout';
import * as authStorage from '../../storage/authStorage';

jest.mock('expo-router', () => ({
  Stack: jest.fn(() => null),
  useRootNavigationState: jest.fn(),
  useRouter: jest.fn(),
  useSegments: jest.fn(),
}));
jest.mock('../../storage/authStorage');

describe('RootLayout route guard', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    (useRootNavigationState as jest.Mock).mockReturnValue({ key: 'ready' });
    jest.mocked(authStorage.subscribeAuthState).mockReturnValue(jest.fn());
  });

  function renderRoute(path: string, token: string | null) {
    (useSegments as jest.Mock).mockReturnValue(path.split('/').filter(Boolean));
    jest.mocked(authStorage.getToken).mockResolvedValue(token);
    render(createElement(RootLayout));
  }

  it.each(['/dashboard', '/contas-create', '/decisoes', '/usuario', '/reset-password', '/audit-logs'])(
    'redirects unauthenticated access to %s',
    async (path) => {
      renderRoute(path, null);

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
      expect(screen.getByText('Verificando sua sessao...')).toBeTruthy();
      expect(Stack).not.toHaveBeenCalled();
    },
  );

  it.each([
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password-token',
    '/privacidade',
  ])('allows unauthenticated access to %s', async (path) => {
    renderRoute(path, null);

    await waitFor(() => expect(Stack).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(['/login', '/register', '/'])(
    'redirects authenticated access to %s to dashboard',
    async (path) => {
      renderRoute(path, 'token');

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
      expect(Stack).not.toHaveBeenCalled();
    },
  );

  it('does not navigate before the root navigation state is ready', async () => {
    (useRootNavigationState as jest.Mock).mockReturnValue(null);
    renderRoute('/dashboard', null);

    await act(async () => {});
    expect(authStorage.getToken).toHaveBeenCalled();
    expect(screen.getByText('Verificando sua sessao...')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    expect(Stack).not.toHaveBeenCalled();
  });
});
