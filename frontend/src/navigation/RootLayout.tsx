import {
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { AppState, Platform, Pressable, Text, View } from "react-native";
import { api } from "../shared/services/api";
import { logoutLocally } from "../modules/auth/services/logoutCoordinator";
import {
  confirmSessionAuthority,
  getSessionAuthority,
  subscribeSessionAuthority,
  suspendSessionAuthority,
  Authority,
} from "../modules/auth/services/sessionAuthority";
import { AppLoading } from "../../components/app-loading";
import {
  getSessionGeneration,
  getToken,
  isLocallySignedOut,
  subscribeAuthState,
  observeSessionLifecycle,
} from "../../storage/authStorage";
type AuthStatus =
  | "authenticated"
  | "loading"
  | "unauthenticated"
  | "unavailable";
const AUTH_ENTRY_ROUTES = new Set(["/login", "/register"]);
const PUBLIC_ROUTES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password-token",
  "/privacidade",
  "/prototype/slime",
]);
export function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authority, setAuthority] = useState<Authority>(null);
  const [countdown, setCountdown] = useState<{ authority: Authority; seconds: number } | null>(null);
  const secondsLeft = !authority ? null : countdown?.authority === authority ? countdown.seconds : Math.max(0, Math.ceil((Date.parse(authority.state.idleExpiresAt) - Date.parse(authority.state.serverNow)) / 1000));
  const [retry, setRetry] = useState(0);
  const currentPath = useMemo(() => {
    if (!segments.length) {
      return "/";
    }
    return `/${segments.join("/")}`;
  }, [segments]);
  useEffect(() => {
    let active = true,
      sequence = 0,
      background = false;
    const stopObserving = observeSessionLifecycle();
    async function syncAuthState() {
      const run = ++sequence;
      suspendSessionAuthority();
      setAuthStatus("loading");
      setAuthority(null);
      if (isLocallySignedOut()) {
        setAuthStatus("unauthenticated");
        return;
      }
      if (background) return;
      const generation = getSessionGeneration();
      try {
        const token = await getToken();
        if (
          !active ||
          run !== sequence ||
          generation !== getSessionGeneration()
        )
          return;
        if (!token) {
          setAuthStatus("unauthenticated");
          return;
        }
        await confirmSessionAuthority(() =>
          api.get("/auth/session", { timeout: 5000 }),
        );
        if (!active || run !== sequence) return;
        const current = getSessionAuthority();
        if (current && current.snapshot.generation === getSessionGeneration()) {
          setAuthority(current);
          setAuthStatus("authenticated");
        } else setAuthStatus("unavailable");
      } catch {
        if (!active || run !== sequence) return;
        setAuthStatus(isLocallySignedOut() ? "unauthenticated" : "unavailable");
      }
    }
    const unsubscribeAuthority = subscribeSessionAuthority(() => {
      if (!active) return;
      const current = getSessionAuthority();
      if (
        current &&
        !background &&
        current.snapshot.generation === getSessionGeneration()
      ) {
        setAuthority(current);
        setAuthStatus("authenticated");
      } else {
        setAuthority(null);
        setAuthStatus(isLocallySignedOut() ? "unauthenticated" : "unavailable");
      }
    });
    const onResume = () => {
      background = false;
      suspendSessionAuthority();
      void syncAuthState();
    };
    const onSuspend = () => {
      background = true;
      ++sequence;
      suspendSessionAuthority();
    };
    let stopLifecycle: () => void;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const visibility = () => {
        if (document.visibilityState === "visible") onResume();
        else onSuspend();
      };
      window.addEventListener("pageshow", onResume);
      window.addEventListener("pagehide", onSuspend);
      document.addEventListener("visibilitychange", visibility);
      stopLifecycle = () => {
        window.removeEventListener("pageshow", onResume);
        window.removeEventListener("pagehide", onSuspend);
        document.removeEventListener("visibilitychange", visibility);
      };
    } else {
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") onResume();
        else onSuspend();
      });
      stopLifecycle = () => subscription.remove();
    }
    void syncAuthState();
    const unsubscribe = subscribeAuthState(() => {
      const current = getSessionAuthority();
      // Profile metadata updates keep the same confirmed owner. Revalidating
      // them would unmount Stack and discard the route being loaded.
      if (
        current &&
        !background &&
        !isLocallySignedOut() &&
        current.snapshot.generation === getSessionGeneration()
      )
        return;
      void syncAuthState();
    });
    return () => {
      active = false;
      ++sequence;
      unsubscribe();
      unsubscribeAuthority();
      stopObserving();
      stopLifecycle();
    };
  }, [retry]);
  useEffect(() => {
    if (!authority) return;
    const interval =
      Date.parse(authority.state.idleExpiresAt) -
      Date.parse(authority.state.serverNow);
    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((interval - (Date.now() - authority.receivedAt)) / 1000),
      );
      setCountdown({ authority, seconds: remaining });
      if (remaining === 0) {
        suspendSessionAuthority();
        setRetry((value) => value + 1);
      }
    };
    // Expired authority must be hidden immediately; ticks trigger revalidation.
    if (interval - (Date.now() - authority.receivedAt) <= 0) suspendSessionAuthority();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [authority]);
  const isPublicRoute = PUBLIC_ROUTES.has(currentPath);
  const shouldRedirectToLogin =
    authStatus === "unauthenticated" && !isPublicRoute;
  const shouldRedirectToDashboard =
    authStatus === "authenticated" &&
    (AUTH_ENTRY_ROUTES.has(currentPath) || currentPath === "/");
  const shouldBlockRender =
    authStatus === "loading" ||
    (!isPublicRoute && authStatus === "unavailable") ||
    shouldRedirectToLogin ||
    shouldRedirectToDashboard;
  useEffect(() => {
    if (!navigationState?.key || authStatus === "loading") {
      return;
    }
    if (shouldRedirectToLogin) {
      router.replace("/login");
      return;
    }
    if (shouldRedirectToDashboard) {
      router.replace("/dashboard");
    }
  }, [
    authStatus,
    navigationState?.key,
    router,
    shouldRedirectToDashboard,
    shouldRedirectToLogin,
  ]);
  if (authStatus === "unavailable" && !isPublicRoute) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text accessibilityRole="alert">
          Nao foi possivel confirmar sua sessao. Seus dados permanecem ocultos.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setRetry((value) => value + 1)}
        >
          <Text>Tentar novamente</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void logoutLocally().completion;
          }}
        >
          <Text>Sair somente neste dispositivo</Text>
        </Pressable>
      </View>
    );
  }
  if (shouldBlockRender) {
    return <AppLoading label="Verificando sua sessao..." />;
  }
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      {authStatus === "authenticated" &&
        secondsLeft !== null &&
        secondsLeft <= 60 && (
          <Text accessibilityRole="alert">
            Sua sessao pode expirar em {secondsLeft} segundos. Ler ou digitar
            sem enviar uma acao nao renova a sessao.
          </Text>
        )}
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
export default RootLayout;
