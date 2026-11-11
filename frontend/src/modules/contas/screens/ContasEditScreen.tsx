import { useFinancialDraft } from '../../../shared/hooks/useFinancialDraft';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  AppShell,
  FinanceAppHeader,
  GlassButton,
  GlassField,
  GlassPanel,
  GlassStatusCard,
  GlassTextInput,
} from '../../../shared/ui';
import { resolveApiError } from '../../../../utils/api-error';
import { parseDecimalInput } from '../../../../utils/number-input';
import { getContaById, updateConta } from '../services/contaService';
import { Conta } from '../types/conta';

export function ContasEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const contaId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [conta, setConta] = useState<Conta | null>(null);
  const draft = useFinancialDraft('account/' + (contaId ?? 'missing'), {
    nome: '',
    limiteCredito: '',
    dataCorte: '',
    dataPagamento: '',
  });
  const nome = draft.fields.nome;
  const setNome = (value: string) => draft.setField('nome', value);
  const limiteCredito = draft.fields.limiteCredito;
  const setLimiteCredito = (value: string) =>
    draft.setField('limiteCredito', value);
  const dataCorte = draft.fields.dataCorte;
  const setDataCorte = (value: string) => draft.setField('dataCorte', value);
  const dataPagamento = draft.fields.dataPagamento;
  const setDataPagamento = (value: string) =>
    draft.setField('dataPagamento', value);




  const [loadingConta, setLoadingConta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadConta() {
    const loadScope = draft.capture();
    if (!draft.isCurrent(loadScope)) return;
      if (!contaId) {
        setError('Conta invalida.');
        if (draft.isCurrent()) setLoadingConta(false);
        return;
      }

      try {
        setLoadingConta(true);
        const data = await getContaById(contaId);
        if (!draft.isCurrent(loadScope)) return;
        setConta(data);
        draft.hydrate({ nome: data.nome, limiteCredito: data.limiteCredito != null ? String(data.limiteCredito) : '',
          dataCorte: data.dataCorte != null ? String(data.dataCorte) : '', dataPagamento: data.dataPagamento != null ? String(data.dataPagamento) : '' });
      } catch (requestError) {
        if (!draft.isCurrent(loadScope)) return;
        const resolvedError = await resolveApiError(
          requestError,
          'Nao foi possivel carregar a conta.',
        );
        if (!draft.isCurrent(loadScope)) return;
        setError(resolvedError.message);
        if (resolvedError.unauthorized) {
          router.replace('/login');
        }
      } finally {
        if (draft.isCurrent()) setLoadingConta(false);
      }
    }

    void loadConta();
  }, [contaId, router]);

  const isCartaoCredito = conta?.tipo === 'cartao_credito';

  async function handleSave() {
    const submitted = draft.capture();
    if (!draft.isCurrent(submitted)) return;
    if (!contaId || !conta) {
      setError('Conta invalida.');
      return;
    }

    setError('');

    if (!nome.trim()) {
      setError('Informe o nome da conta.');
      return;
    }

    let limiteCreditoNumber: number | undefined;
    let dataCorteNumber: number | undefined;
    let dataPagamentoNumber: number | undefined;

    if (isCartaoCredito) {
      limiteCreditoNumber = parseDecimalInput(limiteCredito);
      dataCorteNumber = Number(dataCorte);
      dataPagamentoNumber = Number(dataPagamento);

      if (!Number.isFinite(limiteCreditoNumber)) {
        setError('Informe um limite de credito valido.');
        return;
      }

      if (limiteCreditoNumber <= 0) {
        setError('O limite de credito deve ser maior que zero.');
        return;
      }

      if (!Number.isInteger(dataCorteNumber) || dataCorteNumber < 1 || dataCorteNumber > 31) {
        setError('Dia de corte deve estar entre 1 e 31.');
        return;
      }

      if (
        !Number.isInteger(dataPagamentoNumber) ||
        dataPagamentoNumber < 1 ||
        dataPagamentoNumber > 31
      ) {
        setError('Dia de pagamento deve estar entre 1 e 31.');
        return;
      }
    }

    try {
      setSaving(true);

      await updateConta(contaId, {
        nome: nome.trim(),
        ...(isCartaoCredito
          ? {
              limiteCredito: limiteCreditoNumber,
              dataCorte: dataCorteNumber,
              dataPagamento: dataPagamentoNumber,
            }
          : {}),
      });

      if (!draft.isCurrent(submitted)) return;

      draft.clear(submitted);

      router.replace('/contas');
    } catch (requestError) {
      if (!draft.isCurrent(submitted)) return;
      const resolvedError = await resolveApiError(
        requestError,
        'Nao foi possivel atualizar a conta.',
      );
      if (!draft.isCurrent(submitted)) return;
      setError(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (draft.isCurrent()) setSaving(false);
    }
  }

  return (
    <AppShell
      activeRoute="/contas"
      onProfilePress={() => router.push('/usuario' as never)}
      pageHeader={
        <FinanceAppHeader
          action={<GlassButton label="Cancelar" onPress={() => { draft.clear(); router.back(); }} variant="ghost" />}
          eyebrow="Gestao financeira"
          subtitle="Atualize os dados operacionais da conta."
          title="Editar conta"
        />
      }
    >
      {loadingConta ? (
        <GlassStatusCard
          title="Carregando conta"
          description="Estamos buscando os dados mais recentes."
          loading
        />
      ) : null}

      {!loadingConta && error && !conta ? (
        <GlassStatusCard
          title="Nao foi possivel carregar a conta"
          description={error}
          tone="error"
        />
      ) : null}

      {!loadingConta && conta ? (
        <GlassPanel>
          <Text style={styles.infoText}>Tipo: {conta.tipo}</Text>
          <Text style={styles.infoText}>Saldo inicial: {conta.saldoInicial}</Text>

          <GlassField label="Nome da conta">
            <GlassTextInput
              accessibilityLabel="Nome da conta"
              value={nome}
              onChangeText={setNome}
              placeholder="Ex.: Carteira principal"
              editable={!saving}
            />
          </GlassField>

          {isCartaoCredito ? (
            <>
              <GlassField label="Limite de credito">
                <GlassTextInput
                  accessibilityLabel="Limite de credito"
                  value={limiteCredito}
                  onChangeText={setLimiteCredito}
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  editable={!saving}
                />
              </GlassField>

              <View style={styles.row}>
                <View style={styles.half}>
                  <GlassField label="Dia corte">
                    <GlassTextInput
                      accessibilityLabel="Dia de corte"
                      value={dataCorte}
                      onChangeText={setDataCorte}
                      placeholder="1-31"
                      keyboardType="number-pad"
                      editable={!saving}
                    />
                  </GlassField>
                </View>
                <View style={styles.half}>
                  <GlassField label="Dia pagamento">
                    <GlassTextInput
                      accessibilityLabel="Dia de pagamento"
                      value={dataPagamento}
                      onChangeText={setDataPagamento}
                      placeholder="1-31"
                      keyboardType="number-pad"
                      editable={!saving}
                    />
                  </GlassField>
                </View>
              </View>
            </>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <GlassButton
            label={saving ? 'Salvando...' : 'Salvar alteracoes'}
            onPress={handleSave}
            disabled={saving || !conta}
          />
        </GlassPanel>
      ) : null}
    </AppShell>
  );
}

export default ContasEditScreen;

const styles = StyleSheet.create({
  errorText: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
  half: {
    flex: 1,
  },
  infoText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginBottom: FinanceTheme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
  },
});
