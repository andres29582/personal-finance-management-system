import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { TextInput } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppLoading } from '../components/app-loading';
import { AppMessage } from '../components/app-message';
import { AppOptionGroup } from '../components/app-option-group';
import { AppCard, AppField, AppScreen, appInputStyles } from '../components/app-screen';
import { createAlerta, getAlertaById, updateAlerta } from '../services/alertaService';
import { listDividas } from '../services/dividaService';
import { listMetas } from '../services/metaService';
import { listOrcamentos } from '../services/orcamentoService';
import { TipoAlerta } from '../types/alerta';
import { Divida } from '../types/divida';
import { Meta } from '../types/meta';
import { Orcamento } from '../types/orcamento';
import { resolveApiError } from '../utils/api-error';

export default function AlertasFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const alertaId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [tipo, setTipo] = useState<TipoAlerta>('vencimento_meta');
  const [referenciaId, setReferenciaId] = useState('');
  const [diasAnticipacion, setDiasAnticipacion] = useState('3');
  const [metas, setMetas] = useState<Meta[]>([]);
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [metasData, dividasData, orcamentosData] = await Promise.all([
          listMetas(),
          listDividas(),
          listOrcamentos(),
        ]);
        setMetas(metasData);
        setDividas(dividasData);
        setOrcamentos(orcamentosData);

        if (alertaId) {
          const alerta = await getAlertaById(alertaId);
          setTipo(alerta.tipo);
          setReferenciaId(alerta.referenciaId);
          setDiasAnticipacion(String(alerta.diasAnticipacion));
        }
      } catch (error) {
        const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar o alerta.');
        setMessage(resolvedError.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [alertaId]);

  const referenciaOptions = useMemo(() => {
    if (tipo === 'vencimento_meta') {
      return metas.map((meta) => ({ label: meta.nome, value: meta.id }));
    }

    if (tipo === 'vencimento_divida') {
      return dividas.map((divida) => ({ label: divida.nome, value: divida.id }));
    }

    return orcamentos.map((orcamento) => ({
      label: orcamento.mesReferencia,
      value: orcamento.id,
    }));
  }, [dividas, metas, orcamentos, tipo]);

  async function handleSave() {
    const parsedDays = Number(diasAnticipacion);

    if (!referenciaId || !Number.isInteger(parsedDays) || parsedDays < 1) {
      setMessage('Informe uma referencia e dias de antecipacao validos.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      if (alertaId) {
        await updateAlerta(alertaId, { diasAnticipacion: parsedDays });
      } else {
        await createAlerta({
          diasAnticipacion: parsedDays,
          referenciaId,
          tipo,
        });
      }

      router.replace('/alertas' as never);
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel salvar o alerta.');
      setMessage(resolvedError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AppLoading label="Carregando alerta..." />;
  }

  return (
    <AppScreen
      title={alertaId ? 'Editar alerta' : 'Novo alerta'}
      actionLabel="Voltar"
      onActionPress={() => router.back()}
    >
      <AppCard>
        <AppField label="Tipo">
          <AppOptionGroup
            options={[
              { label: 'Meta', value: 'vencimento_meta' },
              { label: 'Divida', value: 'vencimento_divida' },
              { label: 'Limite gasto', value: 'limite_gasto' },
            ]}
            selectedValue={tipo}
            onChange={(value) => setTipo(value as TipoAlerta)}
          />
        </AppField>

        <AppField label="Referencia">
          <AppOptionGroup
            options={referenciaOptions}
            selectedValue={referenciaId}
            onChange={setReferenciaId}
          />
        </AppField>

        <AppField label="Dias de antecipacao">
          <TextInput
            style={appInputStyles.input}
            value={diasAnticipacion}
            onChangeText={setDiasAnticipacion}
            keyboardType="number-pad"
          />
        </AppField>

        <AppMessage tone="error" value={message} />
        <AppButton label={saving ? 'Salvando...' : 'Salvar alerta'} onPress={handleSave} disabled={saving} />
      </AppCard>
    </AppScreen>
  );
}
