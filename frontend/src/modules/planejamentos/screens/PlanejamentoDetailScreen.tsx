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
import { formatCurrency, formatDate } from '../../../../utils/formatters';
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
  AcertoPlanejamentoStatus,
  GastoPlanejamento,
  GastoPlanejamentoComportamento,
  GastoPlanejamentoStatus,
  ParticipantePlanejamento,
  ParticipantePlanejamentoStatus,
  ParticipantePlanejamentoTipo,
  Planejamento,
  PlanejamentoSituacaoFinanceira,
  PlanejamentoStatus,
  PlanejamentoTipo,
  ResumoFinanceiroPlanejamento,
  SaldoParticipanteResumoFinanceiroPlanejamento,
} from '../types/planejamento';

const statusLabel: Record<PlanejamentoStatus, string> = {
  ABERTO: 'Aberto',
  ARQUIVADO: 'Arquivado',
  CANCELADO: 'Cancelado',
  FECHADO: 'Fechado',
};

const tipoLabel: Record<PlanejamentoTipo, string> = {
  CASA: 'Casa',
  EVENTO: 'Evento',
  FESTA: 'Festa',
  GRUPO: 'Grupo',
  OUTRO: 'Outro',
  VIAGEM: 'Viagem',
};

const participanteTipoLabel: Record<ParticipantePlanejamentoTipo, string> = {
  CONVIDADO: 'Convidado',
  MANUAL: 'Manual',
  VINCULADO: 'Vinculado',
};

const participanteStatusLabel: Record<ParticipantePlanejamentoStatus, string> = {
  ATIVO: 'Ativo',
  PENDENTE: 'Pendente',
  REMOVIDO: 'Removido',
};

const gastoComportamentoLabel: Record<GastoPlanejamentoComportamento, string> = {
  EVENTUAL: 'Eventual',
  FIXO: 'Fixo',
  VARIAVEL: 'Variavel',
};

const gastoStatusLabel: Record<GastoPlanejamentoStatus, string> = {
  ATIVO: 'ATIVO',
  CANCELADO: 'CANCELADO',
  PENDENTE_REVISAO: 'PENDENTE_REVISAO',
};

const acertoStatusLabel: Record<AcertoPlanejamentoStatus, string> = {
  CANCELADO: 'Cancelado',
  CONFIRMADO: 'Confirmado',
  PAGO: 'Pago',
  PENDENTE: 'Pendente',
};

const situacaoFinanceiraLabel: Record<
  PlanejamentoSituacaoFinanceira,
  string
> = {
  PENDENTE: 'Pendente',
  QUITADO: 'Quitado',
};

type AcertoAction = 'cancel' | 'pay' | 'reopen';
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

function formatOptionalDate(date: string | null | undefined) {
  return date ? formatDate(date.slice(0, 10)) : '-';
}

