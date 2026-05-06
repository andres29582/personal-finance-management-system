import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton } from "../components/app-button";
import { AppMessage } from "../components/app-message";
import {
  AppCard,
  AppField,
  AppScreen,
  AppStatusCard,
  appInputStyles,
} from "../components/app-screen";
import { ContaTheme } from "../constants/contas-theme";
import { getPrevisaoDeficit } from "../services/previsaoService";
import {
  DeficitFeatures,
  PrevisaoDeficitResponse,
  RiscoDeficit,
} from "../types/previsao";
import { resolveApiError } from "../utils/api-error";
import { formatCurrency, getCurrentMonthReference } from "../utils/formatters";

type FeatureRow = {
  format: "currency" | "integer" | "number";
  key: keyof DeficitFeatures;
  label: string;
};

const featureRows: FeatureRow[] = [
  { key: "receita_mes", label: "Receita do mes", format: "currency" },
  { key: "despesa_mes", label: "Despesa do mes", format: "currency" },
  {
    key: "saldo_inicial_mes",
    label: "Saldo inicial do mes",
    format: "currency",
  },
  {
    key: "num_transacoes_despesa",
    label: "Transacoes de despesa",
    format: "integer",
  },
  {
    key: "num_transacoes_receita",
    label: "Transacoes de receita",
    format: "integer",
  },
  {
    key: "volatilidade_despesa",
    label: "Volatilidade da despesa",
    format: "number",
  },
];

const riskLabels: Record<RiscoDeficit, string> = {
  alto: "Alto",
  baixo: "Baixo",
  moderado: "Moderado",
};

export default function PrevisaoDeficitScreen() {
  const router = useRouter();
  const [mes, setMes] = useState(getCurrentMonthReference());
  const [previsao, setPrevisao] = useState<PrevisaoDeficitResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const primeiraCargaRef = useRef(false);

  const handleGenerate = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      const data = await getPrevisaoDeficit(mes);
      setPrevisao(data);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        "Nao foi possivel gerar a previsao.",
      );
      setMessage(resolvedError.message);
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    if (primeiraCargaRef.current) {
      return;
    }

    primeiraCargaRef.current = true;
    void handleGenerate();
  }, [handleGenerate]);

  const probabilityLabel = useMemo(() => {
    if (!previsao) {
      return "-";
    }

    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 1,
      style: "percent",
    }).format(previsao.probability);
  }, [previsao]);

  return (
    <AppScreen
      title="Previsao de deficit"
      subtitle="Analise mensal com Machine Learning"
      backLabel="Voltar"
      onBackPress={() => router.replace("/dashboard" as never)}
    >
      <AppCard>
        <AppField label="Mes (YYYY-MM)">
          <TextInput
            style={appInputStyles.input}
            value={mes}
            onChangeText={setMes}
            placeholder="2026-05"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>

        <AppButton
          disabled={loading}
          label={loading ? "Gerando..." : "Gerar previsao"}
          onPress={handleGenerate}
          variant="ghost"
        />
      </AppCard>

      {message && previsao ? <AppMessage tone="error" value={message} /> : null}

      {loading && !previsao ? (
        <AppStatusCard
          title="Gerando previsao"
          description="Estamos calculando os dados do mes selecionado."
          loading
        />
      ) : null}

      {!loading && !!message && !previsao ? (
        <AppStatusCard
          title="Nao foi possivel gerar a previsao"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={handleGenerate}
        />
      ) : null}

      {previsao ? (
        <>
          <AppCard>
            <View style={styles.resultHeader}>
              <View style={styles.resultTextBox}>
                <Text style={styles.sectionTitle}>Resultado</Text>
                <Text style={styles.resultMessage}>{previsao.mensagem}</Text>
              </View>
              <View style={[styles.riskBadge, riskBadgeStyles[previsao.risco]]}>
                <Text style={[styles.riskText, riskTextStyles[previsao.risco]]}>
                  {riskLabels[previsao.risco]}
                </Text>
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
                  {previsao.deficitPrevisto ? "Deficit" : "Sem deficit"}
                </Text>
              </View>
            </View>
          </AppCard>

          <AppCard>
            <Text style={styles.sectionTitle}>Dados do modelo</Text>
            <Text style={styles.periodText}>
              Periodo: {previsao.mesReferencia}
            </Text>
            {featureRows.map((row) => (
              <View key={row.key} style={styles.featureRow}>
                <Text style={styles.featureLabel}>{row.label}</Text>
                <Text style={styles.featureValue}>
                  {formatFeatureValue(previsao.features[row.key], row.format)}
                </Text>
              </View>
            ))}
          </AppCard>
        </>
      ) : null}
    </AppScreen>
  );
}

function formatFeatureValue(
  value: number,
  format: FeatureRow["format"],
): string {
  if (format === "currency") {
    return formatCurrency(value);
  }

  if (format === "integer") {
    return Math.trunc(value).toString();
  }

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 4,
  }).format(value);
}

const styles = StyleSheet.create({
  featureLabel: {
    color: ContaTheme.colors.title,
    flex: 1,
    fontSize: ContaTheme.typography.body,
    fontWeight: "600",
    marginRight: ContaTheme.spacing.sm,
  },
  featureRow: {
    alignItems: "center",
    borderBottomColor: ContaTheme.colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: ContaTheme.spacing.sm,
  },
  featureValue: {
    color: ContaTheme.colors.primaryStrong,
    fontSize: ContaTheme.typography.body,
    fontWeight: "700",
    textAlign: "right",
  },
  metricBox: {
    backgroundColor: "#F6FBF4",
    borderColor: ContaTheme.colors.border,
    borderRadius: ContaTheme.radius.md,
    borderWidth: 1,
    flex: 1,
    minWidth: 140,
    padding: ContaTheme.spacing.sm,
  },
  metricLabel: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    fontWeight: "600",
  },
  metricValue: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.heading,
    fontWeight: "700",
    marginTop: ContaTheme.spacing.xs,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: ContaTheme.spacing.sm,
    marginTop: ContaTheme.spacing.md,
  },
  periodText: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    marginBottom: ContaTheme.spacing.xs,
  },
  resultHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resultMessage: {
    color: ContaTheme.colors.text,
    fontSize: ContaTheme.typography.body,
    marginTop: ContaTheme.spacing.xs,
  },
  resultTextBox: {
    flex: 1,
    marginRight: ContaTheme.spacing.sm,
  },
  riskBadge: {
    borderRadius: ContaTheme.radius.md,
    borderWidth: 1,
    paddingHorizontal: ContaTheme.spacing.sm,
    paddingVertical: ContaTheme.spacing.xs,
  },
  riskText: {
    fontSize: ContaTheme.typography.caption,
    fontWeight: "700",
  },
  sectionTitle: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    fontWeight: "700",
  },
});

const riskBadgeStyles = StyleSheet.create({
  alto: {
    backgroundColor: "#FCE9E8",
    borderColor: "#F3C0BE",
  },
  baixo: {
    backgroundColor: "#EFF8EF",
    borderColor: "#CBE3CD",
  },
  moderado: {
    backgroundColor: "#FFF6D8",
    borderColor: "#E6D389",
  },
});

const riskTextStyles = StyleSheet.create({
  alto: {
    color: ContaTheme.colors.error,
  },
  baixo: {
    color: ContaTheme.colors.success,
  },
  moderado: {
    color: "#7A5B00",
  },
});
