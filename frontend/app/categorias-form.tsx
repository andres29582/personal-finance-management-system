import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { AppButton } from '../components/app-button';
import { AppLoading } from '../components/app-loading';
import { AppMessage } from '../components/app-message';
import { AppOptionGroup } from '../components/app-option-group';
import { AppCard, AppField, AppScreen, appInputStyles } from '../components/app-screen';
import {
  createCategoria,
  getCategoriaById,
  updateCategoria,
} from '../services/categoriaService';
import { TipoCategoria } from '../types/categoria';
import { resolveApiError } from '../utils/api-error';

export default function CategoriaFormScreen() {
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
    return <AppLoading label="Carregando categoria..." />;
  }

  return (
    <AppScreen
      title={categoriaId ? 'Editar categoria' : 'Nova categoria'}
      actionLabel="Voltar"
      onActionPress={() => router.back()}
    >
      <AppCard>
        <AppField label="Nome">
          <TextInput
            style={appInputStyles.input}
            value={nome}
            onChangeText={setNome}
            placeholder="Ex.: Alimentacao"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>

        <AppField label="Tipo">
          <AppOptionGroup
            options={[
              { label: 'Despesa', value: 'despesa' },
              { label: 'Receita', value: 'receita' },
            ]}
            selectedValue={tipo}
            onChange={(value) => setTipo(value as TipoCategoria)}
          />
        </AppField>

        <AppField label="Cor">
          <TextInput
            style={appInputStyles.input}
            value={cor}
            onChangeText={setCor}
            placeholder="#0B6B34"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>

        <AppField label="Icone">
          <TextInput
            style={appInputStyles.input}
            value={icone}
            onChangeText={setIcone}
            placeholder="wallet"
            placeholderTextColor="#8A8A8A"
          />
        </AppField>

        <AppMessage tone="error" value={message} />
        <AppButton
          label={saving ? 'Salvando...' : 'Salvar categoria'}
          onPress={handleSave}
          disabled={saving}
        />
      </AppCard>
    </AppScreen>
  );
}
