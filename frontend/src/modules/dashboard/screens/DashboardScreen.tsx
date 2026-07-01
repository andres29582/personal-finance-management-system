import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { formatCurrency } from "../../../../utils/formatters";
import { FinanceTheme } from "../../../shared/styles/financeTheme";
import { GlassStatusCard } from "../../../shared/ui";
import { AccountsOverviewCard } from "../components/AccountsOverviewCard";
import { CategoryBarsCard } from "../components/CategoryBarsCard";
import { DashboardHeader } from "../components/DashboardHeader";
import { DashboardShell } from "../components/DashboardShell";
import { FinancialSummaryGrid } from "../components/FinancialSummaryGrid";
import { MonthlyComparisonCard } from "../components/MonthlyComparisonCard";
import { PlanningOverviewGrid } from "../components/PlanningOverviewGrid";
import { RecentTransactionsCard } from "../components/RecentTransactionsCard";
import { useDashboardData } from "../hooks/useDashboardData";
import { InsightCard } from "../v2/components";
import {
  dashboardSidebarItems,
  mapBudgetOverview,
  mapCategoryBars,
  mapDashboardMetrics,
  mapGoalOverview,
  mapMonthlyComparison,
} from "../utils/dashboardMappers";

export function DashboardScreen() {
  const router = useRouter();
  const {
    dashboard,
    handleLogout,
    loading,
    metaDestaque,
    message,
    orcamentoMes,
    reloadDashboard,
    usuario,
  } = useDashboardData();
  const metrics = dashboard ? mapDashboardMetrics(dashboard) : [];
  const monthlyComparison = dashboard
    ? mapMonthlyComparison(dashboard.comparativoMensal)
    : null;
  const categoryBars = dashboard
    ? mapCategoryBars(dashboard.gastosPorCategoria)
    : [];
  const budgetOverview = mapBudgetOverview(orcamentoMes);
  const goalOverview = mapGoalOverview(metaDestaque);

  return (
    <DashboardShell
      activeRoute="/dashboard"
      header={
        <DashboardHeader
          email={usuario?.email}
          monthReference={dashboard?.mesReferencia}
          onLogout={handleLogout}
          onProfilePress={() => router.push("/usuario")}
          userName={usuario?.nome}
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={dashboardSidebarItems}
    >
      {message && dashboard ? (
        <Text style={styles.errorMessage}>{message}</Text>
      ) : null}

      {loading && !dashboard ? (
        <GlassStatusCard
          title="Carregando dashboard"
          description="Estamos reunindo seu resumo financeiro mais recente."
          loading
        />
      ) : null}

      {!loading && !!message && !dashboard ? (
        <GlassStatusCard
          title="Nao foi possivel carregar o dashboard"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={reloadDashboard}
        />
      ) : null}

      {!loading && !message && !dashboard ? (
        <GlassStatusCard
          title="Dashboard indisponivel"
          description="Nao encontramos dados para montar o painel neste momento."
          actionLabel="Atualizar"
          onActionPress={reloadDashboard}
        />
      ) : null}

      {dashboard ? (
        <>
          <FinancialSummaryGrid metrics={metrics} />

          <View style={styles.insightGrid}>
            <InsightCard
              description={
                dashboard.economiaMes >= 0
                  ? "Suas receitas cobrem as despesas registradas neste mes."
                  : "As despesas registradas passaram das receitas do mes."
              }
              icon={
                dashboard.economiaMes >= 0
                  ? "shield-check-outline"
                  : "alert-circle-outline"
              }
              title={
                dashboard.economiaMes >= 0
                  ? "Mes com saldo positivo"
                  : "Atencao ao saldo do mes"
              }
              tone={dashboard.economiaMes >= 0 ? "success" : "warning"}
              value={formatCurrency(dashboard.economiaMes)}
            />
          </View>

          <AccountsOverviewCard
            totalContas={dashboard.totalContas}
            onCreateAccount={() => router.push("/contas-create" as never)}
          />

          <CategoryBarsCard
            items={categoryBars}
            onOpenHistory={() => router.push("/relatorios" as never)}
          />

          <RecentTransactionsCard
            items={dashboard.transacoesRecentes}
            onOpenHistory={() => router.push("/transacoes" as never)}
          />

          {monthlyComparison ? (
            <MonthlyComparisonCard comparison={monthlyComparison} />
          ) : null}

          <PlanningOverviewGrid
            budget={budgetOverview}
            goal={goalOverview}
            onOpenBudgets={() => router.push("/orcamentos" as never)}
            onOpenGoals={() => router.push("/metas" as never)}
          />
        </>
      ) : null}
    </DashboardShell>
  );
}

export default DashboardScreen;

const styles = StyleSheet.create({
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: "700",
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: "center",
  },
  insightGrid: {
    marginTop: FinanceTheme.spacing.md,
  },
});
