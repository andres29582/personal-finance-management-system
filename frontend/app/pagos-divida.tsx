import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppLoading } from '../components/app-loading';
import { AppMessage } from '../components/app-message';
import { AppOptionGroup } from '../components/app-option-group';
import { AppCard, AppField, AppScreen, appInputStyles } from '../components/app-screen';
import { listCategorias } from '../services/categoriaService';
import { listContas } from '../services/contaService';
import { createPagoDivida, listPagosByDivida, removePagoDivida } from '../services/pagoDividaService';
import { Categoria } from '../types/categoria';
import { Conta } from '../types/conta';
import { PagoDivida } from '../types/pago-divida';
import { confirmAction } from '../utils/confirm-action';
import { resolveApiError } from '../utils/api-error';
import { formatCurrency, formatDate } from '../utils/formatters';
import { parseDecimalInput } from '../utils/number-input';

export default function PagosDividaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dividaId?: string | string[] }>();
  const dividaId = Array.isArray(params.dividaId) ? params.dividaId[0] : params.dividaId;
  const [pagos, setPagos] = useState<PagoDivida[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contaId, setContaId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const categoriasDespesa = useMemo(
    () => categorias.filter((categoria) => categoria.tipo === 'despesa'),
    [categorias],
  );

  useEffect(() => {
    async function loadData() {
      if (!dividaId) {
        setMessage('Divida invalida.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [pagosData, contasData, categoriasData] = await Promise.all([
          listPagosByDivida(dividaId),
          listContas(),
          listCategorias('despesa'),
        ]);
        setPagos(pagosData);
        setContas(contasData);
        setCategorias(categoriasData);
        setContaId(contasData[0]?.id ?? '');
        setCategoriaId(categoriasData[0]?.id ?? '');
      } catch (error) {
        const resolvedError = await resolveApiError(error, 'Nao foi possivel carregar pagamentos.');
        setMessage(resolvedError.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [dividaId]);

  async function reloadPayments() {
    if (!dividaId) {
      return;
    }

    setPagos(await listPagosByDivida(dividaId));
  }

  async function handleSave() {
    const parsedValor = parseDecimalInput(valor);

    if (!dividaId || !contaId || !categoriaId || !Number.isFinite(parsedValor)) {
      setMessage('Preencha conta, categoria, valor e data.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      await createPagoDivida({
        categoriaId,
        contaId,
        data,
        descricao: descricao.trim() || undefined,
        dividaId,
        valor: parsedValor,
      });
      setValor('');
      setDescricao('');
      await reloadPayments();
    } catch (error) {
      const resolvedError = await resolveApiError(error, 'Nao foi possivel registrar o pagamento.');
      setMessage(resolvedError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    const confirmed = await confirmAction(
      'Excluir pagamento',
      'Deseja remover este pagamento?',
    );

    if (!confirmed) {
      return;
    }

    try {
      await removePagoDivida(id);
      await reloadPayments();
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel remover o pagamento.',
      );
      setMessage(resolvedError.message);
    }
  }

  if (loading) {
    return <AppLoading label="Carregando pagamentos..." />;
  }

  return (
    <AppScreen
      title="Pagamentos da divida"
      backLabel="Voltar"
      onBackPress={() => router.replace('/dividas' as never)}
    >
      <AppCard>
        <AppField label="Conta">
          <AppOptionGroup
            options={contas.map((conta) => ({ label: conta.nome, value: conta.id }))}
            selectedValue={contaId}
            onChange={setContaId}
          />
        </AppField>

        <AppField label="Categoria">
          <AppOptionGroup
            options={categoriasDespesa.map((categoria) => ({ label: categoria.nome, value: categoria.id }))}
            selectedValue={categoriaId}
            onChange={setCategoriaId}
          />
        </AppField>

        <AppField label="Valor">
          <TextInput style={appInputStyles.input} value={valor} onChangeText={setValor} keyboardType="decimal-pad" />
        </AppField>

        <AppField label="Data">
          <TextInput style={appInputStyles.input} value={data} onChangeText={setData} />
        </AppField>

        <AppField label="Descricao">
          <TextInput style={appInputStyles.input} value={descricao} onChangeText={setDescricao} />
        </AppField>

        <AppMessage tone="error" value={message} />
        <AppButton label={saving ? 'Salvando...' : 'Registrar pagamento'} onPress={handleSave} disabled={saving} />
      </AppCard>

      {pagos.length ? (
        pagos.map((pago) => (
          <AppCard key={pago.id}>
            <Text>{pago.descricao || 'Pagamento de divida'}</Text>
            <Text>{formatDate(pago.data)}</Text>
            <Text>{formatCurrency(pago.valor)}</Text>
            <View style={{ marginTop: 12 }}>
              <AppButton label="Excluir" variant="danger" onPress={() => handleRemove(pago.id)} />
            </View>
          </AppCard>
        ))
      ) : (
        <AppCard>
          <Text>Nenhum pagamento registrado.</Text>
        </AppCard>
      )}
    </AppScreen>
  );
}
