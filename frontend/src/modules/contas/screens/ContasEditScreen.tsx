import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
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
import { getContaById, updateConta } from '../services/contaService';
import { Conta } from '../types/conta';
import { resolveApiError } from '../../../../utils/api-error';
import { parseDecimalInput } from '../../../../utils/number-input';

export function ContasEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const contaId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [conta, setConta] = useState<Conta | null>(null);
  const [nome, setNome] = useState('');
  const [limiteCredito, setLimiteCredito] = useState('');
  const [dataCorte, setDataCorte] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');
  const [loadingConta, setLoadingConta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadConta() {
      if (!contaId) {
        setError('Conta invalida.');
        setLoadingConta(false);
        return;
      }

      try {
        setLoadingConta(true);
        const data = await getContaById(contaId);
        setConta(data);
        setNome(data.nome);
        setLimiteCredito(data.limiteCredito != null ? String(data.limiteCredito) : '');
        setDataCorte(data.dataCorte != null ? String(data.dataCorte) : '');
        setDataPagamento(data.dataPagamento != null ? String(data.dataPagamento) : '');
      } catch (requestError: any) {
        const resolvedError = await resolveApiError(
          requestError,
          'Nao foi possivel carregar a conta.',
        );
        setError(resolvedError.message);
      } finally {
        setLoadingConta(false);
      }
    }

    loadConta();
  }, [contaId]);

  const isCartaoCredito = conta?.tipo === 'cartao_credito';

  async function handleSave() {
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

      router.replace('/contas');
    } catch (requestError: any) {
      const resolvedError = await resolveApiError(
        requestError,
        'Nao foi possivel atualizar a conta.',
      );
      setError(resolvedError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loadingConta ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={ContaTheme.colors.primary} />
            <Text style={styles.helperText}>Carregando conta...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Editar conta</Text>
              <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
                <Text style={styles.headerButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.infoText}>Tipo: {conta?.tipo ?? '-'}</Text>
              <Text style={styles.infoText}>Saldo inicial: {conta?.saldoInicial ?? 0}</Text>

              <Text style={styles.label}>Nome da conta</Text>
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Ex.: Carteira principal"
                placeholderTextColor="#8A8A8A"
                editable={!saving}
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
                    editable={!saving}
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
                        editable={!saving}
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
                        editable={!saving}
                      />
                    </View>
                  </View>
                </>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving || !conta}
              >
                <Text style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Salvar alteracoes'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default ContasEditScreen;

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
  centerBox: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: ContaTheme.spacing.lg,
  },
  helperText: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.body,
    marginTop: ContaTheme.spacing.sm,
    textAlign: 'center',
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
  infoText: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    marginBottom: ContaTheme.spacing.xs,
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
