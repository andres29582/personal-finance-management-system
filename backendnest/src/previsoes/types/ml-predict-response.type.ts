import type { ML_PREDICTION_SCHEMA_VERSION } from '../constants/ml-prediction-contract';

export type MlPredictResponse = {
  schema_version: typeof ML_PREDICTION_SCHEMA_VERSION;
  prediction: number;
  probability: number;
};
