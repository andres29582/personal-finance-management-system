import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { createConta } from '../services/contaService';
import { TipoConta } from '../types/conta';

const contaTipos: { value: TipoConta; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'banco', label: 'Banco' },
  { value: 'poupanca', label: 'Poupanca' },
  { value: 'cartao_credito', label: 'Cartao credito' },
];

export function ContasCreateScreen() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoConta>('dinheiro');
  const [saldoInicial, setSaldoInicial] = useState('');
  const [limiteCredito, setLimiteCredito] = useState('');
  const [dataCorte, setDataCorte] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isCartaoCredito = useMemo(() => tipo === 'cartao_credito', [tipo]);

  async function handleSubmit() {
    setError('');

    if (!nome.trim()) {
      setError('Informe o nome da conta.');
      return;
    }

    const saldoInicialNumber = parseDecimalInput(saldoInicial);

    if (!Number.isFinite(saldoInicialNumber)) {
      setError('Informe um saldo inicial valido.');
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
      setLoading(true);

      await createConta({
        nome: nome.trim(),
        tipo,
        saldoInicial: saldoInicialNumber,
        ...(isCartaoCredito
          ? {
              limiteCredito: limiteCreditoNumber,
              dataCorte: dataCorteNumber,
              dataPagamento: dataPagamentoNumber,
            }
          : {}),
      });

      router.replace('/contas');
    } catch (requestError) {
      const resolvedError = await resolveApiError(
        requestError,
        'Nao foi possivel criar a conta.',
      );
      setError(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <FinanceAppShell
      activeRoute="/contas"
      header={
        <FinanceAppHeader
          action={<GlassButton label="Cancelar" onPress={() => router.back()} variant="ghost" />}
          eyebrow="Gestao financeira"
          subtitle="Cadastre uma conta para movimentar receitas, despesas e transferencias."
          title="Nova conta"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      <GlassPanel>
        <GlassField label="Nome da conta">
          <GlassTextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Ex.: Carteira"
            editable={!loading}
          />
        </GlassField>

        <GlassField label="Tipo">
          <GlassOptionGroup
            options={contaTipos}
            value={tipo}
            onChange={(value) => setTipo(value as TipoConta)}
          />
        </GlassField>

        <GlassField label="Saldo inicial (R$)">
          <GlassTextInput
            value={saldoInicial}
            onChangeText={setSaldoInicial}
            placeholder="0,00"
            keyboardType="decimal-pad"
            editable={!loading}
          />
        </GlassField>

        {isCartaoCredito ? (
          <>
            <GlassField label="Limite de credito">
              <GlassTextInput
                value={limiteCredito}
                onChangeText={setLimiteCredito}
                placeholder="0,00"
                keyboardType="decimal-pad"
                editable={!loading}
              />
            </GlassField>

            <View style={styles.row}>
              <View style={styles.half}>
                <GlassField label="Dia corte">
                  <GlassTextInput
                    value={dataCorte}
                    onChangeText={setDataCorte}
                    placeholder="1-31"
                    keyboardType="number-pad"
                    editable={!loading}
                  />
                </GlassField>
              </View>
              <View style={styles.half}>
                <GlassField label="Dia pagamento">
                  <GlassTextInput
                    value={dataPagamento}
                    onChangeText={setDataPagamento}
                    placeholder="1-31"
                    keyboardType="number-pad"
                    editable={!loading}
                  />
                </GlassField>
              </View>
            </View>
          </>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <GlassButton
          label={loading ? 'Salvando...' : 'Salvar conta'}
          onPress={handleSubmit}
          disabled={loading}
        />
      </GlassPanel>
    </FinanceAppShell>
  );
}

export default ContasCreateScreen;

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
  row: {
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
  },
});
