import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getSessionGeneration,
  getSessionSnapshot,
  isLocalLogoutCurrent,
  isSessionCurrent,
  SessionSnapshot,
  subscribeAuthState,
} from "../../../../storage/authStorage";
import { resolveApiError } from "../../../../utils/api-error";
import { SessionRequestError } from "../../../../utils/session-error";
import { FinanceTheme } from "../../../shared/styles/financeTheme";
import {
  AppShell,
  FinanceAppHeader,
  GlassButton,
  GlassField,
  GlassPanel,
  GlassStatusCard,
  GlassTextInput,
} from "../../../shared/ui";
import { logout } from "../services/logoutCoordinator";
import {
  getSessionAuthorityEpoch,
  suspendOwnedSessionAuthority,
} from "../services/sessionAuthority";
import {
  listSessions,
  OwnSession,
  OwnSessionPage,
  revokeAllSessions,
  revokeSession,
} from "../services/sessionManagement";

type Confirmation = { target: OwnSession | null; origin: SessionSnapshot };
export function SessionsScreen() {
  const router = useRouter();
  const [page, setPage] = useState<OwnSessionPage | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const active = useRef(true),
    sequence = useRef(0),
    mutating = useRef(false);
  const current = useCallback(async (origin: SessionSnapshot, run?: number) => {
    const owned = await isSessionCurrent(origin);
    return (
      owned &&
      active.current &&
      (run === undefined || run === sequence.current) &&
      origin.generation === getSessionGeneration()
    );
  }, []);
  useEffect(() => {
    active.current = true;
    let generation = getSessionGeneration();
    const unsubscribe = subscribeAuthState(() => {
      if (generation !== getSessionGeneration()) {
        generation = getSessionGeneration();
        sequence.current++;
        setPage(null);
        setConfirmation(null);
        setPassword("");
        setMessage("");
        setBusy(false);
        setLoading(false);
      }
    });
    return () => {
      active.current = false;
      sequence.current++;
      unsubscribe();
    };
  }, []);
  const load = useCallback(
    async (cursor?: string, expected?: SessionSnapshot) => {
      const run = ++sequence.current;
      const origin = expected ?? (await getSessionSnapshot());
      if (!(await current(origin, run))) return;
      try {
        const result = await listSessions(origin, cursor);
        if (!(await current(origin, run))) return;
        setPage(result);
      } catch (error) {
        if (!(await current(origin, run))) return;
        const resolved = await resolveApiError(
          error,
          "Nao foi possivel carregar suas sessoes.",
        );
        if (!(await current(origin, run))) return;
        setPage(null);
        setMessage(resolved.message);
      } finally {
        if (await current(origin, run)) setLoading(false);
      }
    },
    [current],
  );
  useEffect(() => {
    let cancelled = false;
    void getSessionSnapshot().then(origin => {
      if (!cancelled) void load(undefined, origin);
    });
    return () => { cancelled = true; };
  }, [load]);
  function reload(cursor?: string, expected?: SessionSnapshot) {
    setLoading(true);
    setMessage("");
    return load(cursor, expected);
  }
  async function openConfirmation(target: OwnSession | null) {
    const origin = await getSessionSnapshot();
    if (!(await current(origin)) || mutating.current) return;
    setPassword("");
    setMessage("");
    setConfirmation({ target, origin });
  }
  function cancel() {
    if (mutating.current) return;
    setPassword("");
    setConfirmation(null);
  }
  async function confirm() {
    if (!confirmation || !password || mutating.current) return;
    const { origin, target } = confirmation;
    const epoch = getSessionAuthorityEpoch();
    if (!(await current(origin))) return;
    mutating.current = true;
    setBusy(true);
    setMessage("");
    let submittedPassword = password;
    setPassword("");
    try {
      if (target) {
        await revokeSession(target.id, submittedPassword, origin);
        submittedPassword = "";
        if (!(await current(origin))) return;
        setConfirmation(null);
        await reload(undefined, origin);
      } else {
        const operation = await revokeAllSessions(submittedPassword, origin);
        submittedPassword = "";
        await operation.completion;
        if (
          active.current &&
          (await isLocalLogoutCurrent(operation.generation))
        )
          router.replace("/login");
      }
    } catch (error) {
      submittedPassword = "";
      if (!(await current(origin))) return;
      const status = (error as { response?: { status?: number } }).response
        ?.status;
      if (!status || status >= 500 || error instanceof SessionRequestError) {
        setPage(null);
        setConfirmation(null);
        setMessage(
          "Nao foi possivel confirmar o encerramento. A acao nao sera reenviada automaticamente.",
        );
        await suspendOwnedSessionAuthority(origin, epoch);
      } else {
        const resolved = await resolveApiError(
          error,
          "Nao foi possivel encerrar a sessao.",
        );
        if (!(await current(origin))) return;
        setMessage(resolved.message);
      }
    } finally {
      submittedPassword = "";
      mutating.current = false;
      if (await current(origin)) {
        setPassword("");
        setBusy(false);
      }
    }
  }
  async function endCurrent() {
    const operation = logout();
    await operation.completion;
    if (active.current && (await isLocalLogoutCurrent(operation.generation)))
      router.replace("/login");
  }
  return (
    <AppShell
      activeRoute="/usuario"
      onProfilePress={() => router.replace("/usuario")}
      pageHeader={
        <FinanceAppHeader
          eyebrow="Seguranca"
          title="Sessoes"
          subtitle="Gerencie os acessos da sua conta"
          action={
            <GlassButton
              label="Voltar"
              variant="ghost"
              disabled={busy}
              onPress={() => router.replace("/usuario")}
            />
          }
        />
      }
    >
      <GlassPanel>
        <Text style={styles.text}>
          Sessoes ativas nao indicam que um dispositivo esta conectado agora.
          Ler esta lista nao renova a sessao.
        </Text>
        <GlassButton
          label="Atualizar lista"
          variant="ghost"
          disabled={busy || loading}
          onPress={() => void load()}
        />
        <GlassButton
          label="Sair desta sessao"
          variant="ghost"
          onPress={() => void endCurrent()}
        />
      </GlassPanel>
      {loading ? (
        <GlassStatusCard
          title="Carregando sessoes"
          description="Consultando os acessos ativos."
          loading
        />
      ) : null}
      {!confirmation && message ? (
        <GlassStatusCard
          title="Sessoes indisponiveis"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={() => void reload()}
        />
      ) : null}
      {page?.items.length === 0 ? (
        <GlassStatusCard
          title="Nenhuma sessao ativa"
          description="Atualize a lista para confirmar o estado atual."
        />
      ) : null}
      {page?.items.map((item) => (
        <GlassPanel key={item.id}>
          <Text style={styles.title}>
            {item.isCurrent ? "Sessao atual" : "Dispositivo nao identificado"}
          </Text>
          <Text style={styles.text}>
            Inicio: {new Date(item.authenticatedAt).toLocaleString("pt-BR")}
          </Text>
          <Text style={styles.text}>
            Ultima atividade:{" "}
            {new Date(item.lastActivityAt).toLocaleString("pt-BR")}
          </Text>
          <Text style={styles.text}>
            Expiracao por inatividade:{" "}
            {new Date(item.idleExpiresAt).toLocaleString("pt-BR")}
          </Text>
          <Text style={styles.text}>
            Limite absoluto:{" "}
            {new Date(item.absoluteExpiresAt).toLocaleString("pt-BR")}
          </Text>
          {!item.isCurrent ? (
            <GlassButton
              label="Encerrar esta sessao"
              variant="danger"
              disabled={busy || loading}
              onPress={() => void openConfirmation(item)}
            />
          ) : null}
        </GlassPanel>
      ))}
      {page?.nextCursor ? (
        <GlassButton
          label="Proxima pagina"
          variant="ghost"
          disabled={busy || loading}
          onPress={() => void reload(page.nextCursor!)}
        />
      ) : null}
      {page ? (
        <GlassButton
          label="Encerrar todas, incluindo esta sessao"
          variant="danger"
          disabled={busy || loading}
          onPress={() => void openConfirmation(null)}
        />
      ) : null}
      <Modal
        visible={confirmation !== null}
        transparent
        animationType="fade"
        onRequestClose={cancel}
      >
        <SafeAreaView style={styles.overlay} accessibilityViewIsModal>
          <KeyboardAvoidingView style={styles.viewport} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={styles.dialogContent} keyboardShouldPersistTaps="handled">
          <View style={styles.dialog}>
            <Text accessibilityRole="header" style={styles.title}>
              {confirmation?.target
                ? "Encerrar sessao remota"
                : "Encerrar todas as sessoes"}
            </Text>
            <Text style={styles.text}>
              {confirmation?.target
                ? "Esta sessao atual continuara ativa."
                : "Todos os acessos serao encerrados, incluindo esta sessao. Voce precisara entrar novamente."}
            </Text>
            <GlassField label="Senha atual">
              <GlassTextInput
                accessibilityLabel="Senha atual para confirmar encerramento"
                autoFocus
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
                editable={!busy}
                maxLength={1024}
                onSubmitEditing={() => void confirm()}
              />
            </GlassField>
            {message ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {message}
              </Text>
            ) : null}
            <GlassButton
              label={busy ? "Confirmando..." : "Confirmar encerramento"}
              variant="danger"
              disabled={busy || !password}
              onPress={() => void confirm()}
            />
            <GlassButton
              label="Cancelar"
              variant="ghost"
              disabled={busy}
              onPress={cancel}
            />
          </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </AppShell>
  );
}
const styles = StyleSheet.create({
  text: {
    color: FinanceTheme.colors.textMuted,
    marginBottom: FinanceTheme.spacing.sm,
  },
  title: {
    color: FinanceTheme.colors.text,
    fontWeight: "800",
    marginBottom: FinanceTheme.spacing.sm,
  },
  error: {
    color: FinanceTheme.colors.danger,
    marginBottom: FinanceTheme.spacing.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  viewport: { flex: 1 },
  dialogContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  dialog: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: FinanceTheme.colors.background,
    padding: 24,
    borderRadius: 16,
    gap: 12,
  },
});
export default SessionsScreen;
