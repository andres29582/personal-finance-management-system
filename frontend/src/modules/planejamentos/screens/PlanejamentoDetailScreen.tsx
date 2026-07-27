import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { resolveApiError } from '../../../../utils/api-error';
import { confirmAction } from '../../../../utils/confirm-action';
import { AcertoAction } from '../components/detail/AcertoRow';
import { PlanejamentoExpensesSection } from '../components/detail/PlanejamentoExpensesSection';
import { PlanejamentoFinancialSummarySection } from '../components/detail/PlanejamentoFinancialSummarySection';
import {
  PlanejamentoLifecycleSection,
  PlanejamentoTransition,
} from '../components/detail/PlanejamentoLifecycleSection';
import { PlanejamentoOverviewSection } from '../components/detail/PlanejamentoOverviewSection';
import { PlanejamentoParticipantsSection } from '../components/detail/PlanejamentoParticipantsSection';
import { PlanejamentoSettlementsSection } from '../components/detail/PlanejamentoSettlementsSection';
import {
  arquivarPlanejamento,
  cancelAcertoPlanejamento,
  cancelGastoPlanejamento,
  cancelarPlanejamento,
  fecharPlanejamento,
  payAcertoPlanejamento,
  removeParticipantePlanejamento,
  reopenAcertoPlanejamento,
  syncAcertosPlanejamento,
} from '../services/planejamentoService';
import { usePlanejamentoDetailData } from '../hooks/usePlanejamentoDetailData';
import {
  AcertoPlanejamento,
  GastoPlanejamento,
  ParticipantePlanejamento,
  Planejamento,
} from '../types/planejamento';

const transitionConfig: Record<
  PlanejamentoTransition,
  {
    confirmationMessage: string;
    confirmationTitle: string;
    errorMessage: string;
    loadingLabel: string;
    request: (planejamentoId: string) => Promise<Planejamento>;
    successMessage: string;
  }
> = {
  archive: {
    confirmationMessage:
      'Deseja arquivar este planejamento quitado? Ele ficara somente leitura.',
    confirmationTitle: 'Arquivar planejamento',
    errorMessage: 'Nao foi possivel arquivar o planejamento.',
    loadingLabel: 'Arquivando...',
    request: arquivarPlanejamento,
    successMessage: 'Planejamento arquivado com sucesso.',
  },
  cancel: {
    confirmationMessage:
      'Deseja cancelar este planejamento quitado? Ele ficara somente leitura.',
    confirmationTitle: 'Cancelar planejamento',
    errorMessage: 'Nao foi possivel cancelar o planejamento.',
    loadingLabel: 'Cancelando...',
    request: cancelarPlanejamento,
    successMessage: 'Planejamento cancelado com sucesso.',
  },
  close: {
    confirmationMessage:
      'Deseja fechar este planejamento? Participantes e gastos ficarao bloqueados para alteracoes.',
    confirmationTitle: 'Fechar planejamento',
    errorMessage: 'Nao foi possivel fechar o planejamento.',
    loadingLabel: 'Fechando...',
    request: fecharPlanejamento,
    successMessage: 'Planejamento fechado com sucesso.',
  },
};

