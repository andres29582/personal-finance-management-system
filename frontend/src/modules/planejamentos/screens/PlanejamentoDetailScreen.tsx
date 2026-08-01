import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassPanel,
  GlassStatusCard,
} from '../../../shared/ui';
import { PlanejamentoExpensesSection } from '../components/detail/PlanejamentoExpensesSection';
import { PlanejamentoFinancialSummarySection } from '../components/detail/PlanejamentoFinancialSummarySection';
import { PlanejamentoLifecycleSection } from '../components/detail/PlanejamentoLifecycleSection';
import { PlanejamentoOverviewSection } from '../components/detail/PlanejamentoOverviewSection';
import { PlanejamentoParticipantsSection } from '../components/detail/PlanejamentoParticipantsSection';
import { PlanejamentoSettlementsSection } from '../components/detail/PlanejamentoSettlementsSection';
import { usePlanejamentoDetailData } from '../hooks/usePlanejamentoDetailData';
import { usePlanejamentoDetailMutations } from '../hooks/usePlanejamentoDetailMutations';

export function PlanejamentoDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const planejamentoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const handleUnauthorized = useCallback(() => {
    router.replace('/login');
  }, [router]);
  const {
    acertos,
    applyParticipantUpdate,
    gastos,
    isCurrentContext,
    loading,
    message,
    participantPermissionError,
    planejamento,
    refreshExpenseFinancialData,
    refreshFinancialData,
    reloadAllData,
    resumo,
    usuarioAutenticadoId,
  } = usePlanejamentoDetailData({
    onUnauthorized: handleUnauthorized,
    planejamentoId,
  });
  const {
    acertosActionLoading,
    acertosError,
    acertosInfo,
    aggregateMutationInProgress,
    canAddParticipant,
    canCancelExpense,
    canCreateExpense,
    canEditExpense,
    canManageLifecycle,
    canNavigateToAddParticipant,
    canNavigateToCreateExpense,
    canNavigateToEditExpense,
    canPerformSettlementAction,
    canRemoveParticipant,
    canSyncSettlements,
    gastoActionLoading,
    gastosError,
    gastosInfo,
    handleAcertoAction,
    handleCancelGasto,
    handleRemoveParticipante,
    handleSyncAcertos,
    handleTransition,
    isFinanciallySettled,
    isReadOnly,
    participanteActionLoading,
    participantesError,
    participantesInfo,
    transitionError,
    transitionInfo,
    transitionLoading,
    transitionLoadingLabel,
  } = usePlanejamentoDetailMutations({
    applyParticipantUpdate,
    isCurrentContext,
    onUnauthorized: handleUnauthorized,
    planejamento,
    planejamentoId,
    refreshExpenseFinancialData,
    refreshFinancialData,
    reloadAllData,
    resumo,
    usuarioAutenticadoId,
  });
  const participantes = planejamento?.participantes ?? [];

  return (
    <FinanceAppShell
      activeRoute="/planejamentos"
      header={
        <FinanceAppHeader
          action={
            <GlassButton
              label="Voltar"
              onPress={() => router.push('/planejamentos' as never)}
              variant="ghost"
            />
          }
          eyebrow="Planejamento compartilhado"
          subtitle="Detalhe inicial do planejamento."
          title={planejamento?.nome ?? 'Detalhe'}
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      {loading ? (
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>Carregando planejamento...</Text>
          </View>
        </GlassPanel>
      ) : null}

      {!loading && message ? (
        <GlassStatusCard
          title="Nao foi possivel carregar o planejamento"
          description={message}
          tone="error"
          actionLabel="Voltar para lista"
          onActionPress={() => router.push('/planejamentos' as never)}
        />
      ) : null}

      {!loading && planejamento ? (
        <>
          <PlanejamentoOverviewSection planejamento={planejamento} />

          {resumo ? (
            <PlanejamentoFinancialSummarySection resumo={resumo} />
          ) : null}

          <PlanejamentoLifecycleSection
            canManageLifecycle={canManageLifecycle}
            errorMessage={transitionError}
            infoMessage={transitionInfo}
            isFinanciallySettled={isFinanciallySettled}
            loadingLabel={transitionLoadingLabel}
            mutationInProgress={aggregateMutationInProgress}
            onTransition={handleTransition}
            status={planejamento.status}
            transitionLoading={transitionLoading}
          />

          <PlanejamentoParticipantsSection
            actionLoadingId={participanteActionLoading}
            canAddParticipant={canAddParticipant}
            canRemoveParticipant={canRemoveParticipant}
            errorMessage={
              participantesError || participantPermissionError
            }
            infoMessage={participantesInfo}
            mutationInProgress={aggregateMutationInProgress}
            onAdd={() => {
              if (!canNavigateToAddParticipant()) {
                return;
              }

              router.push({
                pathname: '/planejamentos-participante-form',
                params: { id: planejamento.id },
              } as never);
            }}
            onRemove={handleRemoveParticipante}
            participantes={participantes}
            usuarioCriadorId={planejamento.usuarioCriadorId}
          />

          <PlanejamentoExpensesSection
            actionLoadingId={gastoActionLoading}
            canCancelExpense={canCancelExpense}
            canCreateExpense={canCreateExpense}
            canEditExpense={canEditExpense}
            errorMessage={gastosError}
            gastos={gastos}
            infoMessage={gastosInfo}
            mutationInProgress={aggregateMutationInProgress}
            onAdd={() => {
              if (!canNavigateToCreateExpense()) {
                return;
              }

              router.push({
                pathname: '/planejamentos-gasto-form',
                params: { id: planejamento.id },
              } as never);
            }}
            onCancel={handleCancelGasto}
            onEdit={(gastoSelecionado) => {
              if (!canNavigateToEditExpense(gastoSelecionado)) {
                return;
              }

              router.push({
                pathname: '/planejamentos-gasto-form',
                params: {
                  gastoId: gastoSelecionado.id,
                  id: planejamento.id,
                },
              } as never);
            }}
            participantes={participantes}
          />

          <PlanejamentoSettlementsSection
            acertos={acertos}
            actionLoadingId={acertosActionLoading}
            canPerformSettlementAction={canPerformSettlementAction}
            canSyncSettlements={canSyncSettlements}
            errorMessage={acertosError}
            infoMessage={acertosInfo}
            isReadOnly={isReadOnly}
            mutationInProgress={aggregateMutationInProgress}
            onAction={handleAcertoAction}
            onSync={handleSyncAcertos}
            participantes={participantes}
          />
        </>
      ) : null}
    </FinanceAppShell>
  );
}

export default PlanejamentoDetailScreen;

const styles = StyleSheet.create({
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
  },
  loadingText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
  },
});
