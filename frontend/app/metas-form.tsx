import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppLoading } from '../components/app-loading';
import { AppMessage } from '../components/app-message';
import { AppOptionGroup } from '../components/app-option-group';
import { AppCard, AppField, AppScreen, appInputStyles } from '../components/app-screen';
import { listContas } from '../services/contaService';
import { listDividas } from '../services/dividaService';
import { createMeta, getMetaById, updateMeta } from '../services/metaService';
import { Conta } from '../types/conta';
import { Divida } from '../types/divida';
import { TipoMeta } from '../types/meta';
import { resolveApiError } from '../utils/api-error';
import { parseDecimalInput } from '../utils/number-input';

export default function MetasFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const metaId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoMeta>('economia');
  const [montoObjetivo, setMontoObjetivo] = useState('');
  const [montoActual, setMontoActual] = useState('');
  const [fechaLimite, setFechaLimite] = useState(new Date().toISOString().slice(0, 10));
  const [contaId, setContaId] = useState('');
  const [dividaId, setDividaId] = useState('');
  const [contas, setContas] = useState<Conta[]>([]);
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [contasData, dividasData] = await Promise.all([
          listContas(),
          listDividas(),
        ]);
        setContas(contasData);
        setDividas(dividasData);

        if (metaId) {
          const meta = await getMetaById(metaId);
          setNome(meta.nome);
          setTipo(meta.tipo);
          setMontoObjetivo(String(meta.montoObjetivo));
          setMontoActual(String(meta.montoActual));
          setFechaLimite(meta.fechaLimite);
          setContaId(meta.contaId || '');
          setDividaId(meta.dividaId || '');
        }
      } catch (error) {
        const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar a meta.');
        setMessage(resolvedError.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [metaId]);

  async function handleSave() {
    const objetivo = parseDecimalInput(montoObjetivo);
    const actual = parseDecimalInput(montoActual);

    if (!nome.trim() || !Number.isFinite(objetivo) || !fechaLimite) {
      setMessage('Preencha nome, objetivo e data limite.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      if (metaId) {
        await updateMeta(metaId, {
          fechaLimite,
          montoActual: Number.isFinite(actual) ? actual : 0,
          montoObjetivo: objetivo,
          nome: nome.trim(),
        });
      } else {
        await createMeta({
          contaId: contaId || undefined,
          dividaId: dividaId || undefined,
          fechaLimite,
          montoObjetivo: objetivo,
          nome: nome.trim(),
          tipo,
        });
      }

      router.replace('/metas' as never);
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel salvar a meta.');
      setMessage(resolvedError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AppLoading label="Carregando meta..." />;
  }

  return (
    <AppScreen
      title={metaId ? 'Editar meta' : 'Nova meta'}
      actionLabel="Voltar"
      onActionPress={() => router.back()}
    >
      <AppCard>
        <AppField label="Nome">
          <TextInput style={appInputStyles.input} value={nome} onChangeText={setNome} />
        </AppField>

        <AppField label="Tipo">
          <AppOptionGroup
            options={[
              { label: 'Economia', value: 'economia' },
              { label: 'Reducao divida', value: 'reducao_divida' },
            ]}
            selectedValue={tipo}
            onChange={(value) => setTipo(value as TipoMeta)}
          />
        </AppField>

        <AppField label="Valor objetivo">
          <TextInput
            style={appInputStyles.input}
            value={montoObjetivo}
            onChangeText={setMontoObjetivo}
            keyboardType="decimal-pad"
          />
        </AppField>

        {metaId ? (
          <AppField label="Valor atual">
            <TextInput
              style={appInputStyles.input}
              value={montoActual}
              onChangeText={setMontoActual}
              keyboardType="decimal-pad"
            />
          </AppField>
        ) : null}

        <AppField label="Data limite">
          <TextInput
            style={appInputStyles.input}
            value={fechaLimite}
            onChangeText={setFechaLimite}
            placeholder="2026-12-31"
            placeholderTextColor="#8A8A8A"
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

        <AppField label="Divida vinculada">
          <AppOptionGroup
            options={[
              { label: 'Nenhuma', value: '' },
              ...dividas.map((divida) => ({ label: divida.nome, value: divida.id })),
            ]}
            selectedValue={dividaId}
            onChange={setDividaId}
          />
        </AppField>

        <AppMessage tone="error" value={message} />
        <AppButton label={saving ? 'Salvando...' : 'Salvar meta'} onPress={handleSave} disabled={saving} />
      </AppCard>
    </AppScreen>
  );
}
