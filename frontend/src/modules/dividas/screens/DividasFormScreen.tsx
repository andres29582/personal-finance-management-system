import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { AppButton } from '../../../../components/app-button';
import { AppLoading } from '../../../../components/app-loading';
import { AppMessage } from '../../../../components/app-message';
import { AppOptionGroup } from '../../../../components/app-option-group';
import { AppCard, AppField, AppScreen, appInputStyles } from '../../../../components/app-screen';
import { listContas } from '../../contas/services/contaService';
import { Conta } from '../../contas/types/conta';
import { createDivida, getDividaById, updateDivida } from '../services/dividaService';
import { Periodicidade } from '../types/divida';
import { resolveApiError } from '../../../../utils/api-error';
import { parseDecimalInput } from '../../../../utils/number-input';

type DividaField =
  | 'cuotaMensual'
  | 'fechaInicio'
  | 'fechaVencimiento'
  | 'montoTotal'
  | 'nome'
  | 'proximoVencimiento'
  | 'tasaInteres';

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

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
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<DividaField, string>>
  >({});

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
          setContaId(divida.contaId || '');
          setNome(divida.nome);
          setMontoTotal(String(divida.montoTotal));
          setTasaInteres(String(divida.tasaInteres ?? ''));
          setCuotaMensual(String(divida.cuotaMensual ?? ''));
          setFechaInicio(divida.fechaInicio);
          setFechaVencimiento(divida.fechaVencimiento);
          setProximoVencimiento(divida.proximoVencimiento || '');
          setPeriodicidade(divida.periodicidade || 'mensal');
        }
      } catch (error) {
        const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar a divida.');
        setMessage(resolvedError.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [dividaId]);

  async function handleSave() {
    const total = parseDecimalInput(montoTotal);
    const interest = parseDecimalInput(tasaInteres);
    const monthlyPayment = parseDecimalInput(cuotaMensual);
    const nextFieldErrors: Partial<Record<DividaField, string>> = {};

    if (!nome.trim()) {
      nextFieldErrors.nome = 'Informe um nome para a divida.';
    }

    if (!Number.isFinite(total) || total <= 0) {
      nextFieldErrors.montoTotal = 'Informe um valor total valido maior que zero.';
    }

    if (!fechaInicio.trim()) {
      nextFieldErrors.fechaInicio = 'Informe a data de inicio.';
    } else if (!isValidDateInput(fechaInicio.trim())) {
      nextFieldErrors.fechaInicio = 'Use o formato YYYY-MM-DD. Ex.: 2026-04-07.';
    }

    if (!fechaVencimiento.trim()) {
      nextFieldErrors.fechaVencimiento = 'Informe a data de vencimento.';
    } else if (!isValidDateInput(fechaVencimiento.trim())) {
      nextFieldErrors.fechaVencimiento =
        'Use o formato YYYY-MM-DD. Ex.: 2027-04-07.';
    }

    if (
      isValidDateInput(fechaInicio.trim()) &&
      isValidDateInput(fechaVencimiento.trim()) &&
      fechaVencimiento < fechaInicio
    ) {
      nextFieldErrors.fechaVencimiento =
        'A data de vencimento deve ser igual ou posterior a data de inicio.';
    }

    if (tasaInteres.trim() && !Number.isFinite(interest)) {
      nextFieldErrors.tasaInteres =
        'Informe uma taxa de interesse valida. Ex.: 2,5';
    }

    if (cuotaMensual.trim() && !Number.isFinite(monthlyPayment)) {
      nextFieldErrors.cuotaMensual =
        'Informe uma cuota mensal valida. Ex.: 450,00';
    }

    if (
      proximoVencimiento.trim() &&
      !isValidDateInput(proximoVencimiento.trim())
    ) {
      nextFieldErrors.proximoVencimiento =
        'Use o formato YYYY-MM-DD. Ex.: 2026-05-07.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setMessage('Revise os campos destacados antes de salvar.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      setFieldErrors({});

      const payload = {
        contaId: contaId || undefined,
        cuotaMensual: Number.isFinite(monthlyPayment) ? monthlyPayment : undefined,
        fechaInicio,
        fechaVencimiento,
        montoTotal: total,
        nome: nome.trim(),
        periodicidade,
        proximoVencimiento: proximoVencimiento || undefined,
        tasaInteres: Number.isFinite(interest) ? interest : undefined,
      };

      if (dividaId) {
        await updateDivida(dividaId, payload);
      } else {
        await createDivida(payload);
      }

      router.replace('/dividas' as never);
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel salvar a divida.');
      setMessage(resolvedError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AppLoading label="Carregando divida..." />;
  }

  return (
    <AppScreen
      title={dividaId ? 'Editar divida' : 'Nova divida'}
      actionLabel="Voltar"
      onActionPress={() => router.back()}
    >
      <AppCard>
        <AppField label="Nome" error={fieldErrors.nome}>
          <TextInput
            style={[appInputStyles.input, fieldErrors.nome ? appInputStyles.inputError : null]}
            value={nome}
            onChangeText={(value) => {
              setNome(value);
              clearFieldError('nome');
            }}
          />
        </AppField>

        <AppField label="Conta vinculada">
          <AppOptionGroup
            options={[
              { label: 'Nenhuma', value: '' },
              ...contas.map((conta) => ({ label: conta.nome, value: conta.id })),
            ]}
            selectedValue={contaId}
            onChange={setContaId}
          />
        </AppField>

        <AppField label="Valor total" error={fieldErrors.montoTotal}>
          <TextInput
            style={[
              appInputStyles.input,
              fieldErrors.montoTotal ? appInputStyles.inputError : null,
            ]}
            value={montoTotal}
            onChangeText={(value) => {
              setMontoTotal(value);
              clearFieldError('montoTotal');
            }}
            keyboardType="decimal-pad"
            placeholder="Ex.: 15000,00"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>

        <AppField label="Taxa de interesse" error={fieldErrors.tasaInteres}>
          <TextInput
            style={[
              appInputStyles.input,
              fieldErrors.tasaInteres ? appInputStyles.inputError : null,
            ]}
            value={tasaInteres}
            onChangeText={(value) => {
              setTasaInteres(value);
              clearFieldError('tasaInteres');
            }}
            keyboardType="decimal-pad"
            placeholder="Opcional. Ex.: 2,5"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>

        <AppField label="Cuota mensal" error={fieldErrors.cuotaMensual}>
          <TextInput
            style={[
              appInputStyles.input,
              fieldErrors.cuotaMensual ? appInputStyles.inputError : null,
            ]}
            value={cuotaMensual}
            onChangeText={(value) => {
              setCuotaMensual(value);
              clearFieldError('cuotaMensual');
            }}
            keyboardType="decimal-pad"
            placeholder="Opcional. Ex.: 450,00"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>

        <AppField label="Data inicio" error={fieldErrors.fechaInicio}>
          <TextInput
            style={[
              appInputStyles.input,
              fieldErrors.fechaInicio ? appInputStyles.inputError : null,
            ]}
            value={fechaInicio}
            onChangeText={(value) => {
              setFechaInicio(value);
              clearFieldError('fechaInicio');
            }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>

        <AppField
          label="Data vencimento"
          error={fieldErrors.fechaVencimiento}
        >
          <TextInput
            style={[
              appInputStyles.input,
              fieldErrors.fechaVencimiento
                ? appInputStyles.inputError
                : null,
            ]}
            value={fechaVencimiento}
            onChangeText={(value) => {
              setFechaVencimiento(value);
              clearFieldError('fechaVencimiento');
            }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>

        <AppField
          label="Proximo vencimento"
          error={fieldErrors.proximoVencimiento}
        >
          <TextInput
            style={[
              appInputStyles.input,
              fieldErrors.proximoVencimiento
                ? appInputStyles.inputError
                : null,
            ]}
            value={proximoVencimiento}
            onChangeText={(value) => {
              setProximoVencimiento(value);
              clearFieldError('proximoVencimiento');
            }}
            placeholder="Opcional. Ex.: 2026-05-07"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>

        <AppField label="Periodicidade">
          <AppOptionGroup
            options={[
              { label: 'Semanal', value: 'semanal' },
              { label: 'Quinzenal', value: 'quinzenal' },
              { label: 'Mensal', value: 'mensal' },
              { label: 'Anual', value: 'anual' },
            ]}
            selectedValue={periodicidade}
            onChange={(value) => setPeriodicidade(value as Periodicidade)}
          />
        </AppField>

        <AppMessage tone="error" value={message} />
        <AppButton label={saving ? 'Salvando...' : 'Salvar divida'} onPress={handleSave} disabled={saving} />
      </AppCard>
    </AppScreen>
  );
}

export default DividasFormScreen;