function formatCents(value: number) {
  return formatCurrency(value / 100);
}

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
          <GlassPanel title="Dados gerais" accent="cyan">
            <View style={styles.headerRow}>
              <Text style={styles.title}>{planejamento.nome}</Text>
              <View
                style={[
                  styles.badge,
                  planejamento.status === 'ABERTO'
                    ? styles.badgeOpen
                    : styles.badgeClosed,
                ]}
              >
                <Text style={styles.badgeText}>
                  {statusLabel[planejamento.status]}
                </Text>
              </View>
            </View>
            <Text style={styles.typeText}>{tipoLabel[planejamento.tipo]}</Text>
            {planejamento.descricao ? (
              <Text style={styles.description}>{planejamento.descricao}</Text>
            ) : null}

            <View style={styles.infoGrid}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Inicio</Text>
                <Text style={styles.infoValue}>
                  {formatOptionalDate(planejamento.dataInicio)}
                </Text>
              </View>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Fim</Text>
                <Text style={styles.infoValue}>
                  {formatOptionalDate(planejamento.dataFim)}
                </Text>
              </View>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Criado em</Text>
                <Text style={styles.infoValue}>
                  {formatOptionalDate(planejamento.createdAt)}
                </Text>
              </View>
            </View>
          </GlassPanel>

          {resumo ? (
            <GlassPanel
              title="Resumo financeiro"
              subtitle="Valores oficiais calculados pelo backend."
              accent="magenta"
            >
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCell}>
                  <Text style={styles.infoLabel}>Situacao financeira</Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      resumo.situacaoFinanceira === 'QUITADO'
                        ? styles.summaryValueSettled
                        : styles.summaryValuePending,
                    ]}
                  >
                    {situacaoFinanceiraLabel[resumo.situacaoFinanceira]}
                  </Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.infoLabel}>Total de gastos ativos</Text>
                  <Text style={styles.summaryValue}>
                    {formatCents(resumo.totalGastosAtivosCentavos)}
                  </Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.infoLabel}>Obrigacao residual</Text>
                  <Text style={styles.summaryValue}>
                    {formatCents(resumo.obrigacaoResidualCentavos)}
                  </Text>
                </View>
              </View>

              <Text style={styles.summarySectionTitle}>
                Saldos por participante
              </Text>
              {resumo.participantes.length ? (
                resumo.participantes.map((saldoParticipante) => (
                  <SaldoParticipanteRow
                    key={saldoParticipante.participante.id}
                    saldoParticipante={saldoParticipante}
                  />
                ))
              ) : (
                <Text style={styles.emptyText}>
                  Nenhum participante com dados financeiros.
                </Text>
              )}
            </GlassPanel>
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

