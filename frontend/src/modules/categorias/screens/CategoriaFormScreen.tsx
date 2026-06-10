import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassField,
  GlassOptionGroup,
  GlassPanel,
  GlassTextInput,
} from '../../../shared/ui';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import {
  createCategoria,
  getCategoriaById,
  updateCategoria,
} from '../services/categoriaService';
import { TipoCategoria } from '../types/categoria';
import { resolveApiError } from '../../../../utils/api-error';

export function CategoriaFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const categoriaId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoCategoria>('despesa');
  const [cor, setCor] = useState('');
  const [icone, setIcone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(!!categoriaId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadCategoria() {
      if (!categoriaId) {
        return;
      }

      try {
        setLoading(true);
        const categoria = await getCategoriaById(categoriaId);
        setNome(categoria.nome);
        setTipo(categoria.tipo);
        setCor(categoria.cor || '');
        setIcone(categoria.icone || '');
      } catch (error) {
        const resolvedError = await resolveApiError(
          error,
          'Nao foi possivel carregar a categoria.',
        );
        setMessage(resolvedError.message);
      } finally {
        setLoading(false);
      }
    }

    loadCategoria();
  }, [categoriaId]);

  async function handleSave() {
    if (!nome.trim()) {
      setMessage('Informe um nome para a categoria.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      const payload = {
        nome: nome.trim(),
        tipo,
        cor: cor.trim() || undefined,
        icone: icone.trim() || undefined,
      };

      if (categoriaId) {
        await updateCategoria(categoriaId, payload);
      } else {
        await createCategoria(payload);
      }

      router.replace('/categorias' as never);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel salvar a categoria.',
      );
      setMessage(resolvedError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <FinanceAppShell
        activeRoute="/categorias"
        header={
          <FinanceAppHeader
            eyebrow="Classificacao"
            subtitle="Carregando dados da categoria."
            title="Categorias"
          />
        }
        onNavigate={(route) => router.push(route as never)}
        sidebarItems={financeSidebarItems}
      >
        <GlassPanel>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={FinanceTheme.colors.cyan} />
            <Text style={styles.loadingText}>Carregando categoria...</Text>
          </View>
        </GlassPanel>
      </FinanceAppShell>
    );
  }

  return (
    <FinanceAppShell
      activeRoute="/categorias"
      header={
        <FinanceAppHeader
          action={
            <GlassButton
              label="Voltar"
              onPress={() => router.back()}
              variant="ghost"
            />
          }
          eyebrow="Classificacao"
          subtitle="Defina como suas receitas e despesas serao agrupadas."
          title={categoriaId ? 'Editar categoria' : 'Nova categoria'}
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      <GlassPanel>
        <GlassField label="Nome">
          <GlassTextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Ex.: Alimentacao"
          />
        </GlassField>

        <GlassField label="Tipo">
          <GlassOptionGroup
            options={[
              { label: 'Despesa', value: 'despesa' },
              { label: 'Receita', value: 'receita' },
            ]}
            value={tipo}
            onChange={(value) => setTipo(value as TipoCategoria)}
          />
        </GlassField>

        <GlassField label="Cor">
          <GlassTextInput
            value={cor}
            onChangeText={setCor}
            placeholder="#0B6B34"
            autoCapitalize="none"
          />
        </GlassField>

        <GlassField label="Icone">
          <GlassTextInput
            value={icone}
            onChangeText={setIcone}
            placeholder="wallet"
            autoCapitalize="none"
          />
        </GlassField>

        {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
        <GlassButton
          label={saving ? 'Salvando...' : 'Salvar categoria'}
          onPress={handleSave}
          disabled={saving}
        />
      </GlassPanel>
    </FinanceAppShell>
  );
}

export default CategoriaFormScreen;

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
