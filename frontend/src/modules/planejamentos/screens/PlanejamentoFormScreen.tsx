import { useFinancialDraft } from '../../../shared/hooks/useFinancialDraft';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FinanceTheme } from '../../../shared/styles/financeTheme';
import {
  AppShell,
  FinanceAppHeader,
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
  const draft = useFinancialDraft('planning/new', {
    nome: '',
    descricao: '',
    tipo: 'CASA' as PlanejamentoTipo,
    dataInicio: '',
    dataFim: '',
  });
  const nome = draft.fields.nome;
  const setNome = (value: string) => draft.setField('nome', value);
  const descricao = draft.fields.descricao;
  const setDescricao = (value: string) => draft.setField('descricao', value);
  const tipo = draft.fields.tipo;
  const setTipo = (value: PlanejamentoTipo) => draft.setField('tipo', value);
  const dataInicio = draft.fields.dataInicio;
  const setDataInicio = (value: string) => draft.setField('dataInicio', value);
  const dataFim = draft.fields.dataFim;
  const setDataFim = (value: string) => draft.setField('dataFim', value);





  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const submitted = draft.capture();
    if (!draft.isCurrent(submitted)) return;
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

      if (!draft.isCurrent(submitted)) return;

      draft.clear(submitted);

      router.replace({
        pathname: '/planejamentos-detail',
        params: { id: planejamento.id },
      } as never);
    } catch (error) {
      if (!draft.isCurrent(submitted)) return;
      const resolvedError = await resolveApiError(
        error,
        'Nao foi possivel criar o planejamento.',
      );
      if (!draft.isCurrent(submitted)) return;
      setMessage(resolvedError.message);

      if (resolvedError.unauthorized) {
        router.replace('/login');
      }
    } finally {
      if (draft.isCurrent()) setSaving(false);
    }
  }

  return (
    <AppShell
      activeRoute="/planejamentos"
      onProfilePress={() => router.push('/usuario' as never)}
      pageHeader={
        <FinanceAppHeader
          action={
            <GlassButton
              label="Cancelar"
              onPress={() => { draft.clear(); router.back(); }}
              variant="ghost"
            />
          }
          eyebrow="Planejamento compartilhado"
          subtitle="Crie o espaco inicial para organizar despesas em grupo."
          title="Novo planejamento"
        />
      }
    >
      <GlassPanel>
        <GlassField label="Nome">
          <GlassTextInput
            accessibilityLabel="Nome do planejamento"
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
            accessibilityLabel="Descricao do planejamento"
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
                accessibilityLabel="Data inicial do planejamento"
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
                accessibilityLabel="Data final do planejamento"
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
    </AppShell>
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
    minWidth: 140,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
  },
  textArea: {
    minHeight: 96,
    paddingTop: FinanceTheme.spacing.sm,
    textAlignVertical: 'top',
  },
});