function ParticipanteRow({
  actionLoading,
  canRemove,
  disabled,
  isOwnerParticipant,
  onRemove,
  participante,
}: {
  actionLoading: boolean;
  canRemove: boolean;
  disabled: boolean;
  isOwnerParticipant: boolean;
  onRemove: (participante: ParticipantePlanejamento) => void;
  participante: ParticipantePlanejamento;
}) {
  return (
    <View
      style={styles.participantRow}
      testID={`participante-row-${participante.id}`}
    >
      <View style={styles.participantAvatar}>
        <Text style={styles.participantInitial}>
          {participante.nome.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={styles.participantInfo}>
        <Text style={styles.participantName}>{participante.nome}</Text>
        {participante.email ? (
          <Text style={styles.participantEmail}>{participante.email}</Text>
        ) : null}
        <View style={styles.participantBadges}>
          <View style={styles.participantBadge}>
            <Text style={styles.participantBadgeText}>
              {participanteTipoLabel[participante.tipo]}
            </Text>
          </View>
          <View
            style={[
              styles.participantBadge,
              participante.status === 'ATIVO'
                ? styles.participantBadgeActive
                : null,
            ]}
          >
            <Text style={styles.participantBadgeText}>
              {participanteStatusLabel[participante.status]}
            </Text>
          </View>
          {isOwnerParticipant ? (
            <View style={styles.participantBadge}>
              <Text style={styles.participantBadgeText}>Proprietário</Text>
            </View>
          ) : null}
        </View>
      </View>
      {canRemove ? (
        <GlassButton
          disabled={disabled}
          label={
            actionLoading
              ? 'Removendo participante...'
              : 'Remover participante'
          }
          onPress={() => onRemove(participante)}
          variant="danger"
        />
      ) : null}
    </View>
  );
}

function SaldoParticipanteRow({
  saldoParticipante,
}: {
  saldoParticipante: SaldoParticipanteResumoFinanceiroPlanejamento;
}) {
  return (
    <View style={styles.balanceRow}>
      <View style={styles.balanceMain}>
        <Text style={styles.balanceParticipantName}>
          {saldoParticipante.participante.nome}
        </Text>
        <Text style={styles.balanceLabel}>Saldo aberto</Text>
      </View>
      <View style={styles.balanceSide}>
        <Text
          style={[
            styles.balanceValue,
            saldoParticipante.statusFinanceiro === 'DEVEDOR'
              ? styles.balanceValueDebtor
              : null,
          ]}
        >
          {formatCents(saldoParticipante.saldoAbertoCentavos)}
        </Text>
        <View
          style={[
            styles.financialStatusBadge,
            getFinancialStatusBadgeStyle(saldoParticipante.statusFinanceiro),
          ]}
        >
          <Text style={styles.financialStatusText}>
            {saldoParticipante.statusFinanceiro}
          </Text>
        </View>
      </View>
    </View>
  );
}

function GastoRow({
  actionLoading,
  canMutate,
  disabled,
  gasto,
  onCancel,
  onEdit,
  participantes,
}: {
  actionLoading: boolean;
  canMutate: boolean;
  disabled: boolean;
  gasto: GastoPlanejamento;
  onCancel: (gasto: GastoPlanejamento) => void;
  onEdit: (gasto: GastoPlanejamento) => void;
  participantes: ParticipantePlanejamento[];
}) {
  const pagador =
    gasto.pagoPorParticipante ??
    participantes.find(
      (participante) => participante.id === gasto.pagoPorParticipanteId,
    );

  return (
    <View style={styles.expenseRow}>
      <View style={styles.expenseMain}>
        <View style={styles.expenseHeader}>
          <Text style={styles.expenseDescription}>{gasto.descricao}</Text>
          <View
            style={[
              styles.expenseStatusBadge,
              getGastoBadgeStyle(gasto.status),
            ]}
          >
            <Text style={styles.expenseStatusText}>
              {gastoStatusLabel[gasto.status]}
            </Text>
          </View>
        </View>
        <Text style={styles.expenseMeta}>
          {formatOptionalDate(gasto.dataGasto)} -{' '}
          {gastoComportamentoLabel[gasto.comportamento]}
          {gasto.categoria ? ` - ${gasto.categoria}` : ''}
        </Text>
        {pagador ? (
          <Text style={styles.expenseMeta}>Pago por {pagador.nome}</Text>
        ) : null}
      </View>
      <View style={styles.expenseSide}>
        <Text style={styles.expenseValue}>
          {formatCents(gasto.valorCentavos)}
        </Text>
        {canMutate ? (
          <View style={styles.expenseActions}>
            <GlassButton
              disabled={disabled}
              label="Editar"
              onPress={() => onEdit(gasto)}
              variant="ghost"
            />
            <GlassButton
              disabled={disabled}
              label={actionLoading ? 'Cancelando gasto...' : 'Cancelar gasto'}
              onPress={() => onCancel(gasto)}
              variant="danger"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function AcertoRow({
  acerto,
  actionLoading,
  canOperate,
  disabled,
  onAction,
  participantes,
}: {
  acerto: AcertoPlanejamento;
  actionLoading: string | null;
  canOperate: boolean;
  disabled: boolean;
  onAction: (acerto: AcertoPlanejamento, action: AcertoAction) => void;
  participantes: ParticipantePlanejamento[];
}) {
  const devedor =
    acerto.deParticipante ??
    participantes.find(
      (participante) => participante.id === acerto.deParticipanteId,
    );
  const recebedor =
    acerto.paraParticipante ??
    participantes.find(
      (participante) => participante.id === acerto.paraParticipanteId,
    );
  const devedorNome = devedor?.nome ?? 'Participante devedor';
  const recebedorNome = recebedor?.nome ?? 'Participante recebedor';

  return (
    <View style={styles.settlementRow}>
      <View style={styles.settlementMain}>
        <View style={styles.settlementHeader}>
          <Text style={styles.settlementTitle}>
            {devedorNome} deve pagar {recebedorNome}
          </Text>
          <View
            style={[
              styles.settlementBadge,
              getAcertoBadgeStyle(acerto.status),
            ]}
          >
            <Text style={styles.settlementBadgeText}>
              {acertoStatusLabel[acerto.status]}
            </Text>
          </View>
        </View>

        <Text style={styles.settlementMeta}>Devedor: {devedorNome}</Text>
        <Text style={styles.settlementMeta}>Recebedor: {recebedorNome}</Text>
        {acerto.dataPagamento ? (
          <Text style={styles.settlementMeta}>
            Pago em {formatOptionalDate(acerto.dataPagamento)}
          </Text>
        ) : null}
        {acerto.observacao ? (
          <Text style={styles.settlementMeta}>
            Observacao: {acerto.observacao}
          </Text>
        ) : null}
      </View>

      <View style={styles.settlementSide}>
        <Text style={styles.settlementValue}>
          {formatCents(acerto.valorCentavos)}
        </Text>
        <AcertoActions
          acerto={acerto}
          actionLoading={actionLoading}
          canOperate={canOperate}
          disabled={disabled}
          onAction={onAction}
        />
      </View>
    </View>
  );
}

function AcertoActions({
  acerto,
  actionLoading,
  canOperate,
  disabled,
  onAction,
}: {
  acerto: AcertoPlanejamento;
  actionLoading: string | null;
  canOperate: boolean;
  disabled: boolean;
  onAction: (acerto: AcertoPlanejamento, action: AcertoAction) => void;
}) {
  const payLoading = actionLoading === `pay:${acerto.id}`;
  const cancelLoading = actionLoading === `cancel:${acerto.id}`;
  const reopenLoading = actionLoading === `reopen:${acerto.id}`;

  if (!canOperate) {
    return null;
  }

  if (acerto.status === 'PENDENTE') {
    return (
      <View style={styles.settlementActions}>
        <GlassButton
          disabled={disabled}
          label={payLoading ? 'Marcando...' : 'Marcar como pago'}
          onPress={() => onAction(acerto, 'pay')}
          variant="primary"
        />
        <GlassButton
          disabled={disabled}
          label={cancelLoading ? 'Cancelando...' : 'Cancelar'}
          onPress={() => onAction(acerto, 'cancel')}
          variant="danger"
        />
      </View>
    );
  }

  if (acerto.status === 'PAGO') {
    return (
      <View style={styles.settlementActions}>
        <GlassButton
          disabled={disabled}
          label={reopenLoading ? 'Reabrindo...' : 'Reabrir'}
          onPress={() => onAction(acerto, 'reopen')}
          variant="ghost"
        />
      </View>
    );
  }

  return null;
}

function getAcertoBadgeStyle(status: AcertoPlanejamentoStatus) {
  if (status === 'PENDENTE') {
    return styles.settlementBadgePending;
  }

  if (status === 'PAGO' || status === 'CONFIRMADO') {
    return styles.settlementBadgePaid;
  }

  return styles.settlementBadgeCanceled;
}

function getGastoBadgeStyle(status: GastoPlanejamentoStatus) {
  if (status === 'ATIVO') {
    return styles.expenseStatusActive;
  }

  if (status === 'PENDENTE_REVISAO') {
    return styles.expenseStatusPending;
  }

  return styles.expenseStatusCanceled;
}

function getFinancialStatusBadgeStyle(
  status: SaldoParticipanteResumoFinanceiroPlanejamento['statusFinanceiro'],
) {
  if (status === 'DEVEDOR') {
    return styles.financialStatusDebtor;
  }

  if (status === 'RECEBEDOR') {
    return styles.financialStatusReceiver;
  }

  return styles.financialStatusSettled;
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
  badge: {
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  badgeClosed: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
  },
  badgeOpen: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  badgeText: {
    color: FinanceTheme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  balanceLabel: {
    color: FinanceTheme.colors.textSubtle,
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.xxs,
  },
  balanceMain: {
    flex: 1,
    minWidth: 140,
  },
  balanceParticipantName: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
  },
  balanceRow: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
    marginBottom: FinanceTheme.spacing.sm,
    padding: FinanceTheme.spacing.sm,
  },
  balanceSide: {
    alignItems: 'flex-end',
    gap: FinanceTheme.spacing.xs,
  },
  balanceValue: {
    color: FinanceTheme.colors.success,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
  },
  balanceValueDebtor: {
    color: FinanceTheme.colors.danger,
  },
  description: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.sm,
  },
  emptyText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
  },
  expenseDescription: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
  },
  expenseActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.xs,
    justifyContent: 'flex-end',
  },
  expenseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.xs,
  },
  expenseMain: {
    flex: 1,
    minWidth: 180,
  },
  expenseMeta: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.xxs,
  },
  expenseRow: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
    marginBottom: FinanceTheme.spacing.sm,
    padding: FinanceTheme.spacing.sm,
  },
  expenseSide: {
    alignItems: 'flex-end',
    gap: FinanceTheme.spacing.xs,
  },
  expenseStatusActive: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  expenseStatusBadge: {
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  expenseStatusCanceled: {
    backgroundColor: 'rgba(255, 122, 144, 0.10)',
    borderColor: 'rgba(255, 122, 144, 0.34)',
  },
  expenseStatusPending: {
    backgroundColor: 'rgba(255, 208, 106, 0.12)',
    borderColor: 'rgba(255, 208, 106, 0.38)',
  },
  expenseStatusText: {
    color: FinanceTheme.colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  expenseValue: {
    color: FinanceTheme.colors.success,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
  },
  financialStatusBadge: {
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  financialStatusDebtor: {
    backgroundColor: 'rgba(255, 122, 144, 0.10)',
    borderColor: 'rgba(255, 122, 144, 0.34)',
  },
  financialStatusReceiver: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  financialStatusSettled: {
    backgroundColor: 'rgba(119, 242, 178, 0.14)',
    borderColor: 'rgba(119, 242, 178, 0.42)',
  },
  financialStatusText: {
    color: FinanceTheme.colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    justifyContent: 'space-between',
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
  infoCell: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flex: 1,
    minWidth: 150,
    padding: FinanceTheme.spacing.sm,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
    marginTop: FinanceTheme.spacing.md,
  },
  infoLabel: {
    color: FinanceTheme.colors.textSubtle,
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginTop: FinanceTheme.spacing.xxs,
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
  participantAvatar: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  participantBadge: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  participantBadgeActive: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  participantBadgeText: {
    color: FinanceTheme.colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  participantBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.xs,
    marginTop: FinanceTheme.spacing.xs,
  },
  participantEmail: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xxs,
  },
  participantInfo: {
    flex: 1,
    minWidth: 0,
  },
  participantInitial: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
  },
  participantName: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
  participantRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    marginBottom: FinanceTheme.spacing.sm,
  },
  readOnlyText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
  settlementActions: {
    gap: FinanceTheme.spacing.xs,
    minWidth: 170,
    width: '100%',
  },
  settlementBadge: {
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  settlementBadgeCanceled: {
    backgroundColor: 'rgba(255, 122, 144, 0.10)',
    borderColor: 'rgba(255, 122, 144, 0.34)',
  },
  settlementBadgePaid: {
    backgroundColor: 'rgba(119, 242, 178, 0.14)',
    borderColor: 'rgba(119, 242, 178, 0.42)',
  },
  settlementBadgePending: {
    backgroundColor: 'rgba(255, 209, 102, 0.12)',
    borderColor: 'rgba(255, 209, 102, 0.40)',
  },
  settlementBadgeText: {
    color: FinanceTheme.colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  settlementHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.xs,
    justifyContent: 'space-between',
  },
  settlementMain: {
    flex: 1,
    minWidth: 0,
  },
  settlementMeta: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '700',
    marginTop: FinanceTheme.spacing.xxs,
  },
  settlementRow: {
    alignItems: 'flex-start',
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
    marginBottom: FinanceTheme.spacing.sm,
    padding: FinanceTheme.spacing.sm,
  },
  settlementSide: {
    alignItems: 'flex-end',
    gap: FinanceTheme.spacing.sm,
    minWidth: 170,
  },
  settlementTitle: {
    color: FinanceTheme.colors.text,
    flex: 1,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
    minWidth: 180,
  },
  settlementValue: {
    color: FinanceTheme.colors.success,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
  },
  summaryCell: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flex: 1,
    minWidth: 180,
    padding: FinanceTheme.spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
  },
  summarySectionTitle: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
    marginBottom: FinanceTheme.spacing.sm,
    marginTop: FinanceTheme.spacing.md,
  },
  summaryValue: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '900',
    marginTop: FinanceTheme.spacing.xs,
  },
  summaryValuePending: {
    color: FinanceTheme.colors.warning,
  },
  summaryValueSettled: {
    color: FinanceTheme.colors.success,
  },
  title: {
    color: FinanceTheme.colors.text,
    flex: 1,
    fontSize: FinanceTheme.typography.heading,
    fontWeight: '900',
  },
  typeText: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
    marginTop: FinanceTheme.spacing.xs,
  },
});
