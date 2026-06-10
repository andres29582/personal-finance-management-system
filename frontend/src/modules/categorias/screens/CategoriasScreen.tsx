import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassPanel,
  GlassStatusCard,
} from '../../../shared/ui';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { deactivateCategoria, listCategorias } from '../services/categoriaService';
import { Categoria } from '../types/categoria';
import { confirmAction } from '../../../../utils/confirm-action';
import { resolveApiError } from '../../../../utils/api-error';

const tipoLabel: Record<Categoria['tipo'], string> = {
  despesa: 'Despesa',
  receita: 'Receita',
};

export function CategoriasScreen() {
  const router = useRouter();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const loadCategorias = useCallback(async () => {
    try {
      setLoading(true);
      setMessage('');
      const data = await listCategorias();
      setCategorias(data);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel carregar as categorias.',
      );
      setMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadCategorias();
    }, [loadCategorias]),
  );

  async function handleDeactivate(id: string, nome: string) {
    const confirmed = await confirmAction(
      'Desativar categoria',
      `Deseja desativar ${nome}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeactivatingId(id);
      setMessage('');
      await deactivateCategoria(id);
      await loadCategorias();
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel desativar a categoria.',
      );
      setMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setDeactivatingId(null);
    }
  }

  return (
    <FinanceAppShell
      activeRoute="/categorias"
      header={
        <FinanceAppHeader
          action={
            <GlassButton
              label="Nova"
              onPress={() => router.push('/categorias-form' as never)}
            />
          }
          eyebrow="Classificacao"
          subtitle="Organize receitas e despesas por tipo."
          title="Categorias"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      <GlassPanel>
        <GlassButton label="Atualizar lista" onPress={loadCategorias} variant="ghost" />
      </GlassPanel>

      {message && categorias.length ? (
        <Text style={styles.errorMessage}>{message}</Text>
      ) : null}

      {loading && !categorias.length ? (
        <GlassStatusCard
          title="Carregando categorias"
          description="Estamos buscando as categorias cadastradas."
          loading
        />
      ) : null}

      {!loading && !!message && !categorias.length ? (
        <GlassStatusCard
          title="Nao foi possivel carregar as categorias"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadCategorias}
        />
      ) : null}

      {!loading && !message && !categorias.length ? (
        <GlassStatusCard
          title="Nenhuma categoria cadastrada"
          description="Crie categorias para classificar receitas e despesas."
          actionLabel="Nova categoria"
          onActionPress={() => router.push('/categorias-form' as never)}
        />
      ) : null}

      {!loading && categorias.length ? (
        categorias.map((categoria) => (
          <GlassPanel key={categoria.id} accent={categoria.tipo === 'receita' ? 'cyan' : 'magenta'}>
            <View style={styles.cardTop}>
              <Text style={styles.title}>{categoria.nome}</Text>
              <View
                style={[
                  styles.badge,
                  categoria.tipo === 'receita' ? styles.badgeIncome : styles.badgeExpense,
                ]}
              >
                <Text style={styles.badgeText}>{tipoLabel[categoria.tipo]}</Text>
              </View>
            </View>
            <Text style={styles.meta}>Cor: {categoria.cor || '-'}</Text>
            <Text style={styles.meta}>Icone: {categoria.icone || '-'}</Text>
            <View style={styles.actions}>
              <View style={styles.actionCell}>
                <GlassButton
                  label="Editar"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: '/categorias-form',
                      params: { id: categoria.id },
                    } as never)
                  }
                  disabled={deactivatingId === categoria.id}
                />
              </View>
              <View style={styles.actionCell}>
                <GlassButton
                  label={deactivatingId === categoria.id ? 'Desativando...' : 'Desativar'}
                  variant="danger"
                  onPress={() => handleDeactivate(categoria.id, categoria.nome)}
                  disabled={deactivatingId === categoria.id}
                />
              </View>
            </View>
          </GlassPanel>
        ))
      ) : null}
    </FinanceAppShell>
  );
}

export default CategoriasScreen;

const styles = StyleSheet.create({
  actionCell: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    marginTop: FinanceTheme.spacing.md,
  },
  badge: {
    borderRadius: 999,
    borderWidth: FinanceTheme.borderWidth.hairline,
    paddingHorizontal: FinanceTheme.spacing.sm,
    paddingVertical: FinanceTheme.spacing.xxs,
  },
  badgeExpense: {
    backgroundColor: FinanceTheme.colors.magentaSoft,
    borderColor: FinanceTheme.neon.magenta.borderColor,
  },
  badgeIncome: {
    backgroundColor: FinanceTheme.colors.cyanSoft,
    borderColor: FinanceTheme.neon.cyan.borderColor,
  },
  badgeText: {
    color: FinanceTheme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    justifyContent: 'space-between',
    marginBottom: FinanceTheme.spacing.xs,
  },
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
  meta: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xxs,
  },
  title: {
    color: FinanceTheme.colors.text,
    flex: 1,
    fontSize: FinanceTheme.typography.body,
    fontWeight: '800',
  },
});
