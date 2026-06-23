export const ML_PREDICTION_SCHEMA_VERSION = 2 as const;

export type RiscoDeficit = 'baixo' | 'moderado' | 'alto';

export type PrevisaoIndicadores = {
  historicoMeses: number;
  saldoInicialMes: number;
  mediaReceitas3Meses: number;
  mediaDespesas3Meses: number;
  tendenciaReceitas3Meses: number;
  tendenciaDespesas3Meses: number;
  taxaDeficit3Meses: number;
};

export type PrevisaoDeficitResponse = {
  schemaVersion: typeof ML_PREDICTION_SCHEMA_VERSION;
  deficitPrevisto: boolean;
  indicadores: PrevisaoIndicadores;
  mensagem: string;
  mesReferencia: string;
  prediction: number;
  probability: number;
  risco: RiscoDeficit;
};
