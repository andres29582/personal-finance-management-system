import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getUser } from '../../../../storage/authStorage';
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
import {
  AcertoAction,
  AcertoRow,
} from '../components/detail/AcertoRow';
import { GastoRow } from '../components/detail/GastoRow';
import { ParticipanteRow } from '../components/detail/ParticipanteRow';
import { PlanejamentoFinancialSummarySection } from '../components/detail/PlanejamentoFinancialSummarySection';
import { PlanejamentoOverviewSection } from '../components/detail/PlanejamentoOverviewSection';
import {
  arquivarPlanejamento,
  cancelAcertoPlanejamento,
  cancelGastoPlanejamento,
  cancelarPlanejamento,
  fecharPlanejamento,
  getPlanejamentoById,
  getResumoPlanejamento,
  listAcertosPlanejamento,
  listGastosPlanejamento,
  payAcertoPlanejamento,
  removeParticipantePlanejamento,
  reopenAcertoPlanejamento,
  syncAcertosPlanejamento,
} from '../services/planejamentoService';
import {
  AcertoPlanejamento,
  GastoPlanejamento,
  ParticipantePlanejamento,
  Planejamento,
  ResumoFinanceiroPlanejamento,
} from '../types/planejamento';

type PlanejamentoTransition = 'archive' | 'cancel' | 'close';

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
  const [planejamento, setPlanejamento] = useState<Planejamento | null>(null);
  const [resumo, setResumo] = useState<ResumoFinanceiroPlanejamento | null>(
    null,
  );
  const [gastos, setGastos] = useState<GastoPlanejamento[]>([]);
  const [acertos, setAcertos] = useState<AcertoPlanejamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
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
  const [usuarioAutenticadoId, setUsuarioAutenticadoId] = useState<
    string | null
  >(null);
  const aggregateMutationLockRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const planejamentoIdRef = useRef(planejamentoId);
  const transitionLockRef = useRef<PlanejamentoTransition | null>(null);
  planejamentoIdRef.current = planejamentoId;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      loadGenerationRef.current += 1;
    };
  }, []);

  const loadPlanejamentoData = useCallback(async (): Promise<boolean> => {
    if (
      !planejamentoId ||
      planejamentoIdRef.current !== planejamentoId
    ) {
      return false;
    }

    const loadGeneration = ++loadGenerationRef.current;
    const [data, resumoData, gastosData, acertosData] = await Promise.all([
      getPlanejamentoById(planejamentoId),
      getResumoPlanejamento(planejamentoId),
      listGastosPlanejamento(planejamentoId),
      listAcertosPlanejamento(planejamentoId),
    ]);

    if (
      !mountedRef.current ||
      planejamentoIdRef.current !== planejamentoId ||
      loadGeneration !== loadGenerationRef.current
    ) {
      return false;
    }

    setPlanejamento(data);
    setResumo(resumoData);
    setGastos(gastosData);
    setAcertos(acertosData);
    return true;
  }, [planejamentoId]);

  useEffect(() => {
    let active = true;

    async function loadPlanejamento() {
      if (!planejamentoId) {
        if (active && mountedRef.current) {
          setMessage('Planejamento nao informado.');
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setMessage('');
        await loadPlanejamentoData();
      } catch (error) {
        if (!active || !mountedRef.current) {
          return;
        }

        const resolvedError = await resolveApiError(
          error,
          'Nao foi possivel carregar o planejamento.',
        );

        if (!active || !mountedRef.current) {
          return;
        }

        setMessage(resolvedError.message);

        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      } finally {
        if (active && mountedRef.current) {
          setLoading(false);
        }
      }
    }

    async function loadUsuarioAutenticado() {
      if (active && mountedRef.current) {
        setUsuarioAutenticadoId(null);
      }

      try {
        const usuarioAutenticado = await getUser();

        if (active && mountedRef.current) {
          setUsuarioAutenticadoId(usuarioAutenticado?.id ?? null);
          setParticipantesError('');
        }
      } catch {
        if (active && mountedRef.current) {
          setUsuarioAutenticadoId(null);
          setParticipantesError(
            'Não foi possível verificar sua permissão para gerenciar participantes.',
          );
        }
      }
    }

    void loadPlanejamento();
    void loadUsuarioAutenticado();

    return () => {
      active = false;
    };
  }, [loadPlanejamentoData, planejamentoId, router]);

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

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

  function isCurrentScreenContext(expectedPlanejamentoId: string) {
    return (
      mountedRef.current &&
      planejamentoIdRef.current === expectedPlanejamentoId
    );
  }

  async function refreshFinancialData(
    expectedPlanejamentoId: string,
  ): Promise<boolean> {
    const refreshGeneration = ++loadGenerationRef.current;

    try {
      const [resumoData, acertosData] = await Promise.all([
        getResumoPlanejamento(expectedPlanejamentoId),
        listAcertosPlanejamento(expectedPlanejamentoId),
      ]);

      if (
        !isCurrentScreenContext(expectedPlanejamentoId) ||
        refreshGeneration !== loadGenerationRef.current
      ) {
        return false;
      }

      setResumo(resumoData);
      setAcertos(acertosData);
      return true;
    } catch (error) {
      if (
        !isCurrentScreenContext(expectedPlanejamentoId) ||
        refreshGeneration !== loadGenerationRef.current
      ) {
        return false;
      }

      throw error;
    }
  }

  async function refreshGastoFinancialData(
    expectedPlanejamentoId: string,
  ): Promise<boolean> {
    const refreshGeneration = ++loadGenerationRef.current;

    try {
      const [resumoData, gastosData, acertosData] = await Promise.all([
        getResumoPlanejamento(expectedPlanejamentoId),
        listGastosPlanejamento(expectedPlanejamentoId),
        listAcertosPlanejamento(expectedPlanejamentoId),
      ]);

      if (
        !isCurrentScreenContext(expectedPlanejamentoId) ||
        refreshGeneration !== loadGenerationRef.current
      ) {
        return false;
      }

      setResumo(resumoData);
      setGastos(gastosData);
      setAcertos(acertosData);
      return true;
    } catch (error) {
      if (
        !isCurrentScreenContext(expectedPlanejamentoId) ||
        refreshGeneration !== loadGenerationRef.current
      ) {
        return false;
      }

      throw error;
    }
  }

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

      if (!isCurrentScreenContext(currentPlanejamentoId)) {
        return;
      }

      const dataApplied = await refreshFinancialData(
        currentPlanejamentoId,
      );

      if (isCurrentScreenContext(currentPlanejamentoId) && dataApplied) {
        setAcertosInfo(
          acertosSincronizados.length
            ? 'Acertos sincronizados com sucesso.'
            : 'Ainda nao ha dados suficientes para gerar acertos. Cadastre gastos e participantes ativos e tente novamente.',
        );
      }
    } catch (error) {
      if (!isCurrentScreenContext(currentPlanejamentoId)) {
        return;
      }

      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel sincronizar os acertos.',
      );

      if (!isCurrentScreenContext(currentPlanejamentoId)) {
        return;
      }

      setAcertosError(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (isCurrentScreenContext(currentPlanejamentoId)) {
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

      if (!isCurrentScreenContext(currentPlanejamentoId)) {
        return;
      }

      const dataApplied = await refreshFinancialData(
        currentPlanejamentoId,
      );

      if (isCurrentScreenContext(currentPlanejamentoId) && dataApplied) {
        setAcertosInfo('Acerto atualizado com sucesso.');
      }
    } catch (error) {
      if (!isCurrentScreenContext(currentPlanejamentoId)) {
        return;
      }

      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel atualizar o acerto.',
      );

      if (!isCurrentScreenContext(currentPlanejamentoId)) {
        return;
      }

      setAcertosError(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (isCurrentScreenContext(currentPlanejamentoId)) {
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

      if (!isCurrentScreenContext(currentPlanejamentoId)) {
        return;
      }

      await cancelGastoPlanejamento(currentPlanejamentoId, gasto.id);
      cancelamentoConcluido = true;

      if (!isCurrentScreenContext(currentPlanejamentoId)) {
        return;
      }

      const dataApplied = await refreshGastoFinancialData(
        currentPlanejamentoId,
      );

      if (isCurrentScreenContext(currentPlanejamentoId) && dataApplied) {
        setGastosInfo('Gasto cancelado com sucesso.');
      }
    } catch (error) {
      if (!isCurrentScreenContext(currentPlanejamentoId)) {
        return;
      }

      const resolvedError = await resolveApiError(
        error,
        cancelamentoConcluido
          ? 'O gasto foi cancelado, mas nao foi possivel recarregar os dados financeiros.'
          : 'Nao foi possivel cancelar o gasto.',
      );

      if (!isCurrentScreenContext(currentPlanejamentoId)) {
        return;
      }

      setGastosError(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (isCurrentScreenContext(currentPlanejamentoId)) {
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

      if (
        !mountedRef.current ||
        planejamentoIdRef.current !== planejamentoId
      ) {
        return;
      }

      const participanteRemovido = await removeParticipantePlanejamento(
        planejamentoId,
        participante.id,
      );
      remocaoConcluida = true;

      if (
        !mountedRef.current ||
        planejamentoIdRef.current !== planejamentoId
      ) {
        return;
      }

      setPlanejamento((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          participantes: current.participantes?.map((item) =>
            item.id === participanteRemovido.id
              ? participanteRemovido
              : item,
          ),
        };
      });

      const dataApplied = await loadPlanejamentoData();

      if (mountedRef.current && dataApplied) {
        setParticipantesInfo('Participante removido com sucesso.');
      }
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        remocaoConcluida
          ? 'O participante foi removido, mas não foi possível recarregar os dados do planejamento.'
          : 'Não foi possível remover o participante.',
      );

      if (
        !mountedRef.current ||
        planejamentoIdRef.current !== planejamentoId
      ) {
        return;
      }

      setParticipantesError(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (mountedRef.current) {
        setParticipanteActionLoading(null);
      }
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

      if (
        !mountedRef.current ||
        planejamentoIdRef.current !== planejamentoId
      ) {
        return;
      }

      await config.request(planejamentoId);
      transitionCompleted = true;

      if (
        !mountedRef.current ||
        planejamentoIdRef.current !== planejamentoId
      ) {
        return;
      }

      const dataApplied = await loadPlanejamentoData();

      if (mountedRef.current && dataApplied) {
        setTransitionInfo(config.successMessage);
      }
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        transitionCompleted
          ? 'O status foi atualizado, mas nao foi possivel recarregar o planejamento.'
          : config.errorMessage,
      );

      if (
        !mountedRef.current ||
        planejamentoIdRef.current !== planejamentoId
      ) {
        return;
      }

      setTransitionError(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (mountedRef.current) {
        setTransitionLoading(null);
      }
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

          <GlassPanel
            title="Ciclo de vida"
            subtitle="Acoes disponiveis para o estado atual do planejamento."
          >
            {transitionError ? (
              <Text style={styles.actionError}>{transitionError}</Text>
            ) : null}
            {transitionInfo ? (
              <Text style={styles.actionInfo}>{transitionInfo}</Text>
            ) : null}

            {planejamento.status === 'ABERTO' ? (
              <>
                <View style={styles.lifecycleActions}>
                  <GlassButton
                    disabled={aggregateMutationInProgress}
                    label={
                      transitionLoading === 'close'
                        ? transitionConfig.close.loadingLabel
                        : 'Fechar planejamento'
                    }
                    onPress={() => void handleTransition('close')}
                    variant="primary"
                  />
                  <GlassButton
                    disabled={
                      aggregateMutationInProgress ||
                      !isFinanciallySettled
                    }
                    label={
                      transitionLoading === 'cancel'
                        ? transitionConfig.cancel.loadingLabel
                        : 'Cancelar planejamento'
                    }
                    onPress={() => void handleTransition('cancel')}
                    variant="danger"
                  />
                </View>
                {!isFinanciallySettled ? (
                  <Text style={styles.lifecycleHint}>
                    O cancelamento fica disponivel quando a situacao financeira
                    estiver quitada.
                  </Text>
                ) : null}
              </>
            ) : null}

            {planejamento.status === 'FECHADO' ? (
              <>
                <View style={styles.lifecycleActions}>
                  <GlassButton
                    disabled={
                      aggregateMutationInProgress ||
                      !isFinanciallySettled
                    }
                    label={
                      transitionLoading === 'archive'
                        ? transitionConfig.archive.loadingLabel
                        : 'Arquivar planejamento'
                    }
                    onPress={() => void handleTransition('archive')}
                    variant="primary"
                  />
                </View>
                {!isFinanciallySettled ? (
                  <Text style={styles.lifecycleHint}>
                    Quite a obrigacao residual para arquivar o planejamento.
                  </Text>
                ) : null}
              </>
            ) : null}

            {isReadOnly ? (
              <Text style={styles.readOnlyText}>
                Este planejamento esta em modo somente leitura.
              </Text>
            ) : null}
          </GlassPanel>

          <GlassPanel
            title="Participantes"
            subtitle="Pessoas vinculadas a este planejamento."
            action={
              structuralMutationsAllowed ? (
                <GlassButton
                  disabled={aggregateMutationInProgress}
                  label="Adicionar participante"
                  onPress={() => {
                    if (aggregateMutationLockRef.current) {
                      return;
                    }

                    router.push({
                      pathname: '/planejamentos-participante-form',
                      params: { id: planejamento.id },
                    } as never);
                  }}
                  variant="ghost"
                />
              ) : undefined
            }
          >
            {participantesError ? (
              <Text style={styles.actionError}>{participantesError}</Text>
            ) : null}
            {participantesInfo ? (
              <Text style={styles.actionInfo}>{participantesInfo}</Text>
            ) : null}

            {participantes.length ? (
              participantes.map((participante) => {
                const isOwnerParticipant =
                  participante.usuarioId === planejamento.usuarioCriadorId;

                return (
                  <ParticipanteRow
                    key={participante.id}
                    actionLoading={
                      participanteActionLoading === participante.id
                    }
                    canRemove={
                      isAuthenticatedUserOwner &&
                      structuralMutationsAllowed &&
                      participante.status === 'ATIVO' &&
                      !isOwnerParticipant
                    }
                    disabled={aggregateMutationInProgress}
                    isOwnerParticipant={isOwnerParticipant}
                    onRemove={handleRemoveParticipante}
                    participante={participante}
                  />
                );
              })
            ) : (
              <Text style={styles.emptyText}>
                Nenhum participante cadastrado.
              </Text>
            )}
          </GlassPanel>

          <GlassPanel
            title="Gastos"
            subtitle="Despesas compartilhadas deste planejamento."
            action={
              structuralMutationsAllowed ? (
                <GlassButton
                  disabled={aggregateMutationInProgress}
                  label="Adicionar gasto"
                  onPress={() => {
                    if (aggregateMutationLockRef.current) {
                      return;
                    }

                    router.push({
                      pathname: '/planejamentos-gasto-form',
                      params: { id: planejamento.id },
                    } as never);
                  }}
                  variant="ghost"
                />
              ) : undefined
            }
          >
            {gastosError ? (
              <Text style={styles.gastosError}>{gastosError}</Text>
            ) : null}
            {gastosInfo ? (
              <Text style={styles.gastosInfo}>{gastosInfo}</Text>
            ) : null}

            {gastos.length ? (
              gastos.map((gasto) => (
                <GastoRow
                  key={gasto.id}
                  actionLoading={gastoActionLoading === gasto.id}
                  canMutate={
                    structuralMutationsAllowed && gasto.status === 'ATIVO'
                  }
                  disabled={aggregateMutationInProgress}
                  gasto={gasto}
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
              ))
            ) : (
              <Text style={styles.emptyText}>Nenhum gasto cadastrado.</Text>
            )}
          </GlassPanel>

          <GlassPanel
            title="Acertos"
            subtitle="Pagamentos calculados entre participantes."
            action={
              settlementMutationsAllowed ? (
                <GlassButton
                  disabled={aggregateMutationInProgress}
                  label={
                    acertosActionLoading === 'sync'
                      ? 'Sincronizando...'
                      : 'Sincronizar acertos'
                  }
                  onPress={handleSyncAcertos}
                  variant="ghost"
                />
              ) : undefined
            }
          >
            {acertosError ? (
              <Text style={styles.acertosError}>{acertosError}</Text>
            ) : null}
            {acertosInfo ? (
              <Text style={styles.acertosInfo}>{acertosInfo}</Text>
            ) : null}

            {acertos.length ? (
              acertos.map((acerto) => (
                <AcertoRow
                  key={acerto.id}
                  acerto={acerto}
                  actionLoading={acertosActionLoading}
                  canOperate={settlementMutationsAllowed}
                  disabled={aggregateMutationInProgress}
                  onAction={handleAcertoAction}
                  participantes={participantes}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>
                {isReadOnly
                  ? 'Nenhum acerto registrado.'
                  : 'Nenhum acerto encontrado. Cadastre gastos e participantes ativos para calcular os acertos.'}
              </Text>
            )}
          </GlassPanel>
        </>
      ) : null}
    </FinanceAppShell>
  );
}

export default PlanejamentoDetailScreen;

const styles = StyleSheet.create({
  actionError: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
  actionInfo: {
    color: FinanceTheme.colors.success,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
  acertosError: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
  acertosInfo: {
    color: FinanceTheme.colors.success,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
  emptyText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
  },
  gastosError: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
  gastosInfo: {
    color: FinanceTheme.colors.success,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginBottom: FinanceTheme.spacing.sm,
  },
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
  lifecycleActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
  },
  lifecycleHint: {
    color: FinanceTheme.colors.warning,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.sm,
  },
  readOnlyText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
});
