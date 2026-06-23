import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassField,
  GlassPanel,
  GlassStatusCard,
  GlassTextInput,
} from '../../../shared/ui';
import { resolveApiError } from '../../../../utils/api-error';
import { formatCurrency, getCurrentMonthReference } from '../../../../utils/formatters';
import { getPrevisaoDeficit } from '../services/previsaoService';
import {
  PrevisaoIndicadores,
  PrevisaoDeficitResponse,
  RiscoDeficit,
} from '../types/previsao';

type FeatureRow = {
  format: 'currency' | 'integer' | 'number' | 'percent';
  key: keyof PrevisaoIndicadores;
  label: string;
};

const featureRows: FeatureRow[] = [
  {
    key: 'saldoInicialMes',
    label: 'Saldo inicial do mes',
    format: 'currency',
  },
  {
    key: 'mediaReceitas3Meses',
    label: 'Media de receitas (3 meses)',
    format: 'currency',
  },
  {
    key: 'mediaDespesas3Meses',
    label: 'Media de despesas (3 meses)',
    format: 'currency',
  },
  {
    key: 'tendenciaReceitas3Meses',
    label: 'Tendencia de receitas',
    format: 'currency',
  },
  {
    key: 'tendenciaDespesas3Meses',
    label: 'Tendencia de despesas',
    format: 'currency',
  },
  {
    key: 'taxaDeficit3Meses',
    label: 'Meses recentes com deficit',
    format: 'percent',
  },
  {
    key: 'historicoMeses',
    label: 'Meses completos analisados',
    format: 'integer',
  },
];

const riskLabels: Record<RiscoDeficit, string> = {
  alto: 'Alto',
  baixo: 'Baixo',
  moderado: 'Moderado',
};

export function PrevisaoDeficitScreen() {
  const router = useRouter();
  const [mes, setMes] = useState(getCurrentMonthReference());
  const [previsao, setPrevisao] = useState<PrevisaoDeficitResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const primeiraCargaRef = useRef(false);

  const handleGenerate = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      setPrevisao(null);
      const data = await getPrevisaoDeficit(mes);
      setPrevisao(data);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel gerar a previsao.',
      );
      setMessage(resolvedError.message);
      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [mes, router]);

  useEffect(() => {
    if (primeiraCargaRef.current) {
      return;
    }

    primeiraCargaRef.current = true;
    void handleGenerate();
  }, [handleGenerate]);

  const probabilityLabel = useMemo(() => {
    if (!previsao) {
      return '-';
    }

    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 1,
      style: 'percent',
    }).format(previsao.probability);
  }, [previsao]);

  return (
    <FinanceAppShell
      activeRoute="/previsao-deficit"
      header={
        <FinanceAppHeader
          eyebrow="Machine Learning"
          subtitle="Analise mensal de risco de deficit."
          title="Previsao de deficit"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      <GlassPanel>
        <GlassField label="Mes (YYYY-MM)">
          <GlassTextInput
            placeholder="2026-05"
            value={mes}
            onChangeText={setMes}
          />
        </GlassField>

        <GlassButton
          disabled={loading}
          label={loading ? 'Gerando...' : 'Gerar previsao'}
          onPress={handleGenerate}
          variant="ghost"
        />
      </GlassPanel>

      {message && previsao ? <Text style={styles.errorMessage}>{message}</Text> : null}

      {loading && !previsao ? (
        <GlassStatusCard
          title="Gerando previsao"
          description="Estamos calculando os dados do mes selecionado."
          loading
        />
      ) : null}

      {!loading && !!message && !previsao ? (
        <GlassStatusCard
          title="Nao foi possivel gerar a previsao"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={handleGenerate}
        />
      ) : null}

      {previsao ? (
        <>
          <GlassPanel accent={previsao.risco === 'baixo' ? 'cyan' : 'magenta'}>
            <View style={styles.resultHeader}>
              <View style={styles.resultTextBox}>
                <Text style={styles.sectionTitle}>Resultado</Text>
                <Text style={styles.resultMessage}>{previsao.mensagem}</Text>
              </View>
              <View style={[styles.riskBadge, riskBadgeStyles[previsao.risco]]}>
                <Text style={styles.riskText}>{riskLabels[previsao.risco]}</Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Probabilidade</Text>
                <Text style={styles.metricValue}>{probabilityLabel}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Classe prevista</Text>
                <Text style={styles.metricValue}>
                  {previsao.deficitPrevisto ? 'Deficit' : 'Sem deficit'}
                </Text>
              </View>
            </View>
          </GlassPanel>

          <GlassPanel>
            <Text style={styles.sectionTitle}>Dados do modelo</Text>
            <Text style={styles.periodText}>
              Periodo: {previsao.mesReferencia}
            </Text>
            {featureRows.map((row) => (
              <View key={row.key} style={styles.featureRow}>
                <Text style={styles.featureLabel}>{row.label}</Text>
                <Text style={styles.featureValue}>
                  {formatFeatureValue(
                    previsao.indicadores[row.key],
                    row.format,
                  )}
                </Text>
              </View>
            ))}
          </GlassPanel>
        </>
      ) : null}
    </FinanceAppShell>
  );
}

function formatFeatureValue(
  value: number,
  format: FeatureRow['format'],
): string {
  if (format === 'currency') {
    return formatCurrency(value);
  }

  if (format === 'integer') {
    return Math.trunc(value).toString();
  }

  if (format === 'percent') {
    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 1,
      style: 'percent',
    }).format(value);
  }

  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 4,
  }).format(value);
}

const styles = StyleSheet.create({
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
  featureLabel: {
    color: FinanceTheme.colors.text,
    flex: 1,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '700',
    marginRight: FinanceTheme.spacing.sm,
  },
  featureRow: {
    alignItems: 'center',
    borderBottomColor: FinanceTheme.colors.border,
    borderBottomWidth: FinanceTheme.borderWidth.hairline,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: FinanceTheme.spacing.sm,
  },
  featureValue: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
    textAlign: 'right',
  },
  metricBox: {
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flex: 1,
    minWidth: 150,
    padding: FinanceTheme.spacing.sm,
  },
  metricLabel: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
  metricValue: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.heading,
    fontWeight: '900',
    marginTop: FinanceTheme.spacing.xs,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
    marginTop: FinanceTheme.spacing.md,
  },
  periodText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginBottom: FinanceTheme.spacing.xs,
  },
  resultHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    justifyContent: 'space-between',
  },
  resultMessage: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    marginTop: FinanceTheme.spacing.xs,
  },
  resultTextBox: {
    flex: 1,
    minWidth: 0,
  },
  riskBadge: {
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xs,
  },
  riskText: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '900',
  },
  sectionTitle: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
  },
});

const riskBadgeStyles = StyleSheet.create({
  alto: {
    backgroundColor: 'rgba(255, 122, 144, 0.16)',
    borderColor: 'rgba(255, 122, 144, 0.42)',
  },
  baixo: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  moderado: {
    backgroundColor: 'rgba(255, 209, 102, 0.14)',
    borderColor: 'rgba(255, 209, 102, 0.36)',
  },
});

export default PrevisaoDeficitScreen;
