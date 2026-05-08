import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ContaTheme } from '../../../../constants/contas-theme';
import { createConta } from '../services/contaService';
import { TipoConta } from '../types/conta';
import { resolveApiError } from '../../../../utils/api-error';
import { parseDecimalInput } from '../../../../utils/number-input';

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
    } catch (requestError: any) {
      const resolvedError = await resolveApiError(
        requestError,
        'Nao foi possivel criar a conta.',
      );
      setError(resolvedError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Nova conta</Text>
            <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
              <Text style={styles.headerButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Nome da conta</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Ex.: Carteira"
              placeholderTextColor="#8A8A8A"
              editable={!loading}
            />

            <Text style={styles.label}>Tipo</Text>
            <View style={styles.tipoGrid}>
              {contaTipos.map((item) => {
                const selected = item.value === tipo;

                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.tipoButton, selected && styles.tipoButtonSelected]}
                    onPress={() => setTipo(item.value)}
                    disabled={loading}
                  >
                    <Text style={[styles.tipoText, selected && styles.tipoTextSelected]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Saldo inicial (R$)</Text>
            <TextInput
              style={styles.input}
              value={saldoInicial}
              onChangeText={setSaldoInicial}
              placeholder="0,00"
              placeholderTextColor="#8A8A8A"
              keyboardType="decimal-pad"
              editable={!loading}
            />

            {isCartaoCredito ? (
              <>
                <Text style={styles.label}>Limite de credito</Text>
                <TextInput
                  style={styles.input}
                  value={limiteCredito}
                  onChangeText={setLimiteCredito}
                  placeholder="0,00"
                  placeholderTextColor="#8A8A8A"
                  keyboardType="decimal-pad"
                  editable={!loading}
                />

                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.label}>Dia corte</Text>
                    <TextInput
                      style={styles.input}
                      value={dataCorte}
                      onChangeText={setDataCorte}
                      placeholder="1-31"
                      placeholderTextColor="#8A8A8A"
                      keyboardType="number-pad"
                      editable={!loading}
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>Dia pagamento</Text>
                    <TextInput
                      style={styles.input}
                      value={dataPagamento}
                      onChangeText={setDataPagamento}
                      placeholder="1-31"
                      placeholderTextColor="#8A8A8A"
                      keyboardType="number-pad"
                      editable={!loading}
                    />
                  </View>
                </View>
              </>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>{loading ? 'Salvando...' : 'Salvar conta'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default ContasCreateScreen;

const styles = StyleSheet.create({
  screen: {
    backgroundColor: ContaTheme.colors.screenBg,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: ContaTheme.spacing.lg,
    paddingBottom: ContaTheme.spacing.xl,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: ContaTheme.spacing.md,
  },
  title: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.heading,
    fontWeight: '700',
  },
  headerButton: {
    borderColor: ContaTheme.colors.border,
    borderRadius: ContaTheme.radius.md,
    borderWidth: 1,
    paddingHorizontal: ContaTheme.spacing.md,
    paddingVertical: ContaTheme.spacing.xs,
  },
  headerButtonText: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    fontWeight: '600',
  },
  card: {
    backgroundColor: ContaTheme.colors.surface,
    borderColor: ContaTheme.colors.border,
    borderRadius: ContaTheme.radius.lg,
    borderWidth: 1,
    padding: ContaTheme.spacing.md,
  },
  label: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.caption,
    fontWeight: '700',
    marginBottom: ContaTheme.spacing.xs,
    marginTop: ContaTheme.spacing.sm,
  },
  input: {
    backgroundColor: '#FAFAFA',
    borderColor: ContaTheme.colors.border,
    borderRadius: ContaTheme.radius.md,
    borderWidth: 1,
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    height: 48,
    paddingHorizontal: ContaTheme.spacing.sm,
  },
  tipoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ContaTheme.spacing.xs,
  },
  tipoButton: {
    backgroundColor: '#EDF5ED',
    borderColor: ContaTheme.colors.border,
    borderRadius: ContaTheme.radius.md,
    borderWidth: 1,
    paddingHorizontal: ContaTheme.spacing.sm,
    paddingVertical: ContaTheme.spacing.xs,
  },
  tipoButtonSelected: {
    backgroundColor: ContaTheme.colors.primary,
    borderColor: ContaTheme.colors.primary,
  },
  tipoText: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    fontWeight: '600',
  },
  tipoTextSelected: {
    color: ContaTheme.colors.white,
  },
  row: {
    flexDirection: 'row',
    gap: ContaTheme.spacing.sm,
  },
  half: {
    flex: 1,
  },
  errorText: {
    color: ContaTheme.colors.error,
    fontSize: ContaTheme.typography.caption,
    fontWeight: '600',
    marginTop: ContaTheme.spacing.md,
    textAlign: 'center',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: ContaTheme.colors.primary,
    borderRadius: ContaTheme.radius.md,
    height: 50,
    justifyContent: 'center',
    marginTop: ContaTheme.spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: ContaTheme.colors.white,
    fontSize: ContaTheme.typography.button,
    fontWeight: '700',
  },
});
