import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { listCategorias } from '../../categorias/services/categoriaService';
import { Categoria } from '../../categorias/types/categoria';
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
import { parseDecimalInput } from '../../../../utils/number-input';
import {
  createTransacao,
  getTransacaoById,
  updateTransacao,
} from '../services/transacaoService';
import { TipoTransacao } from '../types/transacao';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const normalizedDate = new Date(Date.UTC(year, month - 1, day))
    .toISOString()
    .slice(0, 10);

  return normalizedDate === value;
}

export function TransacaoFormScreen() {
  const router = useRouter();
  const { replace } = router;
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
        if (resolvedError.unauthorized) {
          replace('/login');
        }
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [replace, transacaoId]);

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
    const normalizedData = data.trim();

    if (!contaId) {
      setMessage('Selecione uma conta para continuar.');
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

    if (!categoriaId) {
      setMessage('Selecione uma categoria para continuar.');
      return;
    }

    if (!normalizedData) {
      setMessage('Informe a data da transacao.');
      return;
    }

    if (!isValidIsoDate(normalizedData)) {
      setMessage('Informe uma data valida no formato YYYY-MM-DD. Ex.: 2026-04-07');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      const payload = {
        contaId,
        categoriaId,
        data: normalizedData,
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
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <FinanceAppShell
      activeRoute="/transacoes"
      header={
        <FinanceAppHeader
          action={<GlassButton label="Voltar" onPress={() => router.back()} variant="ghost" />}
          eyebrow="Movimentacoes"
          subtitle="Registre receitas e despesas com conta e categoria."
          title={transacaoId ? 'Editar transacao' : 'Nova transacao'}
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
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
              onChange={(value) => setTipo(value as TipoTransacao)}
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
              value={categoriaId}
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

          <GlassField label="Data (YYYY-MM-DD)">
            <GlassTextInput
              placeholder="2026-04-07"
              value={data}
              onChangeText={setData}
            />
          </GlassField>

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
    </FinanceAppShell>
  );
}

export default TransacaoFormScreen;

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
  multiline: {
    minHeight: 92,
    paddingTop: FinanceTheme.spacing.sm,
    textAlignVertical: 'top',
  },
});
