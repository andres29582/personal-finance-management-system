import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { AppButton } from '../../../../components/app-button';
import {
  AppCard,
  AppField,
  AppScreen,
  AppStatusCard,
  appInputStyles,
} from '../../../../components/app-screen';
import { AppMessage } from '../../../../components/app-message';
import { ContaTheme } from '../../../../constants/contas-theme';
import { resolveApiError } from '../../../../utils/api-error';
import { formatCurrency } from '../../../../utils/formatters';
import { listOrcamentos } from '../services/orcamentoService';
import { Orcamento } from '../types/orcamento';

export function OrcamentosScreen() {
  const router = useRouter();
  const [ano, setAno] = useState(new Date().getFullYear().toString());
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadOrcamentos = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      const data = await listOrcamentos(ano);
      setOrcamentos(data);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel carregar os orcamentos.',
      );
      setMessage(resolvedError.message);
    } finally {
      setLoading(false);
    }
  }, [ano]);

  useFocusEffect(
    useCallback(() => {
      loadOrcamentos();
    }, [loadOrcamentos]),
  );

  return (
    <AppScreen
      title="Orcamentos"
      subtitle="Controle o teto mensal de despesas."
      backLabel="Voltar"
      onBackPress={() => router.replace('/dashboard' as never)}
      actionLabel="Novo"
      onActionPress={() => router.push('/orcamentos-form' as never)}
    >
      <AppCard>
        <AppField label="Ano">
          <TextInput
            style={appInputStyles.input}
            value={ano}
            onChangeText={setAno}
            placeholder="2026"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>
        <AppButton label="Atualizar" onPress={loadOrcamentos} variant="ghost" />
      </AppCard>

      {message && orcamentos.length ? <AppMessage tone="error" value={message} /> : null}

      {loading && !orcamentos.length ? (
        <AppStatusCard
          title="Carregando orcamentos"
          description="Estamos buscando os orcamentos do ano selecionado."
          loading
        />
      ) : null}

      {!loading && !!message && !orcamentos.length ? (
        <AppStatusCard
          title="Nao foi possivel carregar os orcamentos"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadOrcamentos}
        />
      ) : null}

      {!loading && !message && !orcamentos.length ? (
        <AppStatusCard
          title="Nenhum orcamento encontrado"
          description="Crie um orcamento mensal para acompanhar o limite de gastos."
          actionLabel="Novo orcamento"
          onActionPress={() => router.push('/orcamentos-form' as never)}
        />
      ) : null}

      {!loading && orcamentos.length ? (
        orcamentos.map((orcamento) => (
          <AppCard key={orcamento.id}>
            <Text style={styles.title}>{orcamento.mesReferencia}</Text>
            <Text style={styles.meta}>
              Planejado: {formatCurrency(orcamento.valorPlanejado)}
            </Text>
            <Text style={styles.meta}>Gasto atual: {formatCurrency(orcamento.gastoAtual)}</Text>
            <Text style={styles.meta}>Utilizado: {orcamento.percentualUtilizado}%</Text>
            <Text style={styles.meta}>Status: {orcamento.statusAlerta}</Text>
            <AppButton
              label="Editar"
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: '/orcamentos-form',
                  params: { id: orcamento.id },
                } as never)
              }
            />
          </AppCard>
        ))
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  meta: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    marginTop: ContaTheme.spacing.xxs,
  },
  title: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    fontWeight: '700',
    marginBottom: ContaTheme.spacing.sm,
  },
});

export default OrcamentosScreen;
