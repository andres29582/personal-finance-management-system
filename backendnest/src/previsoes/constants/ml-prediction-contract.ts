export const ML_PREDICTION_SCHEMA_VERSION = 2 as const;
export const ML_MINIMUM_HISTORY_MONTHS = 3 as const;

export const ML_PREDICTION_FEATURES = [
  'receita_lag_1',
  'despesa_lag_1',
  'media_receita_3m',
  'media_despesa_3m',
  'tendencia_receita_3m',
  'tendencia_despesa_3m',
  'volatilidade_despesa_3m',
  'media_transacoes_receita_3m',
  'media_transacoes_despesa_3m',
  'taxa_deficit_3m',
  'saldo_inicial_mes',
  'mes_do_ano',
] as const;
