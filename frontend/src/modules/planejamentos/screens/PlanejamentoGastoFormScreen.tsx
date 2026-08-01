import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassField,
  GlassOptionGroup,
  GlassPanel,
  GlassStatusCard,
  GlassTextInput,
} from '../../../shared/ui';
import { resolveApiError } from '../../../../utils/api-error';
import { parseDecimalInput } from '../../../../utils/number-input';
import { getUser } from '../../../../storage/authStorage';
import {
  canAddPlanejamentoParticipant,
  canCreatePlanejamentoExpense,
  canEditPlanejamentoExpense,
} from '../authorization/planejamentoAuthorization';
import {
  createGastoPlanejamento,
  getGastoPlanejamentoById,
  getPlanejamentoById,
  updateGastoPlanejamento,
} from '../services/planejamentoService';
import {
  GastoPlanejamento,
  GastoPlanejamentoComportamento,
  ParticipantePlanejamento,
  Planejamento,
} from '../types/planejamento';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_REFERENCE_PATTERN = /^\d{4}-\d{2}$/;

const comportamentoOptions: {
  label: string;
  value: GastoPlanejamentoComportamento;
}[] = [
  { label: 'Eventual', value: 'EVENTUAL' },
  { label: 'Fixo', value: 'FIXO' },
  { label: 'Variavel', value: 'VARIAVEL' },
];

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const normalizedDate = new Date(Date.UTC(year, month - 1, day))
    .toISOString()
    .slice(0, 10);

  return normalizedDate === value;
}

function toCentavos(value: number) {
  return Math.round(value * 100);
}

function formatCentavosInput(value: number) {
  return (value / 100).toFixed(2).replace('.', ',');
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id)
    ? ids.filter((selectedId) => selectedId !== id)
    : [...ids, id];
}

function normalizeRouteParam(value?: string | string[]) {
  const normalizedValue = (Array.isArray(value) ? value[0] : value)?.trim();

  return normalizedValue || undefined;
}

type ExpenseFormRouteContext = {
  gastoId?: string;
  generation: number;
  key: string;
  planejamentoId?: string;
};

type LoadedExpenseFormContext = {
  canAddParticipant: boolean;
  gasto: GastoPlanejamento | null;
  planejamento: Planejamento;
  route: ExpenseFormRouteContext;
  usuarioAutenticadoId: string | null;
};

type ExpenseFormAccessKind =
  | 'authorized'
  | 'blocked-role'
  | 'blocked-status'
  | 'inactive-expense'
  | 'loading'
  | 'missing-id'
  | 'missing-participants'
  | 'session-expired'
  | 'unavailable';

type ExpenseFormAccessState = {
  context: LoadedExpenseFormContext | null;
  kind: ExpenseFormAccessKind;
  message: string;
  route: ExpenseFormRouteContext;
};

type ExpenseFormFeedback = {
  message: string;
  route: ExpenseFormRouteContext;
};

type ExpenseSavingToken = {
  route: ExpenseFormRouteContext;
};

