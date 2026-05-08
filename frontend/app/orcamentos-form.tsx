import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppLoading } from '../components/app-loading';
import { AppMessage } from '../components/app-message';
import { AppCard, AppField, AppScreen, appInputStyles } from '../components/app-screen';
import {
  createOrcamento,
  getOrcamentoById,
  updateOrcamento,
} from '../services/orcamentoService';
import { resolveApiError } from '../utils/api-error';
import { getCurrentMonthReference } from '../utils/formatters';
import { parseDecimalInput } from '../utils/number-input';

export default function OrcamentoFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const orcamentoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [mesReferencia, setMesReferencia] = useState(getCurrentMonthReference());
  const [valorPlanejado, setValorPlanejado] = useState('');
  const [loading, setLoading] = useState(!!orcamentoId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadOrcamento() {
      if (!orcamentoId) {
        return;
      }

      try {
        setLoading(true);
        const orcamento = await getOrcamentoById(orcamentoId);
        setMesReferencia(orcamento.mesReferencia);
        setValorPlanejado(String(orcamento.valorPlanejado));
      } catch (error) {
        const resolvedError = await resolveApiError(
          error,
          'Nao foi possivel carregar o orcamento.',
        );
        setMessage(resolvedError.message);
      } finally {
        setLoading(false);
      }
    }

    loadOrcamento();
  }, [orcamentoId]);

  async function handleSave() {
    const parsedValue = parseDecimalInput(valorPlanejado);

    if (!mesReferencia || !Number.isFinite(parsedValue)) {
      setMessage('Informe mes e valor planejado validos.');
      return;
    }

    if (parsedValue <= 0) {
      setMessage('O valor planejado deve ser maior que zero.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      if (orcamentoId) {
        await updateOrcamento(orcamentoId, { valorPlanejado: parsedValue });
      } else {
        await createOrcamento({
          mesReferencia,
          valorPlanejado: parsedValue,
        });
      }

      router.replace('/orcamentos' as never);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel salvar o orcamento.',
      );
      setMessage(resolvedError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AppLoading label="Carregando orcamento..." />;
  }

  return (
    <AppScreen
      title={orcamentoId ? 'Editar orcamento' : 'Novo orcamento'}
      actionLabel="Voltar"
      onActionPress={() => router.back()}
    >
      <AppCard>
        <AppField label="Mes de referencia (YYYY-MM)">
          <TextInput
            style={appInputStyles.input}
            value={mesReferencia}
            onChangeText={setMesReferencia}
            placeholder="2026-04"
            placeholderTextColor="#8A8A8A"
            editable={!orcamentoId}
          />
        </AppField>

        <AppField label="Valor planejado">
          <TextInput
            style={appInputStyles.input}
            value={valorPlanejado}
            onChangeText={setValorPlanejado}
            keyboardType="decimal-pad"
            placeholder="0,00"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>

        <AppMessage tone="error" value={message} />
        <AppButton
          label={saving ? 'Salvando...' : 'Salvar orcamento'}
          onPress={handleSave}
          disabled={saving}
        />
      </AppCard>
    </AppScreen>
  );
}
