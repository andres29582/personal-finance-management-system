import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { createElement } from 'react';
import { AppState } from 'react-native';
import { RootLayout } from '../../src/navigation/RootLayout';
import { api } from '../../src/shared/services/api';
import { suspendSessionAuthority } from '../../src/modules/auth/services/sessionAuthority';
import * as authStorage from '../../storage/authStorage';

jest.mock('expo-router', () => ({
  Stack: jest.fn(() => null),
  useRootNavigationState: jest.fn(),
  useRouter: jest.fn(),
  useSegments: jest.fn(),
}));
jest.mock('../../storage/authStorage');
jest.mock('../../src/shared/services/api', () => ({ api: { get: jest.fn() } }));

describe('RootLayout route guard', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    suspendSessionAuthority();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    (useRootNavigationState as jest.Mock).mockReturnValue({ key: 'ready' });
    jest.mocked(authStorage.subscribeAuthState).mockReturnValue(jest.fn());
    jest.mocked(authStorage.observeSessionLifecycle).mockReturnValue(jest.fn());
    jest.mocked(authStorage.getSessionGeneration).mockReturnValue(1);
    jest.mocked(authStorage.isLocallySignedOut).mockReturnValue(false);
    jest.mocked(authStorage.isSessionCurrent).mockResolvedValue(true);
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    const now = Date.now();
    jest.mocked(api.get).mockResolvedValue({
      data: {
        serverNow: new Date(now).toISOString(),
        idleExpiresAt: new Date(now + 900000).toISOString(),
        absoluteExpiresAt: new Date(now + 43200000).toISOString(),
        policyVersion: 1,
      },
    } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderRoute(path: string, token: string | null) {
    (useSegments as jest.Mock).mockReturnValue(path.split('/').filter(Boolean));
    jest.mocked(authStorage.getToken).mockResolvedValue(token);
    jest.mocked(authStorage.getSessionSnapshot).mockResolvedValue({
      generation: 1,
      incarnation: 'route-fixture',
      revision: 1,
      sessionId: token ? 'route-session' : null,
      accessToken: token,
      refreshToken: token ? 'route-refresh' : null,
    });
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
    '/prototype/slime',
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
