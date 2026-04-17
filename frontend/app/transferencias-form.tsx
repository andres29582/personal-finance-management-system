import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppLoading } from '../components/app-loading';
import { AppMessage } from '../components/app-message';
import { AppOptionGroup } from '../components/app-option-group';
import { AppCard, AppField, AppScreen, appInputStyles } from '../components/app-screen';
import { listContas } from '../services/contaService';
import {
  createTransferencia,
  getTransferenciaById,
  updateTransferencia,
} from '../services/transferenciaService';
import { Conta } from '../types/conta';
import { resolveApiError } from '../utils/api-error';
import { parseDecimalInput } from '../utils/number-input';

export default function TransferenciaFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const transferenciaId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [contas, setContas] = useState<Conta[]>([]);
  const [contaOrigemId, setContaOrigemId] = useState('');
  const [contaDestinoId, setContaDestinoId] = useState('');
  const [valor, setValor] = useState('');
  const [comissao, setComissao] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const contasData = await listContas();
        setContas(contasData);
        setContaOrigemId(contasData[0]?.id ?? '');
        setContaDestinoId(contasData[1]?.id ?? contasData[0]?.id ?? '');

        if (transferenciaId) {
          const transferencia = await getTransferenciaById(transferenciaId);
          setContaOrigemId(transferencia.contaOrigemId);
          setContaDestinoId(transferencia.contaDestinoId);
          setValor(String(transferencia.valor));
          setComissao(String(transferencia.comissao));
          setData(transferencia.data);
          setDescricao(transferencia.descricao || '');
        }
      } catch (error) {
        const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar a transferencia.');
        setMessage(resolvedError.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [transferenciaId]);

  async function handleSave() {
    const parsedValor = parseDecimalInput(valor);
    const parsedComissao = parseDecimalInput(comissao);

    if (!contaOrigemId || !contaDestinoId || !Number.isFinite(parsedValor) || !data) {
      setMessage('Preencha origem, destino, valor e data.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      const payload = {
        comissao: Number.isFinite(parsedComissao) ? parsedComissao : 0,
        contaDestinoId,
        contaOrigemId,
        data,
        descricao: descricao.trim() || undefined,
        valor: parsedValor,
      };

      if (transferenciaId) {
        await updateTransferencia(transferenciaId, payload);
      } else {
        await createTransferencia(payload);
      }

      router.replace('/transferencias' as never);
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel salvar a transferencia.');
      setMessage(resolvedError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AppLoading label="Carregando transferencia..." />;
  }

  return (
    <AppScreen
      title={transferenciaId ? 'Editar transferencia' : 'Nova transferencia'}
      actionLabel="Voltar"
      onActionPress={() => router.back()}
    >
      <AppCard>
        <AppField label="Conta origem">
          <AppOptionGroup
            options={contas.map((conta) => ({ label: conta.nome, value: conta.id }))}
            selectedValue={contaOrigemId}
            onChange={setContaOrigemId}
          />
        </AppField>

        <AppField label="Conta destino">
          <AppOptionGroup
            options={contas.map((conta) => ({ label: conta.nome, value: conta.id }))}
            selectedValue={contaDestinoId}
            onChange={setContaDestinoId}
          />
        </AppField>

        <AppField label="Valor">
          <TextInput style={appInputStyles.input} value={valor} onChangeText={setValor} keyboardType="decimal-pad" />
        </AppField>

        <AppField label="Comissao">
          <TextInput style={appInputStyles.input} value={comissao} onChangeText={setComissao} keyboardType="decimal-pad" />
        </AppField>

        <AppField label="Data">
          <TextInput style={appInputStyles.input} value={data} onChangeText={setData} />
        </AppField>

        <AppField label="Descricao">
          <TextInput style={appInputStyles.input} value={descricao} onChangeText={setDescricao} />
        </AppField>

        <AppMessage tone="error" value={message} />
        <AppButton label={saving ? 'Salvando...' : 'Salvar transferencia'} onPress={handleSave} disabled={saving} />
      </AppCard>
    </AppScreen>
  );
}
