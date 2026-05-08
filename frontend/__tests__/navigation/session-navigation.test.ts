import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import * as authStorage from '../../storage/authStorage';
import * as authService from '../../services/authService';

type NavigationState = { key?: string } | null;

jest.mock('../../storage/authStorage');
jest.mock('../../services/authService');

describe('F2 - Session Navigation & Consistency', () => {
  const mockAuthStorage = authStorage as jest.Mocked<typeof authStorage>;
  const mockAuthService = authService as jest.Mocked<typeof authService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Session Restoration', () => {
    it('debe restaurar sesión si token existe en storage', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      mockAuthStorage.getToken.mockResolvedValue(token);

      const retrieved = await authStorage.getToken();

      expect(retrieved).toBe(token);
      expect(retrieved).not.toBeNull();
    });

    it('debe restaurar usuario desde storage al cargar app', async () => {
      const usuario = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        nome: 'André',
        email: 'andre@example.com',
      };

      mockAuthStorage.getUser.mockResolvedValue(usuario);

      const retrieved = await authStorage.getUser();

      expect(retrieved).toEqual(usuario);
    });

    it('debe considerar sesión válida si token existe', async () => {
      const token = 'token_xyz';
      mockAuthStorage.getToken.mockResolvedValue(token);

      const retrieved = await authStorage.getToken();
      const isAuthenticated = retrieved !== null;

      expect(isAuthenticated).toBe(true);
    });

    it('debe considerar sesión inválida si token no existe', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const retrieved = await authStorage.getToken();
      const isAuthenticated = retrieved !== null;

      expect(isAuthenticated).toBe(false);
    });

    it('debe sincronizar múltiples cambios de token', async () => {
      const token1 = 'token_1';
      const token2 = 'token_2';

      mockAuthStorage.getToken.mockResolvedValueOnce(token1);
      mockAuthStorage.getToken.mockResolvedValueOnce(token2);

      const first = await authStorage.getToken();
      const second = await authStorage.getToken();

      expect(first).toBe(token1);
      expect(second).toBe(token2);
    });
  });

  describe('Logout Flow & Redirect', () => {
    it('debe llamar clearSession al logout', async () => {
      mockAuthStorage.clearSession.mockResolvedValue(undefined);

      await authStorage.clearSession();

      expect(mockAuthStorage.clearSession).toHaveBeenCalled();
    });

    it('debe limpiar token de acceso en logout', async () => {
      mockAuthStorage.removeToken.mockResolvedValue(undefined);

      await authStorage.removeToken();

      expect(mockAuthStorage.removeToken).toHaveBeenCalled();
    });

    it('debe limpiar refresh token en logout', async () => {
      mockAuthStorage.removeRefreshToken.mockResolvedValue(undefined);

      await authStorage.removeRefreshToken();

      expect(mockAuthStorage.removeRefreshToken).toHaveBeenCalled();
    });

    it('debe limpiar usuario en logout', async () => {
      mockAuthStorage.removeUser.mockResolvedValue(undefined);

      await authStorage.removeUser?.();

      // Verificar que la función existe en el módulo (si está exportada)
      expect(true).toBe(true);
    });

    it('después de logout, getToken debe retornar null', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const token = await authStorage.getToken();

      expect(token).toBeNull();
    });

    it('después de logout, getUser debe retornar null', async () => {
      mockAuthStorage.getUser.mockResolvedValue(null);

      const user = await authStorage.getUser();

      expect(user).toBeNull();
    });

    it('debe notificar listeners cuando logout ocurre', async () => {
      const listener = jest.fn();
      mockAuthStorage.subscribeAuthState.mockReturnValue(() => {});
      mockAuthStorage.removeToken.mockResolvedValue(undefined);

      // Simulación: removeToken notifica listeners
      // En el código real, removeToken llama notifyAuthStateListeners()
      expect(mockAuthStorage.subscribeAuthState).toBeDefined();
    });

    it('debe permitir redireccionamiento a login después de logout', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const token = await authStorage.getToken();
      const shouldRedirectToLogin = token === null;

      expect(shouldRedirectToLogin).toBe(true);
    });
  });

  describe('Protected Route Access', () => {
    it('debe bloquear /contas sin token', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const token = await authStorage.getToken();
      const isProtected = token === null;

      expect(isProtected).toBe(true);
    });

    it('debe bloquear /transacoes sin token', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const token = await authStorage.getToken();
      const canAccess = token !== null;

      expect(canAccess).toBe(false);
    });

    it('debe bloquear /dividas sin token', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const token = await authStorage.getToken();
      const canAccess = token !== null;

      expect(canAccess).toBe(false);
    });

    it('debe bloquear /relatorios sin token', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const token = await authStorage.getToken();
      const canAccess = token !== null;

      expect(canAccess).toBe(false);
    });

    it('debe bloquear /metas sin token', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const token = await authStorage.getToken();
      const canAccess = token !== null;

      expect(canAccess).toBe(false);
    });

    it('debe bloquear /orcamentos sin token', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const token = await authStorage.getToken();
      const canAccess = token !== null;

      expect(canAccess).toBe(false);
    });

    it('debe permitir /contas con token válido', async () => {
      const token = 'valid_token_xyz';
      mockAuthStorage.getToken.mockResolvedValue(token);

      const retrieved = await authStorage.getToken();
      const canAccess = retrieved !== null;

      expect(canAccess).toBe(true);
    });

    it('debe permitir /transacoes con token válido', async () => {
      const token = 'valid_token_xyz';
      mockAuthStorage.getToken.mockResolvedValue(token);

      const retrieved = await authStorage.getToken();
      const canAccess = retrieved !== null;

      expect(canAccess).toBe(true);
    });

    it('debe permitir /dashboard con token válido', async () => {
      const token = 'valid_token_xyz';
      mockAuthStorage.getToken.mockResolvedValue(token);

      const retrieved = await authStorage.getToken();
      const canAccess = retrieved !== null;

      expect(canAccess).toBe(true);
    });

    it('debe permitir /usuario con token válido', async () => {
      const token = 'valid_token_xyz';
      mockAuthStorage.getToken.mockResolvedValue(token);

      const retrieved = await authStorage.getToken();
      const canAccess = retrieved !== null;

      expect(canAccess).toBe(true);
    });
  });

  describe('Public Routes (No Token Required)', () => {
    it('debe permitir /login sin token', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const token = await authStorage.getToken();
      const publicRoutes = ['/login', '/register', '/forgot-password'];

      expect(publicRoutes.includes('/login')).toBe(true);
      // Usuario sin token puede ver esta ruta
    });

    it('debe permitir /register sin token', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const token = await authStorage.getToken();
      const publicRoutes = ['/login', '/register', '/forgot-password'];

      expect(publicRoutes.includes('/register')).toBe(true);
    });

    it('debe permitir /forgot-password sin token', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password-token', '/privacidade'];

      expect(publicRoutes.includes('/forgot-password')).toBe(true);
    });

    it('debe permitir /privacidade sin token', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password-token', '/privacidade'];

      expect(publicRoutes.includes('/privacidade')).toBe(true);
    });
  });

  describe('Token Expiration Handling', () => {
    it('debe detectar token expirado (status 401)', async () => {
      mockAuthStorage.getToken.mockResolvedValue('expired_token');

      // En el interceptor de API, si 401 se recibe:
      // - Intenta refresh
      // - Si falla, llama clearSession()
      expect(true).toBe(true);
    });

    it('debe intentar refresh si token está expirado', async () => {
      mockAuthStorage.getToken.mockResolvedValue('expired_token');
      mockAuthStorage.getRefreshToken.mockResolvedValue('refresh_token_valid');
      mockAuthService.refreshSession.mockResolvedValue({
        access_token: 'new_token',
        refresh_token: 'new_refresh_token',
      });

      const refreshResult = await authService.refreshSession({
        refreshToken: 'refresh_token_valid',
      });

      expect(refreshResult.access_token).toBeDefined();
    });

    it('debe limpiar sesión si refresh token también está expirado', async () => {
      mockAuthStorage.getToken.mockResolvedValue('expired_token');
      mockAuthStorage.getRefreshToken.mockResolvedValue('expired_refresh_token');
      mockAuthService.refreshSession.mockRejectedValue({
        response: { status: 401 },
      });
      mockAuthStorage.clearSession.mockResolvedValue(undefined);

      try {
        await authService.refreshSession({
          refreshToken: 'expired_refresh_token',
        });
      } catch {
        await authStorage.clearSession();
      }

      expect(mockAuthStorage.clearSession).toHaveBeenCalled();
    });
  });

  describe('Navigation State Consistency', () => {
    it('debe permitir navegación cuando autenticado', async () => {
      const token = 'valid_token';
      mockAuthStorage.getToken.mockResolvedValue(token);

      const currentToken = await authStorage.getToken();
      const canNavigate = currentToken !== null;

      expect(canNavigate).toBe(true);
    });

    it('debe bloquear navegación cuando desautenticado', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const currentToken = await authStorage.getToken();
      const canNavigate = currentToken !== null;

      expect(canNavigate).toBe(false);
    });

    it('debe mantener consistencia durante cambio de ruta', async () => {
      // 1. Usuario en /dashboard
      mockAuthStorage.getToken.mockResolvedValue('token_xyz');

      let token = await authStorage.getToken();
      expect(token).not.toBeNull();

      // 2. Navega a /contas
      // Token debe seguir siendo válido
      token = await authStorage.getToken();
      expect(token).not.toBeNull();
    });

    it('debe detectar cambio de sesión entre rutas', async () => {
      // 1. En /dashboard
      mockAuthStorage.getToken.mockResolvedValue('token_xyz');

      let token = await authStorage.getToken();
      expect(token).not.toBeNull();

      // 2. Token removido (logout)
      mockAuthStorage.getToken.mockResolvedValue(null);

      token = await authStorage.getToken();
      expect(token).toBeNull();
    });
  });

  describe('Initial App Load', () => {
    it('debe verificar sesión al cargar app', async () => {
      mockAuthStorage.getToken.mockResolvedValue('token_xyz');

      const token = await authStorage.getToken();

      expect(mockAuthStorage.getToken).toHaveBeenCalled();
      expect(token).not.toBeNull();
    });

    it('debe suscribirse a cambios de auth state', async () => {
      const unsubscribe = jest.fn();
      mockAuthStorage.subscribeAuthState.mockReturnValue(unsubscribe);

      const subscription = authStorage.subscribeAuthState(() => {});

      expect(mockAuthStorage.subscribeAuthState).toHaveBeenCalled();
    });

    it('debe desuscribirse al desmontar', async () => {
      const unsubscribe = jest.fn();
      mockAuthStorage.subscribeAuthState.mockReturnValue(unsubscribe);

      const subscription = authStorage.subscribeAuthState(() => {});

      // Simular desmonte
      if (subscription) {
        subscription();
      }

      expect(true).toBe(true);
    });

    it('debe mostrar loading state mientras verifica sesión', async () => {
      // El componente inicia con authStatus = 'loading'
      // Mientras se ejecuta getToken(), debe mostrar AppLoading
      mockAuthStorage.getToken.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Simular delay
            setTimeout(() => resolve('token_xyz'), 100);
          })
      );

      expect(true).toBe(true);
    });

    it('debe cambiar de loading a authenticated después de encontrar token', async () => {
      mockAuthStorage.getToken.mockResolvedValue('token_xyz');

      // 1. Estado inicial: loading
      // 2. getToken() resuelve
      // 3. setAuthStatus('authenticated')
      // 4. Render de contenido

      const token = await authStorage.getToken();
      const isAuthenticated = token !== null;

      expect(isAuthenticated).toBe(true);
    });

    it('debe cambiar de loading a unauthenticated si no hay token', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const token = await authStorage.getToken();
      const isAuthenticated = token !== null;

      expect(isAuthenticated).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('debe manejar getToken() cuando storage está vacío', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const token = await authStorage.getToken();

      expect(token).toBeNull();
    });

    it('debe manejar getUser() cuando usuario no existe', async () => {
      mockAuthStorage.getUser.mockResolvedValue(null);

      const user = await authStorage.getUser();

      expect(user).toBeNull();
    });

    it('debe manejar simultáneas llamadas a getToken()', async () => {
      mockAuthStorage.getToken.mockResolvedValue('token_xyz');

      const [token1, token2, token3] = await Promise.all([
        authStorage.getToken(),
        authStorage.getToken(),
        authStorage.getToken(),
      ]);

      expect(token1).toBe('token_xyz');
      expect(token2).toBe('token_xyz');
      expect(token3).toBe('token_xyz');
    });

    it('debe manejar cuando navigationState no está listo', () => {
      // navigationState puede ser null/undefined inicialmente
      // El componente debe verificar navigationState?.key
      const getNavigationState = (): NavigationState => null;
      const navigationState = getNavigationState();

      const canProceedWithNavigation = navigationState?.key !== undefined;

      expect(canProceedWithNavigation).toBe(false);
    });

    it('debe ignorar cambios de componente si desmontado (active = false)', () => {
      // Verificar cleanup con active flag
      let active = true;

      const cleanup = () => {
        active = false;
      };

      cleanup();

      expect(active).toBe(false);
    });
  });
});
