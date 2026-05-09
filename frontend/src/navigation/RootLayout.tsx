import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppLoading } from '../../components/app-loading';
import { getToken, subscribeAuthState } from '../../storage/authStorage';

type AuthStatus = 'authenticated' | 'loading' | 'unauthenticated';

const AUTH_ENTRY_ROUTES = new Set(['/login', '/register']);
const PUBLIC_ROUTES = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password-token',
  '/privacidade',
]);

export function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

  const currentPath = useMemo(() => {
    if (!segments.length) {
      return '/';
    }

    return `/${segments.join('/')}`;
  }, [segments]);

  useEffect(() => {
    let active = true;

    async function syncAuthState() {
      const token = await getToken();

      if (!active) {
        return;
      }

      setAuthStatus(token ? 'authenticated' : 'unauthenticated');
    }

    void syncAuthState();
    const unsubscribe = subscribeAuthState(() => {
      void syncAuthState();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const isPublicRoute = PUBLIC_ROUTES.has(currentPath);
  const shouldRedirectToLogin =
    authStatus === 'unauthenticated' && !isPublicRoute;
  const shouldRedirectToDashboard =
    authStatus === 'authenticated' &&
    (AUTH_ENTRY_ROUTES.has(currentPath) || currentPath === '/');
  const shouldBlockRender =
    authStatus === 'loading' ||
    shouldRedirectToLogin ||
    shouldRedirectToDashboard;

  useEffect(() => {
    if (!navigationState?.key || authStatus === 'loading') {
      return;
    }

    if (shouldRedirectToLogin) {
      router.replace('/login');
      return;
    }

    if (shouldRedirectToDashboard) {
      router.replace('/dashboard');
    }
  }, [
    authStatus,
    navigationState?.key,
    router,
    shouldRedirectToDashboard,
    shouldRedirectToLogin,
  ]);

  if (shouldBlockRender) {
    return <AppLoading label="Verificando sua sessao..." />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default RootLayout;
