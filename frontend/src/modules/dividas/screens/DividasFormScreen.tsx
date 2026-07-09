import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { listContas } from '../../contas/services/contaService';
import { Conta } from '../../contas/types/conta';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassField,
  GlassOptionGroup,
  GlassPanel,
  GlassTextInput,
} from '../../../shared/ui';
import { resolveApiError } from '../../../../utils/api-error';
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
  const [contaId, setContaId] = useState('');
  const [nome, setNome] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [tasaInteres, setTasaInteres] = useState('');
  const [cuotaMensual, setCuotaMensual] = useState('');
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [fechaVencimiento, setFechaVencimiento] = useState(new Date().toISOString().slice(0, 10));
  const [proximoVencimiento, setProximoVencimiento] = useState('');
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>('mensal');
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
      try {
        setLoading(true);
        const contasData = await listContas();
        setContas(contasData);
        setContaId(contasData[0]?.id ?? '');

        if (dividaId) {
          const divida = await getDividaById(dividaId);
          const formValues = mapDividaToFormValues(divida);

          setContaId(formValues.contaId);
          setNome(formValues.nome);
          setMontoTotal(formValues.montoTotal);
          setTasaInteres(formValues.tasaInteres);
          setCuotaMensual(formValues.cuotaMensual);
          setFechaInicio(formValues.fechaInicio);
          setFechaVencimiento(formValues.fechaVencimiento);
          setProximoVencimiento(formValues.proximoVencimiento);
          setPeriodicidade(formValues.periodicidade);
        }
      } catch (error) {
        const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar a divida.');
        setMessage(resolvedError.message);
        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [dividaId, router]);

  async function handleSave() {
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

      router.replace('/dividas' as never);
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel salvar a divida.');
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
      activeRoute="/dividas"
      header={
        <FinanceAppHeader
          action={<GlassButton label="Voltar" onPress={() => router.back()} variant="ghost" />}
          eyebrow="Compromissos"
          subtitle="Cadastre valores, vencimentos e periodicidade."
          title={dividaId ? 'Editar divida' : 'Nova divida'}
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
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
            <GlassOptionGroup
              options={[
                { label: 'Nenhuma', value: '' },
                ...contas.map((conta) => ({ label: conta.nome, value: conta.id })),
              ]}
              value={contaId}
              onChange={setContaId}
            />
          </GlassField>

          <GlassField label="Valor total" error={fieldErrors.montoTotal}>
            <GlassTextInput
              keyboardType="decimal-pad"
              placeholder="Ex.: 15000,00"
              value={montoTotal}
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
    </FinanceAppShell>
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
