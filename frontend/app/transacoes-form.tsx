import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { TextInput } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppLoading } from '../components/app-loading';
import { AppMessage } from '../components/app-message';
import { AppOptionGroup } from '../components/app-option-group';
import { AppCard, AppField, AppScreen, appInputStyles } from '../components/app-screen';
import { listCategorias } from '../services/categoriaService';
import { listContas } from '../services/contaService';
import {
  createTransacao,
  getTransacaoById,
  updateTransacao,
} from '../services/transacaoService';
import { Categoria } from '../types/categoria';
import { Conta } from '../types/conta';
import { TipoTransacao } from '../types/transacao';
import { resolveApiError } from '../utils/api-error';
import { parseDecimalInput } from '../utils/number-input';

export default function TransacaoFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const transacaoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [tipo, setTipo] = useState<TipoTransacao>('despesa');
  const [contaId, setContaId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState('');
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [contasData, categoriasData] = await Promise.all([
          listContas(),
          listCategorias(),
        ]);
        setContas(contasData);
        setCategorias(categoriasData);

        if (transacaoId) {
          const transacao = await getTransacaoById(transacaoId);
          setTipo(transacao.tipo);
          setContaId(transacao.contaId);
          setCategoriaId(transacao.categoriaId);
          setValor(String(transacao.valor));
          setData(transacao.data);
          setDescricao(transacao.descricao || '');
        } else if (contasData[0]) {
          setContaId(contasData[0].id);
        }
      } catch (error) {
        const resolvedError = await resolveApiError(
          error,
          'Nao foi possivel carregar o formulario de transacao.',
        );
        setMessage(resolvedError.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [transacaoId]);

  const categoriasFiltradas = useMemo(
    () => categorias.filter((categoria) => categoria.tipo === tipo),
    [categorias, tipo],
  );

  useEffect(() => {
    if (!categoriasFiltradas.find((categoria) => categoria.id === categoriaId)) {
      setCategoriaId(categoriasFiltradas[0]?.id ?? '');
    }
  }, [categoriaId, categoriasFiltradas]);

  async function handleSave() {
    const parsedValor = parseDecimalInput(valor);

    if (!contaId) {
      setMessage('Selecione uma conta para continuar.');
      return;
    }

    if (!categoriaId) {
      setMessage('Selecione uma categoria para continuar.');
      return;
    }

    if (!Number.isFinite(parsedValor)) {
      setMessage('Informe um valor valido. Ex.: 150,90');
      return;
    }

    if (parsedValor <= 0) {
      setMessage('O valor deve ser maior que zero.');
      return;
    }

    if (!data.trim()) {
      setMessage('Informe a data da transacao.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      const payload = {
        contaId,
        categoriaId,
        data,
        descricao: descricao.trim() || undefined,
        tipo,
        valor: parsedValor,
      };

      if (transacaoId) {
        await updateTransacao(transacaoId, payload);
      } else {
        await createTransacao(payload);
      }

      router.replace('/transacoes' as never);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel salvar a transacao.',
      );
      setMessage(resolvedError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AppLoading label="Carregando transacao..." />;
  }

  return (
    <AppScreen
      title={transacaoId ? 'Editar transacao' : 'Nova transacao'}
      actionLabel="Voltar"
      onActionPress={() => router.back()}
    >
      <AppCard>
        <AppField label="Tipo">
          <AppOptionGroup
            options={[
              { label: 'Despesa', value: 'despesa' },
              { label: 'Receita', value: 'receita' },
            ]}
            selectedValue={tipo}
            onChange={(value) => setTipo(value as TipoTransacao)}
          />
        </AppField>

        <AppField label="Conta">
          <AppOptionGroup
            options={contas.map((conta) => ({ label: conta.nome, value: conta.id }))}
            selectedValue={contaId}
            onChange={setContaId}
          />
        </AppField>

        <AppField label="Categoria">
          <AppOptionGroup
            options={categoriasFiltradas.map((categoria) => ({
              label: categoria.nome,
              value: categoria.id,
            }))}
            selectedValue={categoriaId}
            onChange={setCategoriaId}
          />
        </AppField>

        <AppField label="Valor">
          <TextInput
            style={appInputStyles.input}
            value={valor}
            onChangeText={setValor}
            keyboardType="decimal-pad"
            placeholder="0,00"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>

        <AppField label="Data (YYYY-MM-DD)">
          <TextInput
            style={appInputStyles.input}
            value={data}
            onChangeText={setData}
            placeholder="2026-04-07"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>

        <AppField label="Descricao">
          <TextInput
            style={[appInputStyles.input, appInputStyles.multiline]}
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Descricao da transacao"
            placeholderTextColor="#8A8A8A"
            multiline
          />
        </AppField>

        <AppMessage tone="error" value={message} />
        <AppButton
          label={saving ? 'Salvando...' : 'Salvar transacao'}
          onPress={handleSave}
          disabled={saving}
        />
      </AppCard>
    </AppScreen>
  );
}
