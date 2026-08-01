import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveApiError } from '../../../../utils/api-error';
import { confirmAction } from '../../../../utils/confirm-action';
import {
  canAddPlanejamentoParticipant,
  canCreatePlanejamentoExpense,
  canEditPlanejamentoExpense,
  findActiveLinkedParticipant,
  isPlanejamentoOwner,
} from '../authorization/planejamentoAuthorization';
import type { AcertoAction } from '../components/detail/AcertoRow';
import type { PlanejamentoTransition } from '../components/detail/PlanejamentoLifecycleSection';
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
import type {
  AcertoPlanejamento,
  GastoPlanejamento,
  ParticipantePlanejamento,
  Planejamento,
  ResumoFinanceiroPlanejamento,
} from '../types/planejamento';

type TransitionConfig = {
  confirmationMessage: string;
  confirmationTitle: string;
  errorMessage: string;
  loadingLabel: string;
  request: (planejamentoId: string) => Promise<Planejamento>;
  successMessage: string;
};

type AggregateMutationToken = {
  contextGeneration: number;
  key: string;
};

type MutationContext = {
  generation: number;
  planejamentoId?: string;
};

type CurrentMutationCapabilities = {
  canCancelExpense: (gasto: GastoPlanejamento) => boolean;
  canPerformSettlementAction: (
    acerto: AcertoPlanejamento,
    action: AcertoAction,
  ) => boolean;
  canPerformTransition: (transition: PlanejamentoTransition) => boolean;
  canRemoveParticipant: (
    participante: ParticipantePlanejamento,
  ) => boolean;
  canSyncSettlements: boolean;
};

