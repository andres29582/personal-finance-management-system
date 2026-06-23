import type {
  ML_PREDICTION_FEATURES,
  ML_PREDICTION_SCHEMA_VERSION,
} from '../constants/ml-prediction-contract';

export type DeficitFeatureName = (typeof ML_PREDICTION_FEATURES)[number];
export type DeficitFeatures = Record<DeficitFeatureName, number>;

export type MlPredictRequestV2 = {
  schema_version: typeof ML_PREDICTION_SCHEMA_VERSION;
  features: DeficitFeatures;
};
