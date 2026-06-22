import type { ML_PREDICTION_SCHEMA_VERSION } from '../constants/ml-prediction-contract';

export type RiscoDeficit = 'baixo' | 'moderado' | 'alto';

export type PrevisaoIndicadoresDto = {
  historicoMeses: number;
  saldoInicialMes: number;
  mediaReceitas3Meses: number;
  mediaDespesas3Meses: number;
  tendenciaReceitas3Meses: number;
  tendenciaDespesas3Meses: number;
  taxaDeficit3Meses: number;
};

export type PrevisaoDeficitResponseDto = {
  schemaVersion: typeof ML_PREDICTION_SCHEMA_VERSION;
  deficitPrevisto: boolean;
  indicadores: PrevisaoIndicadoresDto;
  mensagem: string;
  mesReferencia: string;
  prediction: number;
  probability: number;
  risco: RiscoDeficit;
};