function getParticipantes(planejamento: Planejamento | null) {
  return planejamento?.participantes ?? [];
}

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
  const [acertosError, setAcertosError] = useState('');
  const [acertosInfo, setAcertosInfo] = useState('');
  const [acertosActionLoading, setAcertosActionLoading] = useState<
    string | null
  >(null);
  const [gastosError, setGastosError] = useState('');
  const [gastosInfo, setGastosInfo] = useState('');
  const [gastoActionLoading, setGastoActionLoading] = useState<string | null>(
    null,
  );
  const [participanteActionLoading, setParticipanteActionLoading] = useState<
    string | null
  >(null);
  const [participantesError, setParticipantesError] = useState('');
  const [participantesInfo, setParticipantesInfo] = useState('');
  const [transitionError, setTransitionError] = useState('');
  const [transitionInfo, setTransitionInfo] = useState('');
  const [transitionLoading, setTransitionLoading] =
    useState<PlanejamentoTransition | null>(null);
  const aggregateMutationLockRef = useRef<string | null>(null);
  const transitionLockRef = useRef<PlanejamentoTransition | null>(null);

  useEffect(() => {
    setAcertosActionLoading(null);
    setAcertosError('');
    setAcertosInfo('');
    setGastoActionLoading(null);
    setGastosError('');
    setGastosInfo('');
  }, [planejamentoId]);

  const participantes = getParticipantes(planejamento);
  const settlementMutationsAllowed =
    planejamento?.status === 'ABERTO' || planejamento?.status === 'FECHADO';
  const structuralMutationsAllowed = planejamento?.status === 'ABERTO';
  const isFinanciallySettled = resumo?.situacaoFinanceira === 'QUITADO';
  const isReadOnly =
    planejamento?.status === 'ARQUIVADO' ||
    planejamento?.status === 'CANCELADO';
  const isAuthenticatedUserOwner =
    !!planejamento &&
    usuarioAutenticadoId === planejamento.usuarioCriadorId;
  const aggregateMutationInProgress =
    !!acertosActionLoading ||
    !!gastoActionLoading ||
    !!participanteActionLoading ||
    !!transitionLoading;

  async function handleSyncAcertos() {
    if (!planejamentoId || aggregateMutationLockRef.current) {
      return;
    }

    const currentPlanejamentoId = planejamentoId;
    const lockKey = 'acerto:sync';
    aggregateMutationLockRef.current = lockKey;

    try {
      setAcertosActionLoading('sync');
      setAcertosError('');
      setAcertosInfo('');

      const acertosSincronizados =
        await syncAcertosPlanejamento(currentPlanejamentoId);

      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      const dataApplied = await refreshFinancialData(
        currentPlanejamentoId,
      );

      if (isCurrentContext(currentPlanejamentoId) && dataApplied) {
        setAcertosInfo(
          acertosSincronizados.length
            ? 'Acertos sincronizados com sucesso.'
            : 'Ainda nao ha dados suficientes para gerar acertos. Cadastre gastos e participantes ativos e tente novamente.',
        );
      }
    } catch (error) {
      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel sincronizar os acertos.',
      );

      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      setAcertosError(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (isCurrentContext(currentPlanejamentoId)) {
        setAcertosActionLoading(null);
      }
      if (aggregateMutationLockRef.current === lockKey) {
        aggregateMutationLockRef.current = null;
      }
    }
  }

  async function handleAcertoAction(
    acerto: AcertoPlanejamento,
    action: AcertoAction,
  ) {
    if (!planejamentoId || aggregateMutationLockRef.current) {
      return;
    }

    const currentPlanejamentoId = planejamentoId;
    const actionKey = `${action}:${acerto.id}`;
    const lockKey = `acerto:${actionKey}`;
    aggregateMutationLockRef.current = lockKey;

    try {
      setAcertosActionLoading(actionKey);
      setAcertosError('');
      setAcertosInfo('');

      const actionByType = {
        cancel: cancelAcertoPlanejamento,
        pay: payAcertoPlanejamento,
        reopen: reopenAcertoPlanejamento,
      };
      await actionByType[action](currentPlanejamentoId, acerto.id);

      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      const dataApplied = await refreshFinancialData(
        currentPlanejamentoId,
      );

      if (isCurrentContext(currentPlanejamentoId) && dataApplied) {
        setAcertosInfo('Acerto atualizado com sucesso.');
      }
    } catch (error) {
      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel atualizar o acerto.',
      );

      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      setAcertosError(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (isCurrentContext(currentPlanejamentoId)) {
        setAcertosActionLoading(null);
      }
      if (aggregateMutationLockRef.current === lockKey) {
        aggregateMutationLockRef.current = null;
      }
    }
  }

  async function handleCancelGasto(gasto: GastoPlanejamento) {
    if (
      !planejamentoId ||
      planejamento?.status !== 'ABERTO' ||
      gasto.status !== 'ATIVO' ||
      aggregateMutationLockRef.current
    ) {
      return;
    }

    const currentPlanejamentoId = planejamentoId;
    const lockKey = `gasto:cancel:${gasto.id}`;
    aggregateMutationLockRef.current = lockKey;
    let cancelamentoConcluido = false;

    try {
      setGastoActionLoading(gasto.id);
      setGastosError('');
      setGastosInfo('');

      const confirmed = await confirmAction(
        'Cancelar gasto',
        `Deseja cancelar o gasto "${gasto.descricao}"? Ele permanecera visivel no historico.`,
      );

      if (!confirmed) {
        return;
      }

      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      await cancelGastoPlanejamento(currentPlanejamentoId, gasto.id);
      cancelamentoConcluido = true;

      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      const dataApplied = await refreshExpenseFinancialData(
        currentPlanejamentoId,
      );

      if (isCurrentContext(currentPlanejamentoId) && dataApplied) {
        setGastosInfo('Gasto cancelado com sucesso.');
      }
    } catch (error) {
      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      const resolvedError = await resolveApiError(
        error,
        cancelamentoConcluido
          ? 'O gasto foi cancelado, mas nao foi possivel recarregar os dados financeiros.'
          : 'Nao foi possivel cancelar o gasto.',
      );

      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      setGastosError(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (isCurrentContext(currentPlanejamentoId)) {
        setGastoActionLoading(null);
      }
      if (aggregateMutationLockRef.current === lockKey) {
        aggregateMutationLockRef.current = null;
      }
    }
  }

  async function handleRemoveParticipante(
    participante: ParticipantePlanejamento,
  ) {
    if (
      !planejamentoId ||
      !planejamento ||
      usuarioAutenticadoId !== planejamento.usuarioCriadorId ||
      planejamento.status !== 'ABERTO' ||
      participante.status !== 'ATIVO' ||
      participante.usuarioId === planejamento.usuarioCriadorId ||
      aggregateMutationLockRef.current
    ) {
      return;
    }

    const currentPlanejamentoId = planejamentoId;
    const lockKey = `participante:remove:${participante.id}`;
    aggregateMutationLockRef.current = lockKey;
    let remocaoConcluida = false;

    try {
      setParticipanteActionLoading(participante.id);
      setParticipantesError('');
      setParticipantesInfo('');

      const confirmed = await confirmAction(
        'Remover participante',
        `Deseja remover "${participante.nome}" deste planejamento? O participante não poderá ser utilizado em novos gastos ou divisões, mas continuará visível no histórico financeiro.`,
      );

      if (!confirmed) {
        return;
      }

      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      const participanteRemovido = await removeParticipantePlanejamento(
        currentPlanejamentoId,
        participante.id,
      );
      remocaoConcluida = true;

      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      applyParticipantUpdate(participanteRemovido);
      const dataApplied = await reloadAllData(currentPlanejamentoId);

      if (isCurrentContext(currentPlanejamentoId) && dataApplied) {
        setParticipantesInfo('Participante removido com sucesso.');
      }
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        remocaoConcluida
          ? 'O participante foi removido, mas não foi possível recarregar os dados do planejamento.'
          : 'Não foi possível remover o participante.',
      );

      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      setParticipantesError(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setParticipanteActionLoading(null);
      if (aggregateMutationLockRef.current === lockKey) {
        aggregateMutationLockRef.current = null;
      }
    }
  }

  async function handleTransition(transition: PlanejamentoTransition) {
    if (
      !planejamentoId ||
      acertosActionLoading ||
      gastoActionLoading ||
      aggregateMutationLockRef.current ||
      transitionLockRef.current
    ) {
      return;
    }

    const currentPlanejamentoId = planejamentoId;
    transitionLockRef.current = transition;
    const lockKey = `transition:${transition}`;
    aggregateMutationLockRef.current = lockKey;
    const config = transitionConfig[transition];
    let transitionCompleted = false;

    try {
      setTransitionLoading(transition);
      setTransitionError('');
      setTransitionInfo('');

      const confirmed = await confirmAction(
        config.confirmationTitle,
        config.confirmationMessage,
      );

      if (!confirmed) {
        return;
      }

      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      await config.request(currentPlanejamentoId);
      transitionCompleted = true;

      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      const dataApplied = await reloadAllData(currentPlanejamentoId);

      if (isCurrentContext(currentPlanejamentoId) && dataApplied) {
        setTransitionInfo(config.successMessage);
      }
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        transitionCompleted
          ? 'O status foi atualizado, mas nao foi possivel recarregar o planejamento.'
          : config.errorMessage,
      );

      if (!isCurrentContext(currentPlanejamentoId)) {
        return;
      }

      setTransitionError(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setTransitionLoading(null);
      transitionLockRef.current = null;
      if (aggregateMutationLockRef.current === lockKey) {
        aggregateMutationLockRef.current = null;
      }
    }
  }

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
            errorMessage={transitionError}
            infoMessage={transitionInfo}
            isFinanciallySettled={isFinanciallySettled}
            loadingLabel={
              transitionLoading
                ? transitionConfig[transitionLoading].loadingLabel
                : ''
            }
            mutationInProgress={aggregateMutationInProgress}
            onTransition={handleTransition}
            status={planejamento.status}
            transitionLoading={transitionLoading}
          />

          <PlanejamentoParticipantsSection
            actionLoadingId={participanteActionLoading}
            canAdd={structuralMutationsAllowed}
            canManageParticipants={
              isAuthenticatedUserOwner && structuralMutationsAllowed
            }
            errorMessage={
              participantesError || participantPermissionError
            }
            infoMessage={participantesInfo}
            mutationInProgress={aggregateMutationInProgress}
            onAdd={() => {
              if (aggregateMutationLockRef.current) {
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
            canAdd={structuralMutationsAllowed}
            canManageExpenses={structuralMutationsAllowed}
            errorMessage={gastosError}
            gastos={gastos}
            infoMessage={gastosInfo}
            mutationInProgress={aggregateMutationInProgress}
            onAdd={() => {
              if (aggregateMutationLockRef.current) {
                return;
              }

              router.push({
                pathname: '/planejamentos-gasto-form',
                params: { id: planejamento.id },
              } as never);
            }}
            onCancel={handleCancelGasto}
            onEdit={(gastoSelecionado) =>
              router.push({
                pathname: '/planejamentos-gasto-form',
                params: {
                  gastoId: gastoSelecionado.id,
                  id: planejamento.id,
                },
              } as never)
            }
            participantes={participantes}
          />

          <PlanejamentoSettlementsSection
            acertos={acertos}
            actionLoadingId={acertosActionLoading}
            canOperate={settlementMutationsAllowed}
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
