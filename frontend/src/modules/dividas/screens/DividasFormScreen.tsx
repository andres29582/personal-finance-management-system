import { useFinancialDraft } from '../../../shared/hooks/useFinancialDraft';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
import {
  buildDividaPayload,
  buildDividaUpdatePayload,
  mapDividaToFormValues,
} from '../mappers/dividaPayloadMapper';
import { createDivida, getDividaById, updateDivida } from '../services/dividaService';
import { Periodicidade } from '../types/divida';
import {
  DividaField,
  DividaFieldErrors,
  validateDividaForm,
} from '../validators/dividaForm';

export function DividasFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const dividaId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [contas, setContas] = useState<Conta[]>([]);
  const draft = useFinancialDraft('debt/' + (dividaId ?? 'new'), {
    nome: '',
    tasaInteres: '',
    cuotaMensual: '',
    fechaVencimiento: getLocalDateInputValue(),
    proximoVencimiento: '',
    periodicidade: 'mensal' as Periodicidade,
    ...(dividaId
      ? {}
      : { contaId: '', montoTotal: '', fechaInicio: getLocalDateInputValue() }),
  });
  const [lockedFields, setLockedFields] = useState({ contaId: '', montoTotal: '', fechaInicio: getLocalDateInputValue() });
  const nome = draft.fields.nome;
  const setNome = (value: string) => draft.setField("nome", value);
  const tasaInteres = draft.fields.tasaInteres;
  const setTasaInteres = (value: string) => draft.setField("tasaInteres", value);
  const cuotaMensual = draft.fields.cuotaMensual;
  const setCuotaMensual = (value: string) => draft.setField("cuotaMensual", value);
  const fechaVencimiento = draft.fields.fechaVencimiento;
  const setFechaVencimiento = (value: string) => draft.setField("fechaVencimiento", value);
  const proximoVencimiento = draft.fields.proximoVencimiento;
  const setProximoVencimiento = (value: string) => draft.setField("proximoVencimiento", value);
  const periodicidade = draft.fields.periodicidade;
  const setPeriodicidade = (value: Periodicidade) => draft.setField("periodicidade", value);
  const contaId = dividaId ? lockedFields.contaId : (draft.fields.contaId ?? '');
  const setContaId = (value: string) => { if (dividaId) setLockedFields(current => ({...current, contaId: value})); else draft.setField("contaId", value); };
  const montoTotal = dividaId ? lockedFields.montoTotal : (draft.fields.montoTotal ?? '');
  const setMontoTotal = (value: string) => { if (dividaId) setLockedFields(current => ({...current, montoTotal: value})); else draft.setField("montoTotal", value); };
  const fechaInicio = dividaId ? lockedFields.fechaInicio : (draft.fields.fechaInicio ?? getLocalDateInputValue());
  const setFechaInicio = (value: string) => { if (dividaId) setLockedFields(current => ({...current, fechaInicio: value})); else draft.setField("fechaInicio", value); };









  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<DividaFieldErrors>({});

  function clearFieldError(field: DividaField) {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  useEffect(() => {
    async function loadData() {
    const loadScope = draft.capture();
    if (!draft.isCurrent(loadScope)) return;
      try {
        setLoading(true);
        const contasData = await listContas();
        if (!draft.isCurrent(loadScope)) return;
        setContas(contasData);


        if (dividaId) {
          const divida = await getDividaById(dividaId);
          if (!draft.isCurrent(loadScope)) return;
          const formValues = mapDividaToFormValues(divida);

          setLockedFields({ contaId: formValues.contaId, montoTotal: formValues.montoTotal, fechaInicio: formValues.fechaInicio });
          draft.hydrate({ nome: formValues.nome, tasaInteres: formValues.tasaInteres, cuotaMensual: formValues.cuotaMensual,
            fechaVencimiento: formValues.fechaVencimiento, proximoVencimiento: formValues.proximoVencimiento, periodicidade: formValues.periodicidade });
        } else { draft.hydrate({ contaId: contasData[0]?.id ?? '' }); }
      } catch (error) {
        if (!draft.isCurrent(loadScope)) return;
        const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar a divida.');
        if (!draft.isCurrent(loadScope)) return;
        setMessage(resolvedError.message);
        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      } finally {
        if (draft.isCurrent()) setLoading(false);
      }
    }

    void loadData();
  }, [dividaId, router]);

  async function handleSave() {
    const submitted = draft.capture();
    if (!draft.isCurrent(submitted)) return;
    const nextFieldErrors = validateDividaForm({
      cuotaMensual,
      fechaInicio,
      fechaVencimiento,
      montoTotal,
      nome,
      proximoVencimiento,
      tasaInteres,
    });

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setMessage('Revise os campos destacados antes de salvar.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      setFieldErrors({});

      const formValues = {
        contaId,
        cuotaMensual,
        fechaInicio,
        fechaVencimiento,
        montoTotal,
        nome,
        periodicidade,
        proximoVencimiento,
        tasaInteres,
      };

      if (dividaId) {
        await updateDivida(dividaId, buildDividaUpdatePayload(formValues));
      } else {
        await createDivida(buildDividaPayload(formValues));
      }

      if (!draft.isCurrent(submitted)) return;

      draft.clear(submitted);

      router.replace('/dividas' as never);
    } catch (error) {
      if (!draft.isCurrent(submitted)) return;
      const resolvedError = await resolveApiError(error, 'Nao foi possivel salvar a divida.');
      if (!draft.isCurrent(submitted)) return;
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (draft.isCurrent()) setSaving(false);
    }
  }

  return (
    <AppShell
      activeRoute="/dividas"
      onProfilePress={() => router.push('/usuario' as never)}
      pageHeader={
        <FinanceAppHeader
          action={<GlassButton label="Voltar" onPress={() => { draft.clear(); router.back(); }} variant="ghost" />}
          eyebrow="Compromissos"
          subtitle="Cadastre valores, vencimentos e periodicidade."
          title={dividaId ? 'Editar divida' : 'Nova divida'}
        />
      }
    >
      {loading ? (
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>Carregando divida...</Text>
          </View>
        </GlassPanel>
      ) : (
        <GlassPanel>
          <GlassField label="Nome" error={fieldErrors.nome}>
            <GlassTextInput
              value={nome}
              onChangeText={(value) => {
                setNome(value);
                clearFieldError('nome');
              }}
            />
          </GlassField>

          <GlassField label="Conta vinculada">
            {dividaId ? (
              <GlassTextInput
                editable={false}
                value={contas.find((conta) => conta.id === contaId)?.nome ?? 'Nenhuma'}
              />
            ) : (
              <GlassOptionGroup
                options={[
                  { label: 'Nenhuma', value: '' },
                  ...contas.map((conta) => ({ label: conta.nome, value: conta.id })),
                ]}
                value={contaId}
                onChange={setContaId}
              />
            )}
          </GlassField>

          <GlassField label="Valor total" error={fieldErrors.montoTotal}>
            <GlassTextInput
              keyboardType="decimal-pad"
              placeholder="Ex.: 15000,00"
              value={montoTotal}
              editable={!dividaId}
              onChangeText={(value) => {
                setMontoTotal(value);
                clearFieldError('montoTotal');
              }}
            />
          </GlassField>

          <GlassField label="Taxa de interesse" error={fieldErrors.tasaInteres}>
            <GlassTextInput
              keyboardType="decimal-pad"
              placeholder="Opcional. Ex.: 2,5"
              value={tasaInteres}
              onChangeText={(value) => {
                setTasaInteres(value);
                clearFieldError('tasaInteres');
              }}
            />
          </GlassField>

          <GlassField label="Cuota mensal" error={fieldErrors.cuotaMensual}>
            <GlassTextInput
              keyboardType="decimal-pad"
              placeholder="Opcional. Ex.: 450,00"
              value={cuotaMensual}
              onChangeText={(value) => {
                setCuotaMensual(value);
                clearFieldError('cuotaMensual');
              }}
            />
          </GlassField>

          <GlassField label="Data inicio" error={fieldErrors.fechaInicio}>
            <GlassTextInput
              placeholder="YYYY-MM-DD"
              value={fechaInicio}
              editable={!dividaId}
              onChangeText={(value) => {
                setFechaInicio(value);
                clearFieldError('fechaInicio');
              }}
            />
          </GlassField>

          <GlassField label="Data vencimento" error={fieldErrors.fechaVencimiento}>
            <GlassTextInput
              placeholder="YYYY-MM-DD"
              value={fechaVencimiento}
              onChangeText={(value) => {
                setFechaVencimiento(value);
                clearFieldError('fechaVencimiento');
              }}
            />
          </GlassField>

          <GlassField
            label="Proximo vencimento"
            error={fieldErrors.proximoVencimiento}
          >
            <GlassTextInput
              placeholder="Opcional. Ex.: 2026-05-07"
              value={proximoVencimiento}
              onChangeText={(value) => {
                setProximoVencimiento(value);
                clearFieldError('proximoVencimiento');
              }}
            />
          </GlassField>

          <GlassField label="Periodicidade">
            <GlassOptionGroup
              options={[
                { label: 'Semanal', value: 'semanal' },
                { label: 'Quinzenal', value: 'quinzenal' },
                { label: 'Mensal', value: 'mensal' },
                { label: 'Anual', value: 'anual' },
              ]}
              value={periodicidade}
              onChange={(value) => setPeriodicidade(value as Periodicidade)}
            />
          </GlassField>

          {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
          <GlassButton
            label={saving ? 'Salvando...' : 'Salvar divida'}
            onPress={handleSave}
            disabled={saving}
          />
        </GlassPanel>
      )}
    </AppShell>
  );
}

export default DividasFormScreen;

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
