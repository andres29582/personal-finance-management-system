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
import { parseDecimalInput } from '../../../../utils/number-input';
import {
  createTransferencia,
  getTransferenciaById,
  updateTransferencia,
} from '../services/transferenciaService';

export function TransferenciaFormScreen() {
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
        const resolvedError = await resolveApiError(
          error,
          'Nao foi possivel carregar a transferencia.',
        );
        setMessage(resolvedError.message);
        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [router, transferenciaId]);

  async function handleSave() {
    const parsedValor = parseDecimalInput(valor);
    const parsedComissao = parseDecimalInput(comissao);

    if (!contaOrigemId || !contaDestinoId || !Number.isFinite(parsedValor) || !data) {
      setMessage('Preencha origem, destino, valor e data.');
      return;
    }

    if (parsedValor <= 0) {
      setMessage('O valor deve ser maior que zero.');
      return;
    }

    if (contaOrigemId === contaDestinoId) {
      setMessage('Conta origem e destino devem ser diferentes.');
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
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel salvar a transferencia.',
      );
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setSaving(false);
    }
  }

  const contaOptions = contas.map((conta) => ({ label: conta.nome, value: conta.id }));

  return (
    <FinanceAppShell
      activeRoute="/transferencias"
      header={
        <FinanceAppHeader
          action={<GlassButton label="Voltar" onPress={() => router.back()} variant="ghost" />}
          eyebrow="Movimentacoes"
          subtitle="Registre transferencias entre contas."
          title={transferenciaId ? 'Editar transferencia' : 'Nova transferencia'}
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      {loading ? (
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>Carregando transferencia...</Text>
          </View>
        </GlassPanel>
      ) : (
        <GlassPanel>
          <GlassField label="Conta origem">
            <GlassOptionGroup
              options={contaOptions}
              value={contaOrigemId}
              onChange={setContaOrigemId}
            />
          </GlassField>

          <GlassField label="Conta destino">
            <GlassOptionGroup
              options={contaOptions}
              value={contaDestinoId}
              onChange={setContaDestinoId}
            />
          </GlassField>

          <GlassField label="Valor">
            <GlassTextInput
              keyboardType="decimal-pad"
              value={valor}
              onChangeText={setValor}
            />
          </GlassField>

          <GlassField label="Comissao">
            <GlassTextInput
              keyboardType="decimal-pad"
              value={comissao}
              onChangeText={setComissao}
            />
          </GlassField>

          <GlassField label="Data">
            <GlassTextInput value={data} onChangeText={setData} />
          </GlassField>

          <GlassField label="Descricao">
            <GlassTextInput value={descricao} onChangeText={setDescricao} />
          </GlassField>

          {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
          <GlassButton
            label={saving ? 'Salvando...' : 'Salvar transferencia'}
            onPress={handleSave}
            disabled={saving}
          />
        </GlassPanel>
      )}
    </FinanceAppShell>
  );
}

export default TransferenciaFormScreen;

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
