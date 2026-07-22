import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import {
  createGastoPlanejamento,
  getGastoPlanejamentoById,
  getPlanejamentoById,
  updateGastoPlanejamento,
} from '../services/planejamentoService';
import {
  GastoPlanejamentoComportamento,
  ParticipantePlanejamento,
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

export function PlanejamentoGastoFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    gastoId?: string | string[];
    id?: string | string[];
  }>();
  const planejamentoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const gastoId = Array.isArray(params.gastoId)
    ? params.gastoId[0]
    : params.gastoId;
  const isEditing = !!gastoId;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canMutate, setCanMutate] = useState(false);
  const [message, setMessage] = useState(
    planejamentoId ? '' : 'Planejamento nao informado.',
  );
  const savingLockRef = useRef(false);

  useEffect(() => {
    async function loadPlanejamento() {
      if (!planejamentoId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setCanMutate(false);
        setMessage('');
        const [planejamento, gasto] = await Promise.all([
          getPlanejamentoById(planejamentoId),
          gastoId
            ? getGastoPlanejamentoById(planejamentoId, gastoId)
            : Promise.resolve(null),
        ]);
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

        const planejamentoAberto = planejamento.status === 'ABERTO';
        const gastoAtivo = !gasto || gasto.status === 'ATIVO';
        setCanMutate(planejamentoAberto && gastoAtivo);

        if (!planejamentoAberto) {
          setMessage(
            'Apenas planejamentos abertos permitem criar ou editar gastos.',
          );
        } else if (!gastoAtivo) {
          setMessage('Apenas gastos ativos podem ser editados.');
        } else if (!pagadores.length || !participantesDivisao.length) {
          setMessage(
            `Adicione ao menos um participante antes de ${
              isEditing ? 'editar' : 'criar'
            } um gasto.`,
          );
        }
      } catch (error) {
        const resolvedError = await resolveApiError(
          error,
          'Nao foi possivel carregar o formulario de gasto.',
        );
        setMessage(resolvedError.message);

        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    }

    void loadPlanejamento();
  }, [gastoId, isEditing, planejamentoId, router]);

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
    if (!planejamentoId) {
      router.push('/planejamentos' as never);
      return;
    }

    router.push({
      pathname: '/planejamentos-participante-form',
      params: { id: planejamentoId },
    } as never);
  }

  async function handleSave() {
    if (savingLockRef.current) {
      return;
    }

    const trimmedDescricao = descricao.trim();
    const parsedValor = parseDecimalInput(valor);
    const valorCentavos = toCentavos(parsedValor);
    const normalizedDataGasto = dataGasto.trim();
    const trimmedCategoria = categoria.trim();
    const trimmedObservacao = observacao.trim();
    const trimmedMesReferencia = mesReferencia.trim();

    if (!planejamentoId) {
      setMessage('Planejamento nao informado.');
      return;
    }

    if (!canMutate) {
      setMessage(
        isEditing
          ? 'Este gasto nao pode ser editado no estado atual.'
          : 'Este planejamento nao permite criar gastos no estado atual.',
      );
      return;
    }

    if (
      !pagadoresDisponiveis.length ||
      !participantesDivisaoDisponiveis.length
    ) {
      setMessage(
        `Adicione ao menos um participante antes de ${
          isEditing ? 'editar' : 'criar'
        } um gasto.`,
      );
      return;
    }

    if (!trimmedDescricao) {
      setMessage('Informe a descricao do gasto.');
      return;
    }

    if (!Number.isFinite(parsedValor)) {
      setMessage('Informe um valor valido. Ex.: 150,90');
      return;
    }

    if (valorCentavos <= 0) {
      setMessage('O valor deve ser maior que zero.');
      return;
    }

    if (!isValidIsoDate(normalizedDataGasto)) {
      setMessage('Informe uma data valida no formato YYYY-MM-DD. Ex.: 2026-04-07');
      return;
    }

    if (!comportamento) {
      setMessage('Selecione o comportamento do gasto.');
      return;
    }

    if (!pagoPorParticipanteId) {
      setMessage('Selecione quem pagou o gasto.');
      return;
    }

    if (!participantesIds.length) {
      setMessage('Selecione ao menos um participante para dividir o gasto.');
      return;
    }

    if (
      trimmedMesReferencia &&
      !MONTH_REFERENCE_PATTERN.test(trimmedMesReferencia)
    ) {
      setMessage('Informe o mes de referencia no formato YYYY-MM.');
      return;
    }

    try {
      savingLockRef.current = true;
      setSaving(true);
      setMessage('');

      const commonData = {
        comportamento,
        dataGasto: normalizedDataGasto,
        descricao: trimmedDescricao,
        pagoPorParticipanteId,
        participantesIds,
        valorCentavos,
      };

      if (isEditing && gastoId) {
        await updateGastoPlanejamento(planejamentoId, gastoId, {
          ...commonData,
          categoria: trimmedCategoria || null,
          mesReferencia: trimmedMesReferencia || null,
          observacao: trimmedObservacao || null,
        });
      } else {
        await createGastoPlanejamento(planejamentoId, {
          ...commonData,
          ...(trimmedCategoria ? { categoria: trimmedCategoria } : {}),
          ...(trimmedObservacao ? { observacao: trimmedObservacao } : {}),
          ...(trimmedMesReferencia
            ? { mesReferencia: trimmedMesReferencia }
            : {}),
        });
      }

      goBackToDetail();
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        isEditing
          ? 'Nao foi possivel atualizar o gasto.'
          : 'Nao foi possivel criar o gasto.',
      );
      setMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      savingLockRef.current = false;
      setSaving(false);
    }
  }

  const formDisabled = saving || !canMutate;
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
      {loading ? (
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>
              {isEditing ? 'Carregando gasto...' : 'Carregando participantes...'}
            </Text>
          </View>
        </GlassPanel>
      ) : null}

      {!loading && !hasParticipantOptions ? (
        <GlassStatusCard
          actionLabel={canMutate ? 'Adicionar participante' : undefined}
          description={
            message ||
            `Adicione ao menos um participante antes de ${
              isEditing ? 'editar' : 'criar'
            } um gasto.`
          }
          onActionPress={canMutate ? goToParticipantForm : undefined}
          title="Nenhum participante disponivel"
          tone="muted"
        />
      ) : null}

      {!loading && hasParticipantOptions ? (
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

          {message ? <Text style={styles.errorMessage}>{message}</Text> : null}

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
