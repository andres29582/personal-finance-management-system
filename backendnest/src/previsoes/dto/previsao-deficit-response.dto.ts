import type { DeficitFeatures } from '../types/deficit-features.type';

export type RiscoDeficit = 'baixo' | 'moderado' | 'alto';

export type PrevisaoDeficitResponseDto = {
  deficitPrevisto: boolean;
  features: DeficitFeatures;
  mensagem: string;
  mesReferencia: string;
  prediction: number;
  probability: number;
  risco: RiscoDeficit;
};
