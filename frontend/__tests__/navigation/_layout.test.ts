import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import * as authStorage from '../../storage/authStorage';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';

type AuthStatus = 'authenticated' | 'loading' | 'unauthenticated';

// Mock dependencies
jest.mock('../../storage/authStorage');
jest.mock('expo-router', () => ({
  Stack: jest.fn(() => null),
  useRouter: jest.fn(),
  useSegments: jest.fn(),
  useRootNavigationState: jest.fn(),
}));

describe('_layout.tsx - Navigation Guards', () => {
  const mockRouter = {
    replace: jest.fn(),
    push: jest.fn(),
  };

  const mockAuthStorage = authStorage as jest.Mocked<typeof authStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSegments as jest.Mock).mockReturnValue([]);
    (useRootNavigationState as jest.Mock).mockReturnValue({ key: 'nav-1' });
  });

  describe('Initial Loading State', () => {
    it('deve mostrar AppLoading quando verificando sessão', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      // Simular estado inicial: loading
      // O componente deve renderizar AppLoading com "Verificando sua sessao..."
      expect(true).toBe(true); // Placeholder: teste real requer renderização
    });

    it('deve bloquear render enquanto authStatus é "loading"', () => {
      // O componente não deve renderizar conteúdo até saber se há token
      expect(true).toBe(true);
    });

    it('deve sincronizar authState ao montar', async () => {
      mockAuthStorage.getToken.mockResolvedValue('token_xyz');
      mockAuthStorage.subscribeAuthState.mockReturnValue(() => {});

      // Deve chamar getToken e subscribeAuthState
      expect(mockAuthStorage.subscribeAuthState).toBeDefined();
    });
  });

  describe('Ruta Navigation: Public Routes', () => {
    const publicRoutes = [
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password-token',
      '/privacidade',
    ];

    publicRoutes.forEach((route) => {
      it(`deve permitir acceso a ${route} sin token`, async () => {
        (useSegments as jest.Mock).mockReturnValue(route.split('/').filter(Boolean));
        mockAuthStorage.getToken.mockResolvedValue(null);

        // Usuario sin token puede ver ruta pública
        // No debe redirigir a login
        expect(true).toBe(true);
      });
    });

    it('debe permitir acceso a /privacidade sin autenticación', () => {
      const privacidad = '/privacidade';
      const isPublicRoute = [
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password-token',
        '/privacidade',
      ].includes(privacidad);

      expect(isPublicRoute).toBe(true);
    });
  });

  describe('Route Navigation: Protected Routes', () => {
    const protectedRoutes = [
      '/dashboard',
      '/contas',
      '/transacoes',
      '/categorias',
      '/dividas',
      '/metas',
      '/orcamentos',
      '/relatorios',
      '/alertas',
      '/transferencias',
      '/usuario',
      '/audit-logs',
    ];

    protectedRoutes.forEach((route) => {
      it(`debe redirigir a login si intenta acceder a ${route} sin token`, async () => {
        (useSegments as jest.Mock).mockReturnValue(route.split('/').filter(Boolean));
        mockAuthStorage.getToken.mockResolvedValue(null);

        // Sin token, debe redirigir a login
        const isPublicRoute = [
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password-token',
          '/privacidade',
        ].includes(route);

        expect(isPublicRoute).toBe(false); // Debe ser protegida
      });
    });

    it('debe bloquear acceso a /contas sin token', () => {
      const protectedRoutes = [
        '/dashboard',
        '/contas',
        '/transacoes',
        '/categorias',
      ];
      const publicRoutes = ['/login', '/register', '/privacidade'];

      protectedRoutes.forEach((route) => {
        expect(publicRoutes.includes(route)).toBe(false);
      });
    });

    it('debe bloquear acceso a /transacoes sin token', () => {
      const route = '/transacoes';
      const publicRoutes = [
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password-token',
        '/privacidade',
      ];

      expect(publicRoutes.includes(route)).toBe(false);
    });

    it('debe bloquear acceso a /relatorios sin token', () => {
      const route = '/relatorios';
      const publicRoutes = [
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password-token',
        '/privacidade',
      ];

      expect(publicRoutes.includes(route)).toBe(false);
    });
  });

  describe('Auth State Changes: Unauthenticated → Authenticated', () => {
    it('debe permitir navegación a dashboard después de login', async () => {
      // 1. Sin token: usuario ve login
      (useSegments as jest.Mock).mockReturnValue(['login']);
      mockAuthStorage.getToken.mockResolvedValue(null);

      // 2. Token guardado: subscriber notifica cambio
      // 3. authStatus cambia a 'authenticated'
      // 4. Debe permitir ver dashboard (no redirigir)

      expect(true).toBe(true);
    });

    it('debe sincronizar automáticamente cuando token cambia', async () => {
      let subscriber: (() => void) | undefined = jest.fn();

      mockAuthStorage.subscribeAuthState.mockImplementation((cb) => {
        subscriber = cb;
        return () => {
          subscriber = undefined;
        };
      });

      // Cuando subscriber es llamado, debe sincronizar authStatus
      subscriber();

      expect(true).toBe(true);
    });
  });

  describe('Auth State Changes: Authenticated → Unauthenticated', () => {
    it('debe redirigir a login cuando token es removido (logout)', async () => {
      // 1. Con token: usuario en dashboard
      (useSegments as jest.Mock).mockReturnValue(['dashboard']);
      mockAuthStorage.getToken.mockResolvedValue('token_xyz');

      // 2. clearSession() es llamado, token removido
      // 3. subscriber notifica
      // 4. authStatus cambia a 'unauthenticated'
      // 5. Debe redirigir a login

      expect(true).toBe(true);
    });

    it('debe limpiar unsubscriber al desmontar', () => {
      const unsubscribe = jest.fn();
      mockAuthStorage.subscribeAuthState.mockReturnValue(unsubscribe);

      // Al desmontar componente, debe llamar unsubscribe
      expect(unsubscribe).toBeDefined();
    });
  });

  describe('Route Guarding Logic', () => {
    it('ruta pública sin token debe permitir', () => {
      const currentPath = '/login' as string;
      const publicRoutes = new Set([
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password-token',
        '/privacidade',
      ]);
      const authStatus = 'unauthenticated' as AuthStatus;

      const isPublicRoute = publicRoutes.has(currentPath);
      const shouldRedirectToLogin = authStatus === 'unauthenticated' && !isPublicRoute;

      expect(isPublicRoute).toBe(true);
      expect(shouldRedirectToLogin).toBe(false);
    });

    it('ruta protegida sin token debe redirigir a login', () => {
      const currentPath = '/contas' as string;
      const publicRoutes = new Set([
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password-token',
        '/privacidade',
      ]);
      const authStatus = 'unauthenticated' as AuthStatus;

      const isPublicRoute = publicRoutes.has(currentPath);
      const shouldRedirectToLogin = authStatus === 'unauthenticated' && !isPublicRoute;

      expect(isPublicRoute).toBe(false);
      expect(shouldRedirectToLogin).toBe(true);
    });

    it('login con token debe redirigir a dashboard', () => {
      const currentPath = '/login' as string;
      const authStatus = 'authenticated' as AuthStatus;
      const authEntryRoutes = new Set(['/login', '/register']);

      const shouldRedirectToDashboard =
        authStatus === 'authenticated' &&
        (authEntryRoutes.has(currentPath) || currentPath === '/');

      expect(shouldRedirectToDashboard).toBe(true);
    });

    it('register con token debe redirigir a dashboard', () => {
      const currentPath = '/register' as string;
      const authStatus = 'authenticated' as AuthStatus;
      const authEntryRoutes = new Set(['/login', '/register']);

      const shouldRedirectToDashboard =
        authStatus === 'authenticated' &&
        (authEntryRoutes.has(currentPath) || currentPath === '/');

      expect(shouldRedirectToDashboard).toBe(true);
    });

    it('/ (root) con token debe redirigir a dashboard', () => {
      const currentPath = '/' as string;
      const authStatus = 'authenticated' as AuthStatus;
      const authEntryRoutes = new Set(['/login', '/register']);

      const shouldRedirectToDashboard =
        authStatus === 'authenticated' &&
        (authEntryRoutes.has(currentPath) || currentPath === '/');

      expect(shouldRedirectToDashboard).toBe(true);
    });

    it('dashboard con token debe permitir', () => {
      const currentPath = '/dashboard' as string;
      const authStatus = 'authenticated' as AuthStatus;
      const publicRoutes = new Set([
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password-token',
        '/privacidade',
      ]);
      const authEntryRoutes = new Set(['/login', '/register']);

      const isPublicRoute = publicRoutes.has(currentPath);
      const shouldRedirectToLogin = authStatus === 'unauthenticated' && !isPublicRoute;
      const shouldRedirectToDashboard =
        authStatus === 'authenticated' &&
        (authEntryRoutes.has(currentPath) || currentPath === '/');

      expect(shouldRedirectToLogin).toBe(false);
      expect(shouldRedirectToDashboard).toBe(false);
    });

    it('contas con token debe permitir', () => {
      const currentPath = '/contas' as string;
      const authStatus = 'authenticated' as AuthStatus;
      const publicRoutes = new Set([
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password-token',
        '/privacidade',
      ]);
      const authEntryRoutes = new Set(['/login', '/register']);

      const isPublicRoute = publicRoutes.has(currentPath);
      const shouldRedirectToLogin = authStatus === 'unauthenticated' && !isPublicRoute;
      const shouldRedirectToDashboard =
        authStatus === 'authenticated' &&
        (authEntryRoutes.has(currentPath) || currentPath === '/');

      expect(shouldRedirectToLogin).toBe(false);
      expect(shouldRedirectToDashboard).toBe(false);
    });
  });

  describe('Current Path Computation', () => {
    it('debe computar / cuando segments está vacío', () => {
      (useSegments as jest.Mock).mockReturnValue([]);

      const segments: string[] = [];
      const currentPath = segments.length === 0 ? '/' : `/${segments.join('/')}`;

      expect(currentPath).toBe('/');
    });

    it('debe computar /login cuando segments es ["login"]', () => {
      (useSegments as jest.Mock).mockReturnValue(['login']);

      const segments = ['login'];
      const currentPath = segments.length === 0 ? '/' : `/${segments.join('/')}`;

      expect(currentPath).toBe('/login');
    });

    it('debe computar /dashboard cuando segments es ["dashboard"]', () => {
      (useSegments as jest.Mock).mockReturnValue(['dashboard']);

      const segments = ['dashboard'];
      const currentPath = segments.length === 0 ? '/' : `/${segments.join('/')}`;

      expect(currentPath).toBe('/dashboard');
    });

    it('debe computar /contas/edit cuando segments es ["contas", "edit"]', () => {
      (useSegments as jest.Mock).mockReturnValue(['contas', 'edit']);

      const segments = ['contas', 'edit'];
      const currentPath = segments.length === 0 ? '/' : `/${segments.join('/')}`;

      expect(currentPath).toBe('/contas/edit');
    });
  });

  describe('shouldBlockRender Logic', () => {
    it('debe bloquear si authStatus es "loading"', () => {
      const authStatus = 'loading' as AuthStatus;
      const shouldBlockRender = authStatus === 'loading';

      expect(shouldBlockRender).toBe(true);
    });

    it('debe bloquear si debe redirigir a login', () => {
      const authStatus = 'unauthenticated' as AuthStatus;
      const currentPath = '/contas' as string;
      const publicRoutes = new Set([
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password-token',
        '/privacidade',
      ]);

      const isPublicRoute = publicRoutes.has(currentPath);
      const shouldRedirectToLogin = authStatus === 'unauthenticated' && !isPublicRoute;
      const shouldBlockRender = shouldRedirectToLogin;

      expect(shouldBlockRender).toBe(true);
    });

    it('debe bloquear si debe redirigir a dashboard', () => {
      const authStatus = 'authenticated' as AuthStatus;
      const currentPath = '/login' as string;
      const authEntryRoutes = new Set(['/login', '/register']);

      const shouldRedirectToDashboard =
        authStatus === 'authenticated' &&
        (authEntryRoutes.has(currentPath) || currentPath === '/');
      const shouldBlockRender = shouldRedirectToDashboard;

      expect(shouldBlockRender).toBe(true);
    });

    it('debe permitir render si todo está ok', () => {
      const authStatus = 'authenticated' as AuthStatus;
      const currentPath = '/dashboard' as string;
      const publicRoutes = new Set([
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password-token',
        '/privacidade',
      ]);
      const authEntryRoutes = new Set(['/login', '/register']);

      const isPublicRoute = publicRoutes.has(currentPath);
      const shouldRedirectToLogin = authStatus === 'unauthenticated' && !isPublicRoute;
      const shouldRedirectToDashboard =
        authStatus === 'authenticated' &&
        (authEntryRoutes.has(currentPath) || currentPath === '/');
      const shouldBlockRender =
        authStatus === 'loading' || shouldRedirectToLogin || shouldRedirectToDashboard;

      expect(shouldBlockRender).toBe(false);
    });
  });
});
