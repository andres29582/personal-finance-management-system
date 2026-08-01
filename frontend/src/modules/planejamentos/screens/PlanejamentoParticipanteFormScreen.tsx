import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getUser } from '../../../../storage/authStorage';
import { resolveApiError } from '../../../../utils/api-error';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassField,
  GlassPanel,
  GlassStatusCard,
  GlassTextInput,
} from '../../../shared/ui';
import {
  canAddPlanejamentoParticipant,
  isPlanejamentoOwner,
} from '../authorization/planejamentoAuthorization';
import {
  addParticipantePlanejamento,
  getPlanejamentoById,
} from '../services/planejamentoService';
import type { Planejamento } from '../types/planejamento';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthorizationLoad = {
  errorMessage: string;
  generation: number;
  planejamento: Planejamento | null;
  sessionExpired: boolean;
  usuarioAutenticadoId: string | null;
};

type FeedbackState = {
  generation: number;
  message: string;
};

type RouteContext = {
  generation: number;
  planejamentoId?: string;
};

type SaveToken = {
  generation: number;
  planejamentoId: string;
};

function isValidEmail(value: string) {
  return !value || emailPattern.test(value);
}

function normalizeRouteId(value: string | string[] | undefined) {
  const routeValue = Array.isArray(value) ? value[0] : value;
  return routeValue?.trim() || undefined;
}

function getAuthorizationMessage(
  planejamentoId: string | undefined,
  authorization: AuthorizationLoad | null,
) {
  if (!planejamentoId) {
    return 'Planejamento nao informado.';
  }

  if (!authorization) {
    return '';
  }

  if (authorization.errorMessage) {
    return authorization.errorMessage;
  }

  if (
    !isPlanejamentoOwner(
      authorization.planejamento,
      authorization.usuarioAutenticadoId,
    )
  ) {
    return 'Apenas o proprietario pode adicionar participantes.';
  }

  if (authorization.planejamento?.status !== 'ABERTO') {
    return 'Apenas planejamentos abertos permitem adicionar participantes.';
  }

  return '';
}

export function PlanejamentoParticipanteFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const planejamentoId = normalizeRouteId(params.id);
  const [authorizationLoad, setAuthorizationLoad] =
    useState<AuthorizationLoad | null>(null);
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [nome, setNome] = useState('');
  const [savingToken, setSavingToken] = useState<SaveToken | null>(null);
  const authorizationLoadRef = useRef<AuthorizationLoad | null>(null);
  const mountedRef = useRef(true);
  const routeContextRef = useRef<RouteContext>({
    generation: 0,
    planejamentoId,
  });
  const savingLockRef = useRef<SaveToken | null>(null);

  if (routeContextRef.current.planejamentoId !== planejamentoId) {
    routeContextRef.current = {
      generation: routeContextRef.current.generation + 1,
      planejamentoId,
    };
  }

  const currentGeneration = routeContextRef.current.generation;
  const currentAuthorization =
    authorizationLoad?.generation === currentGeneration
      ? authorizationLoad
      : null;
  const currentFeedback =
    feedback?.generation === currentGeneration ? feedback.message : '';
  const authorizationLoading = !!planejamentoId && !currentAuthorization;
  const canAddParticipant = canAddPlanejamentoParticipant(
    currentAuthorization?.planejamento,
    currentAuthorization?.usuarioAutenticadoId,
  );
  const authorizationMessage = getAuthorizationMessage(
    planejamentoId,
    currentAuthorization,
  );
  const isSaving =
    savingToken?.generation === currentGeneration &&
    savingToken.planejamentoId === planejamentoId;

  authorizationLoadRef.current = currentAuthorization;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      routeContextRef.current.generation += 1;
    };
  }, []);

  useEffect(() => {
    const expectedGeneration = routeContextRef.current.generation;
    const expectedPlanejamentoId = planejamentoId;
    let active = true;

    setAuthorizationLoad(null);
    setEmail('');
    setFeedback({ generation: expectedGeneration, message: '' });
    setNome('');
    setSavingToken(null);

    if (!expectedPlanejamentoId) {
      return () => {
        active = false;
      };
    }

    const isCurrentLoad = () =>
      active &&
      mountedRef.current &&
      routeContextRef.current.generation === expectedGeneration &&
      routeContextRef.current.planejamentoId === expectedPlanejamentoId;

    async function loadAuthorization(currentPlanejamentoId: string) {
      try {
        const [usuarioAutenticado, planejamento] = await Promise.all([
          getUser(),
          getPlanejamentoById(currentPlanejamentoId),
        ]);

        if (!isCurrentLoad()) {
          return;
        }

        if (!usuarioAutenticado?.id) {
          setAuthorizationLoad({
            errorMessage: 'Sessao expirada. Faca login novamente.',
            generation: expectedGeneration,
            planejamento: null,
            sessionExpired: true,
            usuarioAutenticadoId: null,
          });
          router.replace('/login');
          return;
        }

        setAuthorizationLoad({
          errorMessage: '',
          generation: expectedGeneration,
          planejamento,
          sessionExpired: false,
          usuarioAutenticadoId: usuarioAutenticado.id,
        });
      } catch (error) {
        if (!isCurrentLoad()) {
          return;
        }

        const resolvedError = await resolveApiError(
          error,
          'Planejamento inexistente ou inacessivel.',
        );

        if (!isCurrentLoad()) {
          return;
        }

        setAuthorizationLoad({
          errorMessage: resolvedError.message,
          generation: expectedGeneration,
          planejamento: null,
          sessionExpired: resolvedError.unauthorized,
          usuarioAutenticadoId: null,
        });

        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      }
    }

    void loadAuthorization(expectedPlanejamentoId);

    return () => {
      active = false;
    };
  }, [planejamentoId, router]);

  function isCurrentSaveContext(token: SaveToken) {
    const authorization = authorizationLoadRef.current;

    return (
      mountedRef.current &&
      routeContextRef.current.generation === token.generation &&
      routeContextRef.current.planejamentoId === token.planejamentoId &&
      authorization?.generation === token.generation &&
      canAddPlanejamentoParticipant(
        authorization.planejamento,
        authorization.usuarioAutenticadoId,
      )
    );
  }

  function goBackToDetail(expectedPlanejamentoId = planejamentoId) {
    if (expectedPlanejamentoId) {
      router.replace({
        pathname: '/planejamentos-detail',
        params: { id: expectedPlanejamentoId },
      } as never);
      return;
    }

    router.push('/planejamentos' as never);
  }

  async function handleSave() {
    const context = routeContextRef.current;
    const authorization = authorizationLoadRef.current;
    const currentPlanejamentoId = context.planejamentoId;
    const trimmedNome = nome.trim();
    const trimmedEmail = email.trim();

    if (!currentPlanejamentoId) {
      setFeedback({
        generation: context.generation,
        message: 'Planejamento nao informado.',
      });
      return;
    }

    if (
      !authorization ||
      authorization.generation !== context.generation ||
      !canAddPlanejamentoParticipant(
        authorization.planejamento,
        authorization.usuarioAutenticadoId,
      )
    ) {
      setFeedback({
        generation: context.generation,
        message:
          getAuthorizationMessage(currentPlanejamentoId, authorization) ||
          'Nao foi possivel verificar sua permissao para adicionar participantes.',
      });
      return;
    }

    if (savingLockRef.current?.generation === context.generation) {
      return;
    }

    if (!trimmedNome) {
      setFeedback({
        generation: context.generation,
        message: 'Informe o nome do participante.',
      });
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setFeedback({
        generation: context.generation,
        message: 'Informe um email valido.',
      });
      return;
    }

    const token = {
      generation: context.generation,
      planejamentoId: currentPlanejamentoId,
    };
    savingLockRef.current = token;
    setSavingToken(token);
    setFeedback({ generation: token.generation, message: '' });

    try {
      await addParticipantePlanejamento(token.planejamentoId, {
        nome: trimmedNome,
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
      });

      if (isCurrentSaveContext(token)) {
        goBackToDetail(token.planejamentoId);
      }
    } catch (error) {
      if (!isCurrentSaveContext(token)) {
        return;
      }

      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel adicionar o participante.',
      );

      if (!isCurrentSaveContext(token)) {
        return;
      }

      setFeedback({
        generation: token.generation,
        message: resolvedError.message,
      });

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (savingLockRef.current === token) {
        savingLockRef.current = null;
      }

      if (
        mountedRef.current &&
        routeContextRef.current.generation === token.generation &&
        routeContextRef.current.planejamentoId === token.planejamentoId
      ) {
        setSavingToken(null);
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
              onPress={() => goBackToDetail()}
              variant="ghost"
            />
          }
          eyebrow="Planejamento compartilhado"
          subtitle="Adicione uma pessoa ao planejamento."
          title="Adicionar participante"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      {authorizationLoading ? (
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>Carregando autorizacao...</Text>
          </View>
        </GlassPanel>
      ) : null}

      {!authorizationLoading && !canAddParticipant ? (
        <GlassStatusCard
          description={authorizationMessage}
          title={
            currentAuthorization?.sessionExpired
              ? 'Sessao expirada'
              : currentAuthorization?.errorMessage
                ? 'Planejamento indisponivel'
                : currentAuthorization &&
                    !isPlanejamentoOwner(
                      currentAuthorization.planejamento,
                      currentAuthorization.usuarioAutenticadoId,
                    )
                  ? 'Acao nao permitida'
                  : 'Formulario indisponivel'
          }
          tone="muted"
        />
      ) : null}

      {!authorizationLoading && canAddParticipant ? (
        <GlassPanel>
          <GlassField label="Nome">
            <GlassTextInput
              editable={!isSaving}
              maxLength={150}
              onChangeText={setNome}
              placeholder="Nome do participante"
              value={nome}
            />
          </GlassField>

          <GlassField label="Email">
            <GlassTextInput
              autoCapitalize="none"
              editable={!isSaving}
              keyboardType="email-address"
              maxLength={150}
              onChangeText={setEmail}
              placeholder="email@exemplo.com"
              value={email}
            />
          </GlassField>

          {currentFeedback ? (
            <Text style={styles.errorMessage}>{currentFeedback}</Text>
          ) : null}

          <GlassButton
            disabled={isSaving}
            label={isSaving ? 'Salvando...' : 'Salvar participante'}
            onPress={() => void handleSave()}
          />
        </GlassPanel>
      ) : null}
    </FinanceAppShell>
  );
}

export default PlanejamentoParticipanteFormScreen;

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
});
