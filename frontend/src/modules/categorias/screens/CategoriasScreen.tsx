import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../../components/app-button';
import { AppMessage } from '../../../../components/app-message';
import { AppCard, AppScreen, AppStatusCard } from '../../../../components/app-screen';
import { ContaTheme } from '../../../../constants/contas-theme';
import { deactivateCategoria, listCategorias } from '../services/categoriaService';
import { Categoria } from '../types/categoria';
import { confirmAction } from '../../../../utils/confirm-action';
import { resolveApiError } from '../../../../utils/api-error';

export function CategoriasScreen() {
  const router = useRouter();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
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
      await deactivateCategoria(id);
      await loadCategorias();
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel desativar a categoria.',
      );
      setMessage(resolvedError.message);
    }
  }

  return (
    <AppScreen
      title="Categorias"
      subtitle="Organize receitas e despesas por tipo."
      backLabel="Voltar"
      onBackPress={() => router.replace('/dashboard' as never)}
      actionLabel="Nova"
      onActionPress={() => router.push('/categorias-form' as never)}
    >
      <AppCard>
        <AppButton label="Atualizar lista" onPress={loadCategorias} variant="ghost" />
      </AppCard>

      {message && categorias.length ? <AppMessage tone="error" value={message} /> : null}

      {loading && !categorias.length ? (
        <AppStatusCard
          title="Carregando categorias"
          description="Estamos buscando as categorias cadastradas."
          loading
        />
      ) : null}

      {!loading && !!message && !categorias.length ? (
        <AppStatusCard
          title="Nao foi possivel carregar as categorias"
          description={message}
          tone="error"
          actionLabel="Tentar novamente"
          onActionPress={loadCategorias}
        />
      ) : null}

      {!loading && !message && !categorias.length ? (
        <AppStatusCard
          title="Nenhuma categoria cadastrada"
          description="Crie categorias para classificar receitas e despesas."
          actionLabel="Nova categoria"
          onActionPress={() => router.push('/categorias-form' as never)}
        />
      ) : null}

      {!loading && categorias.length ? (
        categorias.map((categoria) => (
          <AppCard key={categoria.id}>
            <Text style={styles.title}>{categoria.nome}</Text>
            <Text style={styles.meta}>Tipo: {categoria.tipo}</Text>
            <Text style={styles.meta}>Cor: {categoria.cor || '-'}</Text>
            <View style={styles.actions}>
              <View style={styles.actionCell}>
                <AppButton
                  label="Editar"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: '/categorias-form',
                      params: { id: categoria.id },
                    } as never)
                  }
                />
              </View>
              <View style={styles.actionCell}>
                <AppButton
                  label="Desativar"
                  variant="danger"
                  onPress={() => handleDeactivate(categoria.id, categoria.nome)}
                />
              </View>
            </View>
          </AppCard>
        ))
      ) : null}
    </AppScreen>
  );
}

export default CategoriasScreen;

const styles = StyleSheet.create({
  actionCell: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: ContaTheme.spacing.sm,
    marginTop: ContaTheme.spacing.sm,
  },
  emptyText: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.body,
  },
  meta: {
    color: ContaTheme.colors.muted,
    fontSize: ContaTheme.typography.caption,
    marginTop: ContaTheme.spacing.xxs,
  },
  title: {
    color: ContaTheme.colors.title,
    fontSize: ContaTheme.typography.body,
    fontWeight: '700',
  },
});