const transitionConfig: Record<PlanejamentoTransition, TransitionConfig> = {
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

const acertoActionRequests: Record<
  AcertoAction,
  (
    planejamentoId: string,
    acertoId: string,
  ) => Promise<AcertoPlanejamento>
> = {
  cancel: cancelAcertoPlanejamento,
  pay: payAcertoPlanejamento,
  reopen: reopenAcertoPlanejamento,
};

export type UsePlanejamentoDetailMutationsOptions = {
  applyParticipantUpdate: (
    participante: ParticipantePlanejamento,
  ) => void;
  isCurrentContext: (expectedPlanejamentoId: string) => boolean;
  onUnauthorized: () => void;
  planejamento: Planejamento | null;
  planejamentoId?: string;
  refreshExpenseFinancialData: (
    expectedPlanejamentoId: string,
  ) => Promise<boolean>;
  refreshFinancialData: (
    expectedPlanejamentoId: string,
  ) => Promise<boolean>;
  reloadAllData: (expectedPlanejamentoId: string) => Promise<boolean>;
  resumo: ResumoFinanceiroPlanejamento | null;
  usuarioAutenticadoId: string | null;
};

export type UsePlanejamentoDetailMutationsResult = {
  acertosActionLoading: string | null;
  acertosError: string;
  acertosInfo: string;
  aggregateMutationInProgress: boolean;
  canAddParticipant: boolean;
  canCancelExpense: (gasto: GastoPlanejamento) => boolean;
  canCreateExpense: boolean;
  canEditExpense: (gasto: GastoPlanejamento) => boolean;
  canManageLifecycle: boolean;
  canNavigateToAddParticipant: () => boolean;
  canNavigateToCreateExpense: () => boolean;
  canNavigateToEditExpense: (gasto: GastoPlanejamento) => boolean;
  canPerformSettlementAction: (
    acerto: AcertoPlanejamento,
    action: AcertoAction,
  ) => boolean;
  canRemoveParticipant: (
    participante: ParticipantePlanejamento,
  ) => boolean;
  canSyncSettlements: boolean;
  gastoActionLoading: string | null;
  gastosError: string;
  gastosInfo: string;
  handleAcertoAction: (
    acerto: AcertoPlanejamento,
    action: AcertoAction,
  ) => Promise<void>;
  handleCancelGasto: (gasto: GastoPlanejamento) => Promise<void>;
  handleRemoveParticipante: (
    participante: ParticipantePlanejamento,
  ) => Promise<void>;
  handleSyncAcertos: () => Promise<void>;
  handleTransition: (
    transition: PlanejamentoTransition,
  ) => Promise<void>;
  isFinanciallySettled: boolean;
  isReadOnly: boolean;
  participanteActionLoading: string | null;
  participantesError: string;
  participantesInfo: string;
  transitionError: string;
  transitionInfo: string;
  transitionLoading: PlanejamentoTransition | null;
  transitionLoadingLabel: string;
};

function isTransitionAllowed(
  transition: PlanejamentoTransition,
  planejamento: Planejamento | null,
  isFinanciallySettled: boolean,
) {
  if (transition === 'close') {
    return planejamento?.status === 'ABERTO';
  }

  if (!isFinanciallySettled) {
    return false;
  }

  return transition === 'cancel'
    ? planejamento?.status === 'ABERTO'
    : planejamento?.status === 'FECHADO';
}

export function usePlanejamentoDetailMutations({
  applyParticipantUpdate,
  isCurrentContext,
  onUnauthorized,
  planejamento,
  planejamentoId,
  refreshExpenseFinancialData,
  refreshFinancialData,
  reloadAllData,
  resumo,
  usuarioAutenticadoId,
}: UsePlanejamentoDetailMutationsOptions): UsePlanejamentoDetailMutationsResult {
  const [acertosActionLoading, setAcertosActionLoading] = useState<
    string | null
  >(null);
  const [acertosError, setAcertosError] = useState('');
  const [acertosInfo, setAcertosInfo] = useState('');
  const [aggregateMutationLocked, setAggregateMutationLocked] =
    useState(false);
  const [gastoActionLoading, setGastoActionLoading] = useState<string | null>(
    null,
  );
  const [gastosError, setGastosError] = useState('');
  const [gastosInfo, setGastosInfo] = useState('');
  const [participanteActionLoading, setParticipanteActionLoading] = useState<
    string | null
  >(null);
  const [participantesError, setParticipantesError] = useState('');
  const [participantesInfo, setParticipantesInfo] = useState('');
  const [transitionError, setTransitionError] = useState('');
  const [transitionInfo, setTransitionInfo] = useState('');
  const [transitionLoading, setTransitionLoading] =
    useState<PlanejamentoTransition | null>(null);
  const aggregateMutationLockRef = useRef<AggregateMutationToken | null>(
    null,
  );
  const currentMutationCapabilitiesRef =
    useRef<CurrentMutationCapabilities | null>(null);
  const mountedRef = useRef(true);
  const mutationContextRef = useRef<MutationContext>({
    generation: 0,
    planejamentoId,
  });
  const transitionLockRef = useRef<PlanejamentoTransition | null>(null);
  const onUnauthorizedRef = useRef(onUnauthorized);

  onUnauthorizedRef.current = onUnauthorized;

  if (mutationContextRef.current.planejamentoId !== planejamentoId) {
    mutationContextRef.current = {
      generation: mutationContextRef.current.generation + 1,
      planejamentoId,
    };
  }

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      mutationContextRef.current.generation += 1;
    };
  }, []);

  useEffect(() => {
    setAcertosActionLoading(null);
    setAcertosError('');
    setAcertosInfo('');
    setGastoActionLoading(null);
    setGastosError('');
    setGastosInfo('');
    setParticipanteActionLoading(null);
    setParticipantesError('');
    setParticipantesInfo('');
    setTransitionLoading(null);
    setTransitionError('');
    setTransitionInfo('');
  }, [planejamentoId]);

  const settlementMutationsAllowed =
    planejamento?.status === 'ABERTO' || planejamento?.status === 'FECHADO';
  const structuralMutationsAllowed = planejamento?.status === 'ABERTO';
  const isFinanciallySettled = resumo?.situacaoFinanceira === 'QUITADO';
  const isReadOnly =
    planejamento?.status === 'ARQUIVADO' ||
    planejamento?.status === 'CANCELADO';
  const isAuthenticatedUserOwner = isPlanejamentoOwner(
    planejamento,
    usuarioAutenticadoId,
  );
  const authenticatedParticipant = findActiveLinkedParticipant(
    planejamento,
    usuarioAutenticadoId,
  );
  const canActAsAggregateMember =
    isAuthenticatedUserOwner || !!authenticatedParticipant;
  const canAddParticipant = canAddPlanejamentoParticipant(
    planejamento,
    usuarioAutenticadoId,
  );
  const canCreateExpense = canCreatePlanejamentoExpense(
    planejamento,
    usuarioAutenticadoId,
  );
  const canManageLifecycle =
    isAuthenticatedUserOwner &&
    (planejamento?.status === 'ABERTO' ||
      planejamento?.status === 'FECHADO');
  const canSyncSettlements =
    settlementMutationsAllowed && canActAsAggregateMember;
  const aggregateMutationInProgress =
    aggregateMutationLocked ||
    !!acertosActionLoading ||
    !!gastoActionLoading ||
    !!participanteActionLoading ||
    !!transitionLoading;
  const transitionLoadingLabel = transitionLoading
    ? transitionConfig[transitionLoading].loadingLabel
    : '';

  const acquireAggregateMutationLock = useCallback(
    (lockKey: string): AggregateMutationToken | null => {
      if (aggregateMutationLockRef.current) {
        return null;
      }

      const token = {
        contextGeneration: mutationContextRef.current.generation,
        key: lockKey,
      };
      aggregateMutationLockRef.current = token;
      setAggregateMutationLocked(true);
      return token;
    },
    [],
  );

  const releaseAggregateMutationLock = useCallback(
    (token: AggregateMutationToken) => {
      if (aggregateMutationLockRef.current === token) {
        aggregateMutationLockRef.current = null;

        if (mountedRef.current) {
          setAggregateMutationLocked(false);
        }
      }
    },
    [],
  );

  const isCurrentMutationContext = useCallback(
    (
      expectedPlanejamentoId: string,
      expectedGeneration: number,
    ) =>
      mountedRef.current &&
      mutationContextRef.current.generation === expectedGeneration &&
      mutationContextRef.current.planejamentoId ===
        expectedPlanejamentoId &&
      isCurrentContext(expectedPlanejamentoId),
    [isCurrentContext],
  );

  const reportMutationError = useCallback(
    async (
      error: unknown,
      fallbackMessage: string,
      expectedPlanejamentoId: string,
      expectedGeneration: number,
      setErrorMessage: (message: string) => void,
    ): Promise<void> => {
      if (
        !isCurrentMutationContext(
          expectedPlanejamentoId,
          expectedGeneration,
        )
      ) {
        return;
      }

      const resolvedError = await resolveApiError(error, fallbackMessage);

      if (
        !isCurrentMutationContext(
          expectedPlanejamentoId,
          expectedGeneration,
        )
      ) {
        return;
      }

      setErrorMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        onUnauthorizedRef.current();
      }
    },
    [isCurrentMutationContext],
  );

  const canRemoveParticipant = useCallback(
    (participante: ParticipantePlanejamento) =>
      canAddParticipant &&
      participante.status === 'ATIVO' &&
      participante.usuarioId !== planejamento?.usuarioCriadorId,
    [canAddParticipant, planejamento?.usuarioCriadorId],
  );

  const canEditExpense = useCallback(
    (gasto: GastoPlanejamento) =>
      canEditPlanejamentoExpense(
        planejamento,
        gasto,
        usuarioAutenticadoId,
      ),
    [planejamento, usuarioAutenticadoId],
  );

  const canCancelExpense = useCallback(
    (gasto: GastoPlanejamento) =>
      structuralMutationsAllowed &&
      isAuthenticatedUserOwner &&
      gasto.status === 'ATIVO',
    [isAuthenticatedUserOwner, structuralMutationsAllowed],
  );

  const canPerformSettlementAction = useCallback(
    (acerto: AcertoPlanejamento, action: AcertoAction) => {
      if (!settlementMutationsAllowed) {
        return false;
      }

      if (action === 'pay') {
        return (
          acerto.status === 'PENDENTE' &&
          (isAuthenticatedUserOwner ||
            authenticatedParticipant?.id === acerto.deParticipanteId)
        );
      }

      if (action === 'cancel') {
        return (
          (acerto.status === 'PENDENTE' || acerto.status === 'PAGO') &&
          isAuthenticatedUserOwner
        );
      }

      return acerto.status === 'PAGO' && isAuthenticatedUserOwner;
    },
    [
      authenticatedParticipant?.id,
      isAuthenticatedUserOwner,
      settlementMutationsAllowed,
    ],
  );

  const canPerformTransition = useCallback(
    (transition: PlanejamentoTransition) =>
      canManageLifecycle &&
      isTransitionAllowed(transition, planejamento, isFinanciallySettled),
    [canManageLifecycle, isFinanciallySettled, planejamento],
  );

  currentMutationCapabilitiesRef.current = {
    canCancelExpense,
    canPerformSettlementAction,
    canPerformTransition,
    canRemoveParticipant,
    canSyncSettlements,
  };

  const hasCurrentMutationCapability = useCallback(
    (
      expectedPlanejamentoId: string,
      expectedGeneration: number,
      isAllowed: (capabilities: CurrentMutationCapabilities) => boolean,
    ) => {
      const capabilities = currentMutationCapabilitiesRef.current;

      return (
        !!capabilities &&
        isCurrentMutationContext(
          expectedPlanejamentoId,
          expectedGeneration,
        ) &&
        isAllowed(capabilities)
      );
    },
    [isCurrentMutationContext],
  );

  const canNavigateToAddParticipant = useCallback(
    () =>
      !!planejamentoId &&
      canAddParticipant &&
      !aggregateMutationLockRef.current,
    [canAddParticipant, planejamentoId],
  );

  const canNavigateToCreateExpense = useCallback(
    () =>
      !!planejamentoId &&
      canCreateExpense &&
      !aggregateMutationLockRef.current,
    [canCreateExpense, planejamentoId],
  );

  const canNavigateToEditExpense = useCallback(
    (gasto: GastoPlanejamento) =>
      !!planejamentoId &&
      canEditExpense(gasto) &&
      !aggregateMutationLockRef.current,
    [canEditExpense, planejamentoId],
  );

  const handleSyncAcertos = useCallback(async () => {
    const currentPlanejamentoId = planejamentoId;
    const currentGeneration = mutationContextRef.current.generation;
    const lockKey = 'acerto:sync';

    if (
      !currentPlanejamentoId ||
      !hasCurrentMutationCapability(
        currentPlanejamentoId,
        currentGeneration,
        (capabilities) => capabilities.canSyncSettlements,
      )
    ) {
      return;
    }

    const mutationToken = acquireAggregateMutationLock(lockKey);

    if (!mutationToken) {
      return;
    }

    try {
      setAcertosActionLoading('sync');
      setAcertosError('');
      setAcertosInfo('');

      const acertosSincronizados = await syncAcertosPlanejamento(
        currentPlanejamentoId,
      );

      if (
        !hasCurrentMutationCapability(
          currentPlanejamentoId,
          mutationToken.contextGeneration,
          (capabilities) => capabilities.canSyncSettlements,
        )
      ) {
        return;
      }

      const dataApplied = await refreshFinancialData(
        currentPlanejamentoId,
      );

      if (
        isCurrentMutationContext(
          currentPlanejamentoId,
          mutationToken.contextGeneration,
        ) &&
        dataApplied
      ) {
        setAcertosInfo(
          acertosSincronizados.length
            ? 'Acertos sincronizados com sucesso.'
            : 'Ainda nao ha dados suficientes para gerar acertos. Cadastre gastos e participantes ativos e tente novamente.',
        );
      }
    } catch (error) {
      await reportMutationError(
        error,
        'Nao foi possivel sincronizar os acertos.',
        currentPlanejamentoId,
        mutationToken.contextGeneration,
        setAcertosError,
      );
    } finally {
      if (
        isCurrentMutationContext(
          currentPlanejamentoId,
          mutationToken.contextGeneration,
        )
      ) {
        setAcertosActionLoading(null);
      }
      releaseAggregateMutationLock(mutationToken);
    }
  }, [
    acquireAggregateMutationLock,
    hasCurrentMutationCapability,
    isCurrentMutationContext,
    planejamentoId,
    refreshFinancialData,
    releaseAggregateMutationLock,
    reportMutationError,
  ]);

  const handleAcertoAction = useCallback(
    async (acerto: AcertoPlanejamento, action: AcertoAction) => {
      const currentPlanejamentoId = planejamentoId;
      const currentGeneration = mutationContextRef.current.generation;
      const actionKey = `${action}:${acerto.id}`;
      const lockKey = `acerto:${actionKey}`;

      if (
        !currentPlanejamentoId ||
        !hasCurrentMutationCapability(
          currentPlanejamentoId,
          currentGeneration,
          (capabilities) =>
            capabilities.canPerformSettlementAction(acerto, action),
        )
      ) {
        return;
      }

      const mutationToken = acquireAggregateMutationLock(lockKey);

      if (!mutationToken) {
        return;
      }

      try {
        setAcertosActionLoading(actionKey);
        setAcertosError('');
        setAcertosInfo('');

        await acertoActionRequests[action](
          currentPlanejamentoId,
          acerto.id,
        );

        if (
          !hasCurrentMutationCapability(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
            (capabilities) =>
              capabilities.canPerformSettlementAction(acerto, action),
          )
        ) {
          return;
        }

        const dataApplied = await refreshFinancialData(
          currentPlanejamentoId,
        );

        if (
          isCurrentMutationContext(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
          ) &&
          dataApplied
        ) {
          setAcertosInfo('Acerto atualizado com sucesso.');
        }
      } catch (error) {
        await reportMutationError(
          error,
          'Nao foi possivel atualizar o acerto.',
          currentPlanejamentoId,
          mutationToken.contextGeneration,
          setAcertosError,
        );
      } finally {
        if (
          isCurrentMutationContext(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
          )
        ) {
          setAcertosActionLoading(null);
        }
        releaseAggregateMutationLock(mutationToken);
      }
    },
    [
      acquireAggregateMutationLock,
      hasCurrentMutationCapability,
      isCurrentMutationContext,
      planejamentoId,
      refreshFinancialData,
      releaseAggregateMutationLock,
      reportMutationError,
    ],
  );

  const handleCancelGasto = useCallback(
    async (gasto: GastoPlanejamento) => {
      const currentPlanejamentoId = planejamentoId;
      const currentGeneration = mutationContextRef.current.generation;
      const lockKey = `gasto:cancel:${gasto.id}`;

      if (
        !currentPlanejamentoId ||
        !hasCurrentMutationCapability(
          currentPlanejamentoId,
          currentGeneration,
          (capabilities) => capabilities.canCancelExpense(gasto),
        )
      ) {
        return;
      }

      const mutationToken = acquireAggregateMutationLock(lockKey);

      if (!mutationToken) {
        return;
      }

      let cancelamentoConcluido = false;

      try {
        setGastoActionLoading(gasto.id);
        setGastosError('');
        setGastosInfo('');

        const confirmed = await confirmAction(
          'Cancelar gasto',
          `Deseja cancelar o gasto "${gasto.descricao}"? Ele permanecera visivel no historico.`,
        );

        if (
          !confirmed ||
          !hasCurrentMutationCapability(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
            (capabilities) => capabilities.canCancelExpense(gasto),
          )
        ) {
          return;
        }

        await cancelGastoPlanejamento(currentPlanejamentoId, gasto.id);
        cancelamentoConcluido = true;

        if (
          !hasCurrentMutationCapability(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
            (capabilities) => capabilities.canCancelExpense(gasto),
          )
        ) {
          return;
        }

        const dataApplied = await refreshExpenseFinancialData(
          currentPlanejamentoId,
        );

        if (
          isCurrentMutationContext(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
          ) &&
          dataApplied
        ) {
          setGastosInfo('Gasto cancelado com sucesso.');
        }
      } catch (error) {
        await reportMutationError(
          error,
          cancelamentoConcluido
            ? 'O gasto foi cancelado, mas nao foi possivel recarregar os dados financeiros.'
            : 'Nao foi possivel cancelar o gasto.',
          currentPlanejamentoId,
          mutationToken.contextGeneration,
          setGastosError,
        );
      } finally {
        if (
          isCurrentMutationContext(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
          )
        ) {
          setGastoActionLoading(null);
        }
        releaseAggregateMutationLock(mutationToken);
      }
    },
    [
      acquireAggregateMutationLock,
      hasCurrentMutationCapability,
      isCurrentMutationContext,
      planejamentoId,
      refreshExpenseFinancialData,
      releaseAggregateMutationLock,
      reportMutationError,
    ],
  );

  const handleRemoveParticipante = useCallback(
    async (participante: ParticipantePlanejamento) => {
      const currentPlanejamentoId = planejamentoId;
      const currentGeneration = mutationContextRef.current.generation;
      const lockKey = `participante:remove:${participante.id}`;

      if (
        !currentPlanejamentoId ||
        !hasCurrentMutationCapability(
          currentPlanejamentoId,
          currentGeneration,
          (capabilities) =>
            capabilities.canRemoveParticipant(participante),
        )
      ) {
        return;
      }

      const mutationToken = acquireAggregateMutationLock(lockKey);

      if (!mutationToken) {
        return;
      }

      let remocaoConcluida = false;

      try {
        setParticipanteActionLoading(participante.id);
        setParticipantesError('');
        setParticipantesInfo('');

        const confirmed = await confirmAction(
          'Remover participante',
          `Deseja remover "${participante.nome}" deste planejamento? O participante não poderá ser utilizado em novos gastos ou divisões, mas continuará visível no histórico financeiro.`,
        );

        if (
          !confirmed ||
          !hasCurrentMutationCapability(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
            (capabilities) =>
              capabilities.canRemoveParticipant(participante),
          )
        ) {
          return;
        }

        const participanteRemovido = await removeParticipantePlanejamento(
          currentPlanejamentoId,
          participante.id,
        );
        remocaoConcluida = true;

        if (
          !hasCurrentMutationCapability(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
            (capabilities) =>
              capabilities.canRemoveParticipant(participante),
          )
        ) {
          return;
        }

        applyParticipantUpdate(participanteRemovido);
        const dataApplied = await reloadAllData(currentPlanejamentoId);

        if (
          isCurrentMutationContext(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
          ) &&
          dataApplied
        ) {
          setParticipantesInfo('Participante removido com sucesso.');
        }
      } catch (error) {
        await reportMutationError(
          error,
          remocaoConcluida
            ? 'O participante foi removido, mas não foi possível recarregar os dados do planejamento.'
            : 'Não foi possível remover o participante.',
          currentPlanejamentoId,
          mutationToken.contextGeneration,
          setParticipantesError,
        );
      } finally {
        if (
          isCurrentMutationContext(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
          )
        ) {
          setParticipanteActionLoading(null);
        }
        releaseAggregateMutationLock(mutationToken);
      }
    },
    [
      acquireAggregateMutationLock,
      applyParticipantUpdate,
      hasCurrentMutationCapability,
      isCurrentMutationContext,
      planejamentoId,
      reloadAllData,
      releaseAggregateMutationLock,
      reportMutationError,
    ],
  );

  const handleTransition = useCallback(
    async (transition: PlanejamentoTransition) => {
      const currentPlanejamentoId = planejamentoId;
      const currentGeneration = mutationContextRef.current.generation;
      const lockKey = `transition:${transition}`;

      if (
        !currentPlanejamentoId ||
        !hasCurrentMutationCapability(
          currentPlanejamentoId,
          currentGeneration,
          (capabilities) => capabilities.canPerformTransition(transition),
        ) ||
        transitionLockRef.current
      ) {
        return;
      }

      const mutationToken = acquireAggregateMutationLock(lockKey);

      if (!mutationToken) {
        return;
      }

      transitionLockRef.current = transition;
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

        if (
          !confirmed ||
          !hasCurrentMutationCapability(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
            (capabilities) => capabilities.canPerformTransition(transition),
          )
        ) {
          return;
        }

        await config.request(currentPlanejamentoId);
        transitionCompleted = true;

        if (
          !hasCurrentMutationCapability(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
            (capabilities) => capabilities.canPerformTransition(transition),
          )
        ) {
          return;
        }

        const dataApplied = await reloadAllData(currentPlanejamentoId);

        if (
          isCurrentMutationContext(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
          ) &&
          dataApplied
        ) {
          setTransitionInfo(config.successMessage);
        }
      } catch (error) {
        await reportMutationError(
          error,
          transitionCompleted
            ? 'O status foi atualizado, mas nao foi possivel recarregar o planejamento.'
            : config.errorMessage,
          currentPlanejamentoId,
          mutationToken.contextGeneration,
          setTransitionError,
        );
      } finally {
        if (
          isCurrentMutationContext(
            currentPlanejamentoId,
            mutationToken.contextGeneration,
          )
        ) {
          setTransitionLoading(null);
        }
        if (transitionLockRef.current === transition) {
          transitionLockRef.current = null;
        }
        releaseAggregateMutationLock(mutationToken);
      }
    },
    [
      acquireAggregateMutationLock,
      hasCurrentMutationCapability,
      isCurrentMutationContext,
      planejamentoId,
      reloadAllData,
      releaseAggregateMutationLock,
      reportMutationError,
    ],
  );

  return {
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
  };
}