export function PlanejamentoGastoFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    gastoId?: string | string[];
    id?: string | string[];
  }>();
  const planejamentoId = normalizeRouteParam(params.id);
  const gastoId = normalizeRouteParam(params.gastoId);
  const isEditing = !!gastoId;
  const routeKey = JSON.stringify([planejamentoId ?? null, gastoId ?? null]);
  const routeContextRef = useRef<ExpenseFormRouteContext>({
    gastoId,
    generation: 0,
    key: routeKey,
    planejamentoId,
  });

  if (routeContextRef.current.key !== routeKey) {
    routeContextRef.current = {
      gastoId,
      generation: routeContextRef.current.generation + 1,
      key: routeKey,
      planejamentoId,
    };
  }

  const currentRoute = routeContextRef.current;
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataGasto, setDataGasto] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [comportamento, setComportamento] =
    useState<GastoPlanejamentoComportamento>('EVENTUAL');
  const [pagoPorParticipanteId, setPagoPorParticipanteId] = useState('');
  const [participantesIds, setParticipantesIds] = useState<string[]>([]);
  const [categoria, setCategoria] = useState('');
  const [observacao, setObservacao] = useState('');
  const [mesReferencia, setMesReferencia] = useState('');
  const [pagadoresDisponiveis, setPagadoresDisponiveis] = useState<
    ParticipantePlanejamento[]
  >([]);
  const [
    participantesDivisaoDisponiveis,
    setParticipantesDivisaoDisponiveis,
  ] = useState<ParticipantePlanejamento[]>([]);
  const [accessState, setAccessState] = useState<ExpenseFormAccessState>({
    context: null,
    kind: planejamentoId ? 'loading' : 'missing-id',
    message: planejamentoId ? '' : 'Planejamento nao informado.',
    route: currentRoute,
  });
  const [feedback, setFeedback] = useState<ExpenseFormFeedback>({
    message: '',
    route: currentRoute,
  });
  const [savingToken, setSavingToken] = useState<ExpenseSavingToken | null>(null);
  const loadGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const savingLockRef = useRef<ExpenseSavingToken | null>(null);

  const isCurrentRouteContext = useCallback(
    (expectedRoute: ExpenseFormRouteContext) =>
      mountedRef.current &&
      routeContextRef.current.generation === expectedRoute.generation &&
      routeContextRef.current.key === expectedRoute.key,
    [],
  );

  const isCurrentLoad = useCallback(
    (expectedRoute: ExpenseFormRouteContext, expectedLoadGeneration: number) =>
      isCurrentRouteContext(expectedRoute) &&
      loadGenerationRef.current === expectedLoadGeneration,
    [isCurrentRouteContext],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      loadGenerationRef.current += 1;
      routeContextRef.current = {
        ...routeContextRef.current,
        generation: routeContextRef.current.generation + 1,
      };
      savingLockRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const expectedRoute = routeContextRef.current;
    const loadGeneration = ++loadGenerationRef.current;

    const updateAccessState = (
      kind: ExpenseFormAccessKind,
      message: string,
      context: LoadedExpenseFormContext | null = null,
    ) => {
      if (active && isCurrentLoad(expectedRoute, loadGeneration)) {
        setAccessState({ context, kind, message, route: expectedRoute });
      }
    };

    setAccessState({
      context: null,
      kind: planejamentoId ? 'loading' : 'missing-id',
      message: planejamentoId ? '' : 'Planejamento nao informado.',
      route: expectedRoute,
    });
    setFeedback({ message: '', route: expectedRoute });
    setPagadoresDisponiveis([]);
    setParticipantesDivisaoDisponiveis([]);
    setDescricao('');
    setValor('');
    setDataGasto(new Date().toISOString().slice(0, 10));
    setComportamento('EVENTUAL');
    setPagoPorParticipanteId('');
    setParticipantesIds([]);
    setCategoria('');
    setObservacao('');
    setMesReferencia('');

    async function loadPlanejamento() {
      if (!planejamentoId) {
        return;
      }

      try {
        const [usuarioAutenticado, planejamento, gasto] = await Promise.all([
          getUser(),
          getPlanejamentoById(planejamentoId),
          gastoId
            ? getGastoPlanejamentoById(planejamentoId, gastoId)
            : Promise.resolve(null),
        ]);

        if (!active || !isCurrentLoad(expectedRoute, loadGeneration)) {
          return;
        }

        if (!usuarioAutenticado?.id) {
          updateAccessState(
            'session-expired',
            'Sessao expirada. Faca login novamente.',
          );
          router.replace('/login');
          return;
        }

        if (gastoId && !gasto) {
          updateAccessState(
            'unavailable',
            'Gasto inexistente ou inacessivel.',
          );
          return;
        }

        const participantesDivisaoIds =
          gasto?.divisoes
            ?.filter((divisao) => divisao.status === 'ATIVA')
            .map((divisao) => divisao.participanteId) ?? [];
        const participantesPlanejamento = planejamento.participantes ?? [];
        const pagadores = participantesPlanejamento.filter(
          (participante) =>
            participante.status === 'ATIVO' ||
            participante.id === gasto?.pagoPorParticipanteId,
        );
        const participantesDivisao = participantesPlanejamento.filter(
          (participante) =>
            participante.status === 'ATIVO' ||
            participantesDivisaoIds.includes(participante.id),
        );
        setPagadoresDisponiveis(pagadores);
        setParticipantesDivisaoDisponiveis(participantesDivisao);

        if (gasto) {
          setDescricao(gasto.descricao);
          setValor(formatCentavosInput(gasto.valorCentavos));
          setDataGasto(gasto.dataGasto.slice(0, 10));
          setComportamento(gasto.comportamento);
          setPagoPorParticipanteId(gasto.pagoPorParticipanteId);
          setParticipantesIds(participantesDivisaoIds);
          setCategoria(gasto.categoria ?? '');
          setObservacao(gasto.observacao ?? '');
          setMesReferencia(gasto.mesReferencia ?? '');
        }

        const usuarioAutenticadoId = usuarioAutenticado.id;
        const loadedContext: LoadedExpenseFormContext = {
          canAddParticipant: canAddPlanejamentoParticipant(
            planejamento,
            usuarioAutenticadoId,
          ),
          gasto,
          planejamento,
          route: expectedRoute,
          usuarioAutenticadoId,
        };

        if (planejamento.status !== 'ABERTO') {
          updateAccessState(
            'blocked-status',
            'Apenas planejamentos abertos permitem criar ou editar gastos.',
            loadedContext,
          );
          return;
        }

        if (gasto && gasto.status !== 'ATIVO') {
          updateAccessState(
            'inactive-expense',
            'Apenas gastos ativos podem ser editados.',
            loadedContext,
          );
          return;
        }

        const canMutate = gasto
          ? canEditPlanejamentoExpense(
              planejamento,
              gasto,
              usuarioAutenticadoId,
            )
          : canCreatePlanejamentoExpense(
              planejamento,
              usuarioAutenticadoId,
            );

        if (!canMutate) {
          updateAccessState(
            'blocked-role',
            gasto
              ? 'Somente o proprietario pode editar gastos deste planejamento.'
              : 'Voce nao possui permissao para criar gastos neste planejamento.',
            loadedContext,
          );
          return;
        }

        if (!pagadores.length || !participantesDivisao.length) {
          updateAccessState(
            'missing-participants',
            `Adicione ao menos um participante antes de ${
              gasto ? 'editar' : 'criar'
            } um gasto.`,
            loadedContext,
          );
          return;
        }

        updateAccessState('authorized', '', loadedContext);
      } catch (error) {
        if (!active || !isCurrentLoad(expectedRoute, loadGeneration)) {
          return;
        }

        const resolvedError = await resolveApiError(
          error,
          'Nao foi possivel carregar o formulario de gasto.',
        );

        if (!active || !isCurrentLoad(expectedRoute, loadGeneration)) {
          return;
        }

        if (resolvedError.unauthorized) {
          updateAccessState(
            'session-expired',
            resolvedError.message,
          );
          router.replace('/login');
          return;
        }

        updateAccessState('unavailable', resolvedError.message);
      }
    }

    void loadPlanejamento();

    return () => {
      active = false;
    };
  }, [gastoId, isCurrentLoad, planejamentoId, router]);

  function goBackToDetail() {
    if (planejamentoId) {
      router.replace({
        pathname: '/planejamentos-detail',
        params: { id: planejamentoId },
      } as never);
      return;
    }

    router.push('/planejamentos' as never);
  }

  function goToParticipantForm() {
    if (
      !planejamentoId ||
      accessState.kind !== 'missing-participants' ||
      !accessState.context ||
      !isCurrentRouteContext(accessState.route) ||
      !accessState.context.canAddParticipant ||
      !canAddPlanejamentoParticipant(
        accessState.context.planejamento,
        accessState.context.usuarioAutenticadoId,
      )
    ) {
      return;
    }

    router.push({
      pathname: '/planejamentos-participante-form',
      params: { id: planejamentoId },
    } as never);
  }

  async function handleSave() {
    if (
      accessState.kind !== 'authorized' ||
      !accessState.context ||
      !isCurrentRouteContext(accessState.route)
    ) {
      return;
    }

    const expectedContext = accessState.context;
    const existingLock = savingLockRef.current;

    if (
      existingLock &&
      existingLock.route.generation === expectedContext.route.generation &&
      existingLock.route.key === expectedContext.route.key
    ) {
      return;
    }

    const trimmedDescricao = descricao.trim();
    const parsedValor = parseDecimalInput(valor);
    const valorCentavos = toCentavos(parsedValor);
    const normalizedDataGasto = dataGasto.trim();
    const trimmedCategoria = categoria.trim();
    const trimmedObservacao = observacao.trim();
    const trimmedMesReferencia = mesReferencia.trim();

    const currentCapability = expectedContext.gasto
      ? canEditPlanejamentoExpense(
          expectedContext.planejamento,
          expectedContext.gasto,
          expectedContext.usuarioAutenticadoId,
        )
      : canCreatePlanejamentoExpense(
          expectedContext.planejamento,
          expectedContext.usuarioAutenticadoId,
        );

    if (!currentCapability || !expectedContext.route.planejamentoId) {
      return;
    }

    const setCurrentMessage = (message: string) => {
      if (isCurrentRouteContext(expectedContext.route)) {
        setFeedback({ message, route: expectedContext.route });
      }
    };

    if (
      !pagadoresDisponiveis.length ||
      !participantesDivisaoDisponiveis.length
    ) {
      setCurrentMessage(
        `Adicione ao menos um participante antes de ${
          isEditing ? 'editar' : 'criar'
        } um gasto.`,
      );
      return;
    }

    if (!trimmedDescricao) {
      setCurrentMessage('Informe a descricao do gasto.');
      return;
    }

    if (!Number.isFinite(parsedValor)) {
      setCurrentMessage('Informe um valor valido. Ex.: 150,90');
      return;
    }

    if (valorCentavos <= 0) {
      setCurrentMessage('O valor deve ser maior que zero.');
      return;
    }

    if (!isValidIsoDate(normalizedDataGasto)) {
      setCurrentMessage(
        'Informe uma data valida no formato YYYY-MM-DD. Ex.: 2026-04-07',
      );
      return;
    }

    if (!comportamento) {
      setCurrentMessage('Selecione o comportamento do gasto.');
      return;
    }

    if (!pagoPorParticipanteId) {
      setCurrentMessage('Selecione quem pagou o gasto.');
      return;
    }

    if (!participantesIds.length) {
      setCurrentMessage(
        'Selecione ao menos um participante para dividir o gasto.',
      );
      return;
    }

    if (
      trimmedMesReferencia &&
      !MONTH_REFERENCE_PATTERN.test(trimmedMesReferencia)
    ) {
      setCurrentMessage('Informe o mes de referencia no formato YYYY-MM.');
      return;
    }

    if (
      !isCurrentRouteContext(expectedContext.route) ||
      (expectedContext.gasto
        ? !canEditPlanejamentoExpense(
            expectedContext.planejamento,
            expectedContext.gasto,
            expectedContext.usuarioAutenticadoId,
          )
        : !canCreatePlanejamentoExpense(
            expectedContext.planejamento,
            expectedContext.usuarioAutenticadoId,
          ))
    ) {
      return;
    }

    const savingOperationToken: ExpenseSavingToken = {
      route: expectedContext.route,
    };
    savingLockRef.current = savingOperationToken;

    try {
      setSavingToken(savingOperationToken);
      setFeedback({ message: '', route: expectedContext.route });

      const commonData = {
        comportamento,
        dataGasto: normalizedDataGasto,
        descricao: trimmedDescricao,
        pagoPorParticipanteId,
        participantesIds,
        valorCentavos,
      };

      if (expectedContext.gasto && expectedContext.route.gastoId) {
        await updateGastoPlanejamento(
          expectedContext.route.planejamentoId,
          expectedContext.route.gastoId,
          {
            ...commonData,
            categoria: trimmedCategoria || null,
            mesReferencia: trimmedMesReferencia || null,
            observacao: trimmedObservacao || null,
          },
        );
      } else {
        await createGastoPlanejamento(expectedContext.route.planejamentoId, {
          ...commonData,
          ...(trimmedCategoria ? { categoria: trimmedCategoria } : {}),
          ...(trimmedObservacao ? { observacao: trimmedObservacao } : {}),
          ...(trimmedMesReferencia
            ? { mesReferencia: trimmedMesReferencia }
            : {}),
        });
      }

      if (
        savingLockRef.current === savingOperationToken &&
        isCurrentRouteContext(expectedContext.route)
      ) {
        router.replace({
          pathname: '/planejamentos-detail',
          params: { id: expectedContext.route.planejamentoId },
        } as never);
      }
    } catch (error) {
      if (
        savingLockRef.current !== savingOperationToken ||
        !isCurrentRouteContext(expectedContext.route)
      ) {
        return;
      }

      const resolvedError = await resolveApiError(
        error,
        expectedContext.gasto
          ? 'Nao foi possivel atualizar o gasto.'
          : 'Nao foi possivel criar o gasto.',
      );

      if (
        savingLockRef.current !== savingOperationToken ||
        !isCurrentRouteContext(expectedContext.route)
      ) {
        return;
      }

      setFeedback({
        message: resolvedError.message,
        route: expectedContext.route,
      });

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (savingLockRef.current === savingOperationToken) {
        savingLockRef.current = null;

        if (isCurrentRouteContext(expectedContext.route)) {
          setSavingToken((currentToken) =>
            currentToken === savingOperationToken ? null : currentToken,
          );
        }
      }
    }
  }

  const accessStateIsCurrent =
    accessState.route.generation === currentRoute.generation &&
    accessState.route.key === currentRoute.key;
  const currentAccessState = accessStateIsCurrent ? accessState : null;
  const authorizedContext =
    currentAccessState?.kind === 'authorized'
      ? currentAccessState.context
      : null;
  const saving =
    !!savingToken &&
    savingToken.route.generation === currentRoute.generation &&
    savingToken.route.key === currentRoute.key;
  const formDisabled = saving || !authorizedContext;
  const hasParticipantOptions =
    pagadoresDisponiveis.length > 0 &&
    participantesDivisaoDisponiveis.length > 0;

  return (
    <FinanceAppShell
      activeRoute="/planejamentos"
      header={
        <FinanceAppHeader
          action={
            <GlassButton
              label="Voltar"
              onPress={goBackToDetail}
              variant="ghost"
            />
          }
          eyebrow="Planejamento compartilhado"
          subtitle={
            isEditing
              ? 'Atualize os dados e a divisao desta despesa.'
              : 'Registre uma despesa para dividir entre participantes.'
          }
          title={isEditing ? 'Editar gasto' : 'Adicionar gasto'}
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      {!currentAccessState || currentAccessState.kind === 'loading' ? (
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>
              {isEditing ? 'Carregando gasto...' : 'Carregando participantes...'}
            </Text>
          </View>
        </GlassPanel>
      ) : null}

      {currentAccessState &&
      currentAccessState.kind !== 'loading' &&
      currentAccessState.kind !== 'authorized' ? (
        <GlassStatusCard
          actionLabel={
            currentAccessState.kind === 'missing-participants' &&
            currentAccessState.context?.canAddParticipant
              ? 'Adicionar participante'
              : undefined
          }
          description={currentAccessState.message}
          onActionPress={
            currentAccessState.kind === 'missing-participants' &&
            currentAccessState.context?.canAddParticipant
              ? goToParticipantForm
              : undefined
          }
          title={
            currentAccessState.kind === 'missing-participants'
              ? 'Nenhum participante disponivel'
              : currentAccessState.kind === 'inactive-expense'
                ? 'Gasto indisponivel'
                : currentAccessState.kind === 'session-expired'
                  ? 'Sessao expirada'
                  : currentAccessState.kind === 'blocked-role'
                    ? 'Acao nao permitida'
                    : 'Formulario indisponivel'
          }
          tone="muted"
        />
      ) : null}

      {authorizedContext && hasParticipantOptions ? (
        <GlassPanel>
          <GlassField label="Descricao">
            <GlassTextInput
              editable={!formDisabled}
              maxLength={255}
              onChangeText={setDescricao}
              placeholder="Ex.: Hospedagem"
              value={descricao}
            />
          </GlassField>

          <GlassField label="Valor">
            <GlassTextInput
              editable={!formDisabled}
              keyboardType="decimal-pad"
              onChangeText={setValor}
              placeholder="0,00"
              value={valor}
            />
          </GlassField>

          <GlassField label="Data do gasto (YYYY-MM-DD)">
            <GlassTextInput
              editable={!formDisabled}
              onChangeText={setDataGasto}
              placeholder="2026-04-07"
              value={dataGasto}
            />
          </GlassField>

          <GlassField label="Comportamento">
            <GlassOptionGroup
              onChange={(value) => {
                if (!formDisabled) {
                  setComportamento(value as GastoPlanejamentoComportamento);
                }
              }}
              options={comportamentoOptions}
              value={comportamento}
            />
          </GlassField>

          <GlassField label="Quem pagou">
            <ParticipantSelector
              disabled={formDisabled}
              isOptionDisabled={(participante) =>
                participante.status !== 'ATIVO' &&
                participante.id !== pagoPorParticipanteId
              }
              onPress={setPagoPorParticipanteId}
              participantes={pagadoresDisponiveis}
              selectedIds={pagoPorParticipanteId ? [pagoPorParticipanteId] : []}
              testIdPrefix="payer"
            />
          </GlassField>

          <GlassField label="Dividir entre">
            <ParticipantSelector
              disabled={formDisabled}
              isOptionDisabled={(participante) =>
                participante.status !== 'ATIVO' &&
                !participantesIds.includes(participante.id)
              }
              onPress={(id) => setParticipantesIds((current) => toggleId(current, id))}
              participantes={participantesDivisaoDisponiveis}
              selectedIds={participantesIds}
              testIdPrefix="split"
            />
          </GlassField>

          <GlassField label="Categoria">
            <GlassTextInput
              editable={!formDisabled}
              maxLength={100}
              onChangeText={setCategoria}
              placeholder="Categoria opcional"
              value={categoria}
            />
          </GlassField>

          <GlassField label="Observacao">
            <GlassTextInput
              editable={!formDisabled}
              maxLength={500}
              multiline
              onChangeText={setObservacao}
              placeholder="Detalhes opcionais"
              style={styles.multiline}
              value={observacao}
            />
          </GlassField>

          <GlassField label="Mes de referencia (YYYY-MM)">
            <GlassTextInput
              editable={!formDisabled}
              onChangeText={setMesReferencia}
              placeholder="2026-04"
              value={mesReferencia}
            />
          </GlassField>

          {feedback.route.generation === currentRoute.generation &&
          feedback.route.key === currentRoute.key &&
          feedback.message ? (
            <Text style={styles.errorMessage}>{feedback.message}</Text>
          ) : null}

          <GlassButton
            disabled={formDisabled}
            label={
              saving
                ? 'Salvando...'
                : isEditing
                  ? 'Salvar alteracoes'
                  : 'Salvar gasto'
            }
            onPress={handleSave}
          />
        </GlassPanel>
      ) : null}
    </FinanceAppShell>
  );
}

