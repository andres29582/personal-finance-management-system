import { useFinancialDraft } from '../../../shared/hooks/useFinancialDraft';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import DateTimePicker, {
} from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { listCategorias } from '../../categorias/services/categoriaService';
import { Categoria } from '../../categorias/types/categoria';
import { listContas } from '../../contas/services/contaService';
import { Conta } from '../../contas/types/conta';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  AppShell,
  FinanceAppHeader,
  GlassButton,
  GlassField,
  GlassOptionGroup,
  GlassPanel,
  GlassTextInput,
} from '../../../shared/ui';
import { resolveApiError } from '../../../../utils/api-error';
import { getLocalDateInputValue } from '../../../../utils/formatters';
import { parseDecimalInput } from '../../../../utils/number-input';
import {
  createTransacao,
  getTransacaoById,
  updateTransacao,
} from '../services/transacaoService';
import {
  prepareTransacaoSubmission,
  validateTransacaoSubmission,
} from '../application/prepareTransacaoSubmission';
import { TipoTransacao } from '../types/transacao';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DISPLAY_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function toDisplayDate(value: string): string {
  if (!ISO_DATE_PATTERN.test(value)) {
    return formatDateInput(value);
  }

  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function formatDateInput(value: string): string {
  if (ISO_DATE_PATTERN.test(value)) {
    return toDisplayDate(value);
  }

  const digits = value.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  return [day, month, year].filter(Boolean).join('/');
}

function toIsoDate(value: string): string | null {
  const match = DISPLAY_DATE_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
}

function getPickerDate(value: string): Date {
  const isoDate = toIsoDate(value);
  if (!isoDate) {
    return new Date();
  }

  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatPickerDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function TransacaoFormScreen() {
  const router = useRouter();
  const { replace } = router;
  const params = useLocalSearchParams<{
    id?: string | string[];
    tipo?: string | string[];
  }>();
  const transacaoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const requestedTipo = Array.isArray(params.tipo) ? params.tipo[0] : params.tipo;
  const initialTipo: TipoTransacao = requestedTipo === 'receita' ? 'receita' : 'despesa';
  const draft = useFinancialDraft('transaction/' + (transacaoId ?? 'new/' + initialTipo), {
    tipo: initialTipo, contaId: '', categoriaId: '', valor: '',
    data: toDisplayDate(getLocalDateInputValue()), descricao: '',
  });
  const { tipo, contaId, categoriaId, valor, data, descricao } = draft.fields;
  const setTipo = (value: TipoTransacao) => draft.setField('tipo', value);
  const setContaId = (value: string) => draft.setField('contaId', value);
  const setCategoriaId = (value: string) => draft.setField('categoriaId', value);
  const setValor = (value: string) => draft.setField('valor', value);
  const setData = (value: string) => draft.setField('data', value);
  const setDescricao = (value: string) => draft.setField('descricao', value);
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        const [contasData, categoriasData] = await Promise.all([
          listContas(),
          listCategorias(),
        ]);
        if (cancelled) return;
        setContas(contasData);
        setCategorias(categoriasData);

        if (transacaoId) {
          const transacao = await getTransacaoById(transacaoId);
          if (cancelled) return;
          draft.hydrate({ tipo: transacao.tipo, contaId: transacao.contaId,
            categoriaId: transacao.categoriaId, valor: String(transacao.valor),
            data: toDisplayDate(transacao.data), descricao: transacao.descricao || '' });
        } else if (contasData[0]) {
          draft.hydrate({ contaId: contasData[0].id });
        }
      } catch (error) {
        const resolvedError = await resolveApiError(
          error,
          'Nao foi possivel carregar o formulario de transacao.',
        );
        setMessage(resolvedError.message);
        if (resolvedError.unauthorized) {
          replace('/login');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => { cancelled = true; };
  }, [replace, transacaoId]);

  const categoriasFiltradas = useMemo(
    () => categorias.filter((categoria) => categoria.tipo === tipo),
    [categorias, tipo],
  );
  const categoriaSelecionada =
    transacaoId || categoriasFiltradas.some((categoria) => categoria.id === categoriaId)
      ? categoriaId
      : (categoriasFiltradas[0]?.id ?? '');

  async function handleSave() {
    const parsedValor = parseDecimalInput(valor);
    const normalizedData = toIsoDate(data);

    const validation = validateTransacaoSubmission({
      contaId,
      categoriaId: categoriaSelecionada,
      tipo,
      parsedValor,
      normalizedData,
      descricao,
    });
    if (!validation.ok) {
      setMessage(validation.message);
      return;
    }

    const submitted = draft.capture();
    try {
      setSaving(true);
      setMessage('');

      const submission = prepareTransacaoSubmission(
        validation.value,
        transacaoId
          ? { operation: 'update', id: transacaoId }
          : { operation: 'create' },
      );
      if (submission.operation === 'update') {
        await updateTransacao(submission.id, submission.payload);
      } else {
        await createTransacao(submission.payload);
      }

      if (!draft.isCurrent(submitted)) return;
      draft.clear(submitted);
      router.replace('/transacoes' as never);
    } catch (error) {
      if (!draft.isCurrent(submitted)) return;
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel salvar a transacao.',
      );
      if (!draft.isCurrent(submitted)) return;
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (draft.isCurrent()) setSaving(false);
    }
  }

  function handleDatePickerChange(event: DateTimePickerEvent, selectedDate?: Date) {
    setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      setData(formatPickerDate(selectedDate));
    }
  }

  return (
    <AppShell
      activeRoute="/transacoes"
      onProfilePress={() => router.push('/usuario' as never)}
      pageHeader={
        <FinanceAppHeader
          action={<GlassButton label="Voltar" onPress={() => { draft.clear(); router.back(); }} variant="ghost" />}
          eyebrow="Movimentacoes"
          subtitle="Registre receitas e despesas com conta e categoria."
          title={transacaoId ? 'Editar transacao' : 'Nova transacao'}
        />
      }
    >
      {loading ? (
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>Carregando transacao...</Text>
          </View>
        </GlassPanel>
      ) : (
        <GlassPanel>
          <GlassField label="Tipo">
            <GlassOptionGroup
              options={[
                { label: 'Despesa', value: 'despesa' },
                { label: 'Receita', value: 'receita' },
              ]}
              value={tipo}
              onChange={(value) => {
                const nextTipo = value as TipoTransacao;
                setTipo(nextTipo);
                if (!transacaoId) {
                  setCategoriaId(categorias.find((categoria) => categoria.tipo === nextTipo)?.id ?? '');
                }
              }}
            />
          </GlassField>

          <GlassField label="Conta">
            <GlassOptionGroup
              options={contas.map((conta) => ({ label: conta.nome, value: conta.id }))}
              value={contaId}
              onChange={setContaId}
            />
          </GlassField>

          <GlassField label="Categoria">
            <GlassOptionGroup
              options={categoriasFiltradas.map((categoria) => ({
                label: categoria.nome,
                value: categoria.id,
              }))}
              value={categoriaSelecionada}
              onChange={setCategoriaId}
            />
          </GlassField>

          <GlassField label="Valor">
            <GlassTextInput
              keyboardType="decimal-pad"
              placeholder="0,00"
              value={valor}
              onChangeText={setValor}
            />
          </GlassField>

          <GlassField label="Data (DD/MM/AAAA)">
            <GlassTextInput
              accessibilityLabel="Data da transacao"
              keyboardType="number-pad"
              maxLength={10}
              placeholder="07/04/2026"
              rightAction={
                Platform.OS === 'web' ? null : (
                  <Pressable
                    accessibilityLabel="Abrir calendario para selecionar a data"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setShowDatePicker(true)}
                    style={styles.calendarButton}
                  >
                    <Text style={styles.calendarButtonText}>Calendario</Text>
                  </Pressable>
                )
              }
              value={data}
              onChangeText={(value) => setData(formatDateInput(value))}
            />
          </GlassField>

          {showDatePicker && Platform.OS !== 'web' ? (
            <DateTimePicker
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
              locale="pt-BR"
              mode="date"
              onChange={handleDatePickerChange}
              value={getPickerDate(data)}
            />
          ) : null}

          <GlassField label="Descricao">
            <GlassTextInput
              multiline
              placeholder="Descricao da transacao"
              style={styles.multiline}
              value={descricao}
              onChangeText={setDescricao}
            />
          </GlassField>

          {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
          <GlassButton
            label={saving ? 'Salvando...' : 'Salvar transacao'}
            onPress={handleSave}
            disabled={saving}
          />
        </GlassPanel>
      )}
    </AppShell>
  );
}

export default TransacaoFormScreen;

const styles = StyleSheet.create({
  calendarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
  },
  calendarButtonText: {
    color: FinanceTheme.colors.cyan,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
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
});
