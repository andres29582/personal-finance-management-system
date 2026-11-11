import { useFinancialDraft } from "../../../shared/hooks/useFinancialDraft";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  AppShell,
  FinanceAppHeader,
  GlassButton,
  GlassField,
  GlassOptionGroup,
  GlassPanel,
  GlassTextInput,
} from "../../../shared/ui";
import { FinanceTheme } from "../../../shared/styles/financeTheme";
import {
  createCategoria,
  getCategoriaById,
  updateCategoria,
} from "../services/categoriaService";
import { TipoCategoria } from "../types/categoria";
import { resolveApiError } from "../../../../utils/api-error";

export function CategoriaFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const categoriaId = Array.isArray(params.id) ? params.id[0] : params.id;
  const draft = useFinancialDraft("category/" + (categoriaId ?? "new"), {
    nome: "",
    tipo: "despesa" as TipoCategoria,
  });
  const nome = draft.fields.nome;
  const setNome = (value: string) => draft.setField("nome", value);
  const tipo = draft.fields.tipo;
  const setTipo = (value: TipoCategoria) => draft.setField("tipo", value);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(!!categoriaId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadCategoria() {
      const loadScope = draft.capture();
      if (!draft.isCurrent(loadScope)) return;
      if (!categoriaId) {
        return;
      }

      try {
        setLoading(true);
        const categoria = await getCategoriaById(categoriaId);
        if (!draft.isCurrent(loadScope)) return;
        draft.hydrate({ nome: categoria.nome, tipo: categoria.tipo });
      } catch (error) {
        if (!draft.isCurrent(loadScope)) return;
        const resolvedError = await resolveApiError(
          error,
          "Nao foi possivel carregar a categoria.",
        );
        if (!draft.isCurrent(loadScope)) return;
        setMessage(resolvedError.message);
      } finally {
        if (draft.isCurrent()) setLoading(false);
      }
    }

    loadCategoria();
  }, [categoriaId]);

  async function handleSave() {
    const submitted = draft.capture();
    if (!draft.isCurrent(submitted)) return;
    if (!nome.trim()) {
      setMessage("Informe um nome para a categoria.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const payload = {
        nome: nome.trim(),
        tipo,
      };

      if (categoriaId) {
        await updateCategoria(categoriaId, { nome: payload.nome });
      } else {
        await createCategoria(payload);
      }

      if (!draft.isCurrent(submitted)) return;

      draft.clear(submitted);

      router.replace("/categorias" as never);
    } catch (error) {
      if (!draft.isCurrent(submitted)) return;
      const resolvedError = await resolveApiError(
        error,
        "Nao foi possivel salvar a categoria.",
      );
      if (!draft.isCurrent(submitted)) return;
      setMessage(resolvedError.message);
    } finally {
      if (draft.isCurrent()) setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        activeRoute="/categorias"
        onProfilePress={() => router.push("/usuario" as never)}
        pageHeader={
          <FinanceAppHeader
            eyebrow="Classificacao"
            subtitle="Carregando dados da categoria."
            title="Categorias"
          />
        }
      >
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>Carregando categoria...</Text>
          </View>
        </GlassPanel>
      </AppShell>
    );
  }

  return (
    <AppShell
      activeRoute="/categorias"
      onProfilePress={() => router.push("/usuario" as never)}
      pageHeader={
        <FinanceAppHeader
          action={
            <GlassButton
              label="Voltar"
              onPress={() => {
                draft.clear();
                router.back();
              }}
              variant="ghost"
            />
          }
          eyebrow="Classificacao"
          subtitle="Defina como suas receitas e despesas serao agrupadas."
          title={categoriaId ? "Editar categoria" : "Nova categoria"}
        />
      }
    >
      <GlassPanel>
        <GlassField label="Nome">
          <GlassTextInput
            accessibilityLabel="Nome da categoria"
            value={nome}
            onChangeText={setNome}
            placeholder="Ex.: Alimentacao"
          />
        </GlassField>

        <GlassField label="Tipo">
          {categoriaId ? (
            <Text style={styles.loadingText}>
              O tipo e definido na criacao. Para trocar, crie outra categoria.
            </Text>
          ) : (
            <GlassOptionGroup
              options={[
                { label: "Despesa", value: "despesa" },
                { label: "Receita", value: "receita" },
              ]}
              value={tipo}
              onChange={(value) => setTipo(value as TipoCategoria)}
            />
          )}
        </GlassField>

        {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
        <GlassButton
          label={saving ? "Salvando..." : "Salvar categoria"}
          onPress={handleSave}
          disabled={saving}
        />
      </GlassPanel>
    </AppShell>
  );
}

export default CategoriaFormScreen;

const styles = StyleSheet.create({
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: "700",
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: "center",
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: FinanceTheme.spacing.sm,
  },
  loadingText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: "700",
  },
});