function ParticipantSelector({
  disabled,
  isOptionDisabled,
  onPress,
  participantes,
  selectedIds,
  testIdPrefix,
}: {
  disabled: boolean;
  isOptionDisabled?: (participante: ParticipantePlanejamento) => boolean;
  onPress: (id: string) => void;
  participantes: ParticipantePlanejamento[];
  selectedIds: string[];
  testIdPrefix: string;
}) {
  return (
    <View style={styles.participantOptions}>
      {participantes.map((participante) => {
        const selected = selectedIds.includes(participante.id);
        const optionDisabled =
          disabled || (isOptionDisabled?.(participante) ?? false);

        return (
          <Pressable
            key={participante.id}
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: selected,
              disabled: optionDisabled,
            }}
            disabled={optionDisabled}
            onPress={() => onPress(participante.id)}
            style={({ pressed }) => [
              styles.participantOption,
              selected ? styles.participantOptionSelected : null,
              optionDisabled ? styles.participantOptionDisabled : null,
              pressed ? styles.pressed : null,
            ]}
            testID={`${testIdPrefix}-${participante.id}`}
          >
            <Text
              style={[
                styles.participantOptionName,
                selected ? styles.participantOptionNameSelected : null,
              ]}
            >
              {participante.nome}
            </Text>
            {participante.email ? (
              <Text style={styles.participantOptionEmail}>
                {participante.email}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default PlanejamentoGastoFormScreen;

const styles = StyleSheet.create({
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: 'center',
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
  multiline: {
    minHeight: 92,
    paddingTop: FinanceTheme.spacing.sm,
    textAlignVertical: 'top',
  },
  participantOption: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flexGrow: 1,
    minWidth: 150,
    padding: FinanceTheme.spacing.sm,
  },
  participantOptionEmail: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.micro,
    marginTop: FinanceTheme.spacing.xxs,
  },
  participantOptionDisabled: {
    opacity: FinanceTheme.opacity.disabled,
  },
  participantOptionName: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
  participantOptionNameSelected: {
    color: FinanceTheme.colors.text,
  },
  participantOptionSelected: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  participantOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.xs,
  },
  pressed: {
    opacity: FinanceTheme.opacity.pressed,
  },
});
