import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AppButton } from "../components/app-button";
import { AppMessage } from "../components/app-message";
import { AppCard, AppScreen, AppStatusCard } from "../components/app-screen";
import { ContaTheme } from "../constants/contas-theme";
import { logoutSession } from "../services/authService";
import { getDashboard } from "../services/dashboardService";
import { clearSession, getUser } from "../storage/authStorage";
import { UsuarioLogado } from "../types/auth";
import { DashboardResponse } from "../types/dashboard";
import { resolveApiError } from "../utils/api-error";
import { formatCurrency, formatDate } from "../utils/formatters";

const shortcuts = [
  { label: "Contas", route: "/contas" as const },
  { label: "Categorias", route: "/categorias" as const },
  { label: "Transacoes", route: "/transacoes" as const },
  { label: "Orcamentos", route: "/orcamentos" as const },
  { label: "Relatorios", route: "/relatorios" as const },
  { label: "Auditoria", route: "/audit-logs" as const },
  { label: "Previsao ML", route: "/previsao-deficit" as const },
  { label: "Metas", route: "/metas" as const },
  { label: "Alertas", route: "/alertas" as const },
  { label: "Transferencias", route: "/transferencias" as const },
  { label: "Dividas", route: "/dividas" as const },
  { label: "Senha", route: "/reset-password" as const },
];

export default function DashboardScreen() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      const [user, dashboardData] = await Promise.all([
        getUser(),
        getDashboard(),
      ]);
      setUsuario(user);
      setDashboard(dashboardData);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        "Nao foi possivel carregar o dashboard.",
      );
      setMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  async function handleLogout() {
    try {
      await logoutSession();
    } finally {
      await clearSession();
      router.replace("/login");
    }
  }

  return (
    <AppScreen
      title={`Ola${usuario?.nome ? `, ${usuario.nome}` : ""}`}
      subtitle={usuario?.email ?? "Resumo financeiro do mes"}
      headerStart={
        <TouchableOpacity
          accessibilityLabel="Abrir perfil do usuario"
          onPress={() => router.push("/usuario")}
          style={styles.userIconButton}
        >
          <Image
            source={require("../assets/images/icone-usuario.png")}
            style={styles.userIcon}
          />
        </TouchableOpacity>
      }
      actionLabel="Sair"
      onActionPress={handleLogout}
    >
      {message && dashboard ? (
        <AppMessage tone="error" value={message} />
      ) : null}

      {loading && !dashboard ? (
        <AppStatusCard
          title="Carregando dashboard"
          description="Estamos reunindo seu resumo financeiro mais recente."
          loading
        />
      ) : null}

      {!loading && !!message && !dashboard ? (
        <AppStatusCard
          title="Nao foi possivel carregar o dashboard"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadDashboard}
        />
      ) : null}

      {!loading && !message && !dashboard ? (
        <AppStatusCard
          title="Dashboard indisponivel"
          description="Nao encontramos dados para montar o painel neste momento."
          actionLabel="Atualizar"
          onActionPress={loadDashboard}
        />
      ) : null}

      {dashboard ? (
        <>
          <View style={styles.metricsGrid}>
            <AppCard>
              <Text style={styles.metricLabel}>Saldo total</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(dashboard.saldoTotal)}
              </Text>
            </AppCard>
            <AppCard>
              <Text style={styles.metricLabel}>Receitas do mes</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(dashboard.receitasMes)}
              </Text>
            </AppCard>
            <AppCard>
              <Text style={styles.metricLabel}>Despesas do mes</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(dashboard.despesasMes)}
              </Text>
            </AppCard>
            <AppCard>
              <Text style={styles.metricLabel}>Economia</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(dashboard.economiaMes)}
              </Text>
            </AppCard>
          </View>

          {dashboard.totalContas === 0 ? (
            <AppStatusCard
              title="Comece criando sua primeira conta"
              description="As contas sao a base para registrar transacoes, orcamentos e relatorios."
              actionLabel="Nova conta"
              onActionPress={() => router.push("/contas-create" as never)}
            />
          ) : null}

          <AppCard>
            <Text style={styles.sectionTitle}>Gastos por categoria</Text>
            {dashboard.gastosPorCategoria.length ? (
              dashboard.gastosPorCategoria.map((item) => (
                <View key={item.categoriaId} style={styles.row}>
                  <Text style={styles.rowLabel}>{item.categoriaNome}</Text>
                  <Text style={styles.rowValue}>
                    {formatCurrency(item.total)} ({item.percentual}%)
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>
                Nenhuma despesa registrada neste mes.
              </Text>
            )}
          </AppCard>

          <AppCard>
            <Text style={styles.sectionTitle}>Ultimas transacoes</Text>
            {dashboard.transacoesRecentes.length ? (
              dashboard.transacoesRecentes.map((item) => (
                <View key={item.id} style={styles.listItem}>
                  <Text style={styles.rowLabel}>
                    {item.descricao || item.categoriaNome}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.contaNome} - {formatDate(item.data)}
                  </Text>
                  <Text style={styles.rowValue}>
                    {formatCurrency(item.valor)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Sem transacoes recentes.</Text>
            )}
          </AppCard>

          <AppCard>
            <Text style={styles.sectionTitle}>Atalhos</Text>
            <View style={styles.shortcutGrid}>
              {shortcuts.map((item) => (
                <View key={item.route} style={styles.shortcutCell}>
                  <AppButton
                    label={item.label}
                    onPress={() => router.push(item.route as never)}
                    variant="ghost"
                  />
                </View>
              ))}
            </View>
          </AppCard>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.body,
  },
  listItem: {
    borderBottomColor: ContaTheme.colors.border,
    borderBottomWidth: 1,
    paddingVertical: ContaTheme.spacing.sm,
  },
  metricLabel: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
  },
  metricValue: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.heading,
    fontWeight: "700",
    marginTop: ContaTheme.spacing.xs,
  },
  metricsGrid: {
    gap: ContaTheme.spacing.sm,
  },
  row: {
    borderBottomColor: ContaTheme.colors.border,
    borderBottomWidth: 1,
    paddingVertical: ContaTheme.spacing.sm,
  },
  rowLabel: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    fontWeight: "600",
  },
  rowMeta: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    marginTop: ContaTheme.spacing.xxs,
  },
  rowValue: {
    color: ContaTheme.colors.primaryStrong,
    fontSize: ContaTheme.typography.body,
    fontWeight: "700",
    marginTop: ContaTheme.spacing.xs,
  },
  sectionTitle: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    fontWeight: "700",
    marginBottom: ContaTheme.spacing.sm,
  },
  shortcutCell: {
    width: "48%",
  },
  shortcutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: ContaTheme.spacing.sm,
  },
  userIcon: {
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  userIconButton: {
    borderColor: ContaTheme.colors.border,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
});
