import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { financeSidebarItems } from '../../../shared/navigation/financeNavigation';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  FinanceAppHeader,
  FinanceAppShell,
  GlassButton,
  GlassField,
  GlassOptionGroup,
  GlassPanel,
  GlassTextInput,
} from '../../../shared/ui';
import { resolveApiError } from '../../../../utils/api-error';
import { createPlanejamento } from '../services/planejamentoService';
import { PlanejamentoTipo } from '../types/planejamento';

const tipoOptions: { label: string; value: PlanejamentoTipo }[] = [
  { label: 'Casa', value: 'CASA' },
  { label: 'Festa', value: 'FESTA' },
  { label: 'Viagem', value: 'VIAGEM' },
  { label: 'Evento', value: 'EVENTO' },
  { label: 'Grupo', value: 'GRUPO' },
  { label: 'Outro', value: 'OUTRO' },
];

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateInput(value: string) {
  if (!value) {
    return true;
  }

  if (!isoDatePattern.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
}

export function PlanejamentoFormScreen() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState<PlanejamentoTipo>('CASA');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmedNome = nome.trim();
    const trimmedDescricao = descricao.trim();
    const trimmedDataInicio = dataInicio.trim();
    const trimmedDataFim = dataFim.trim();

    if (!trimmedNome) {
      setMessage('Informe o nome do planejamento.');
      return;
    }

    if (!isValidDateInput(trimmedDataInicio)) {
      setMessage('Data inicial deve estar no formato YYYY-MM-DD.');
      return;
    }

    if (!isValidDateInput(trimmedDataFim)) {
      setMessage('Data final deve estar no formato YYYY-MM-DD.');
      return;
    }

    if (
      trimmedDataInicio &&
      trimmedDataFim &&
      trimmedDataFim < trimmedDataInicio
    ) {
      setMessage('A data final deve ser maior ou igual a data inicial.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      const planejamento = await createPlanejamento({
        nome: trimmedNome,
        tipo,
        ...(trimmedDescricao ? { descricao: trimmedDescricao } : {}),
        ...(trimmedDataInicio ? { dataInicio: trimmedDataInicio } : {}),
        ...(trimmedDataFim ? { dataFim: trimmedDataFim } : {}),
      });

      router.replace({
        pathname: '/planejamentos-detail',
        params: { id: planejamento.id },
      } as never);
    } catch (error) {
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel criar o planejamento.',
      );
      setMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <FinanceAppShell
      activeRoute="/planejamentos"
      header={
        <FinanceAppHeader
          action={
            <GlassButton
              label="Cancelar"
              onPress={() => router.back()}
              variant="ghost"
            />
          }
          eyebrow="Planejamento compartilhado"
          subtitle="Crie o espaco inicial para organizar despesas em grupo."
          title="Novo planejamento"
        />
      }
      onNavigate={(route) => router.push(route as never)}
      sidebarItems={financeSidebarItems}
    >
      <GlassPanel>
        <GlassField label="Nome">
          <GlassTextInput
            editable={!saving}
            maxLength={150}
            onChangeText={setNome}
            placeholder="Ex.: Viagem de ferias"
            value={nome}
          />
        </GlassField>

        <GlassField label="Tipo">
          <GlassOptionGroup
            options={tipoOptions}
            value={tipo}
            onChange={setTipo}
          />
        </GlassField>

        <GlassField label="Descricao">
          <GlassTextInput
            editable={!saving}
            maxLength={500}
            multiline
            onChangeText={setDescricao}
            placeholder="Contexto, combinados ou observacoes"
            style={styles.textArea}
            value={descricao}
          />
        </GlassField>

        <View style={styles.row}>
          <View style={styles.half}>
            <GlassField label="Data inicial">
              <GlassTextInput
                editable={!saving}
                maxLength={10}
                onChangeText={setDataInicio}
                placeholder="YYYY-MM-DD"
                value={dataInicio}
              />
            </GlassField>
          </View>
          <View style={styles.half}>
            <GlassField label="Data final">
              <GlassTextInput
                editable={!saving}
                maxLength={10}
                onChangeText={setDataFim}
                placeholder="YYYY-MM-DD"
                value={dataFim}
              />
            </GlassField>
          </View>
        </View>

        {message ? <Text style={styles.errorMessage}>{message}</Text> : null}

        <GlassButton
          disabled={saving}
          label={saving ? 'Salvando...' : 'Criar planejamento'}
          onPress={handleSave}
        />
      </GlassPanel>
    </FinanceAppShell>
  );
}

export default PlanejamentoFormScreen;

const styles = StyleSheet.create({
  errorMessage: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
    marginBottom: FinanceTheme.spacing.sm,
    textAlign: 'center',
  },
  half: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
  },
  textArea: {
    minHeight: 96,
    paddingTop: FinanceTheme.spacing.sm,
    textAlignVertical: 'top',
  },
});
