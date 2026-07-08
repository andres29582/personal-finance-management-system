import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
  getPlanejamentoById,
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

function toggleId(ids: string[], id: string) {
  return ids.includes(id)
    ? ids.filter((selectedId) => selectedId !== id)
    : [...ids, id];
}

export function PlanejamentoGastoFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const planejamentoId = Array.isArray(params.id) ? params.id[0] : params.id;
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
  const [participantes, setParticipantes] = useState<
    ParticipantePlanejamento[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(
    planejamentoId ? '' : 'Planejamento nao informado.',
  );

  useEffect(() => {
    async function loadPlanejamento() {
      if (!planejamentoId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setMessage('');
        const planejamento = await getPlanejamentoById(planejamentoId);
        const participantesAtivos = (planejamento.participantes ?? []).filter(
          (participante) => participante.status !== 'REMOVIDO',
        );
        setParticipantes(participantesAtivos);

        if (!participantesAtivos.length) {
          setMessage('Adicione ao menos um participante antes de criar um gasto.');
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
  }, [planejamentoId, router]);

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

    if (!participantes.length) {
      setMessage('Adicione ao menos um participante antes de criar um gasto.');
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
      setSaving(true);
      setMessage('');

      await createGastoPlanejamento(planejamentoId, {
        comportamento,
        dataGasto: normalizedDataGasto,
        descricao: trimmedDescricao,
        pagoPorParticipanteId,
        participantesIds,
        valorCentavos,
        ...(trimmedCategoria ? { categoria: trimmedCategoria } : {}),
        ...(trimmedObservacao ? { observacao: trimmedObservacao } : {}),
        ...(trimmedMesReferencia
          ? { mesReferencia: trimmedMesReferencia }
          : {}),
      });

      goBackToDetail();
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel criar o gasto.',
      );
      setMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setSaving(false);
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
              onPress={goBackToDetail}
              variant="ghost"
            />
          }
          eyebrow="Planejamento compartilhado"
          subtitle="Registre uma despesa para dividir entre participantes."
          title="Adicionar gasto"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      {loading ? (
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>Carregando participantes...</Text>
          </View>
        </GlassPanel>
      ) : null}

      {!loading && !participantes.length ? (
        <GlassStatusCard
          actionLabel="Adicionar participante"
          description={
            message || 'Adicione ao menos um participante antes de criar um gasto.'
          }
          onActionPress={goToParticipantForm}
          title="Nenhum participante disponivel"
          tone="muted"
        />
      ) : null}

      {!loading && participantes.length ? (
        <GlassPanel>
          <GlassField label="Descricao">
            <GlassTextInput
              editable={!saving}
              maxLength={255}
              onChangeText={setDescricao}
              placeholder="Ex.: Hospedagem"
              value={descricao}
            />
          </GlassField>

          <GlassField label="Valor">
            <GlassTextInput
              editable={!saving}
              keyboardType="decimal-pad"
              onChangeText={setValor}
              placeholder="0,00"
              value={valor}
            />
          </GlassField>

          <GlassField label="Data do gasto (YYYY-MM-DD)">
            <GlassTextInput
              editable={!saving}
              onChangeText={setDataGasto}
              placeholder="2026-04-07"
              value={dataGasto}
            />
          </GlassField>

          <GlassField label="Comportamento">
            <GlassOptionGroup
              onChange={(value) =>
                setComportamento(value as GastoPlanejamentoComportamento)
              }
              options={comportamentoOptions}
              value={comportamento}
            />
          </GlassField>

          <GlassField label="Quem pagou">
            <ParticipantSelector
              onPress={setPagoPorParticipanteId}
              participantes={participantes}
              selectedIds={pagoPorParticipanteId ? [pagoPorParticipanteId] : []}
              testIdPrefix="payer"
            />
          </GlassField>

          <GlassField label="Dividir entre">
            <ParticipantSelector
              onPress={(id) => setParticipantesIds((current) => toggleId(current, id))}
              participantes={participantes}
              selectedIds={participantesIds}
              testIdPrefix="split"
            />
          </GlassField>

          <GlassField label="Categoria">
            <GlassTextInput
              editable={!saving}
              maxLength={100}
              onChangeText={setCategoria}
              placeholder="Categoria opcional"
              value={categoria}
            />
          </GlassField>

          <GlassField label="Observacao">
            <GlassTextInput
              editable={!saving}
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
              editable={!saving}
              onChangeText={setMesReferencia}
              placeholder="2026-04"
              value={mesReferencia}
            />
          </GlassField>

          {message ? <Text style={styles.errorMessage}>{message}</Text> : null}

          <GlassButton
            disabled={saving}
            label={saving ? 'Salvando...' : 'Salvar gasto'}
            onPress={handleSave}
          />
        </GlassPanel>
      ) : null}
    </FinanceAppShell>
  );
}

function ParticipantSelector({
  onPress,
  participantes,
  selectedIds,
  testIdPrefix,
}: {
  onPress: (id: string) => void;
  participantes: ParticipantePlanejamento[];
  selectedIds: string[];
  testIdPrefix: string;
}) {
  return (
    <View style={styles.participantOptions}>
      {participantes.map((participante) => {
        const selected = selectedIds.includes(participante.id);

        return (
          <Pressable
            key={participante.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={() => onPress(participante.id)}
            style={({ pressed }) => [
              styles.participantOption,
              selected ? styles.participantOptionSelected : null,
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
