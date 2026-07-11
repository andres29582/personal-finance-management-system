import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ML_API_CONFIG } from '../config/ml-api.config';
import type { MlApiConfig } from '../config/ml-api.config';
import {
  ML_PREDICTION_FEATURES,
  ML_PREDICTION_SCHEMA_VERSION,
} from '../constants/ml-prediction-contract';
import type {
  DeficitFeatures,
  MlPredictRequestV2,
} from '../types/deficit-features.type';
import type { MlPredictResponse } from '../types/ml-predict-response.type';

@Injectable()
export class MlPredictClientService {
  constructor(
    @Inject(ML_API_CONFIG)
    private readonly mlApiConfig: MlApiConfig,
  ) {}

  async predict(features: DeficitFeatures): Promise<MlPredictResponse> {
    this.assertFeatures(features);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.mlApiConfig.timeoutMs,
    );
    const payload: MlPredictRequestV2 = {
      schema_version: ML_PREDICTION_SCHEMA_VERSION,
      features,
    };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.mlApiConfig.internalApiKey) {
      headers['X-ML-Internal-Key'] = this.mlApiConfig.internalApiKey;
    }

    try {
      const response = await fetch(
        `${this.mlApiConfig.baseUrl.replace(/\/$/, '')}/predict`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new ServiceUnavailableException(
          `API de Machine Learning indisponivel ou retornou erro (${response.status}).`,
        );
      }
      const body = (await response.json()) as Partial<MlPredictResponse>;
      if (
        body.schema_version !== ML_PREDICTION_SCHEMA_VERSION ||
        typeof body.prediction !== 'number' ||
        !Number.isInteger(body.prediction) ||
        ![0, 1].includes(body.prediction) ||
        typeof body.probability !== 'number' ||
        !Number.isFinite(body.probability) ||
        body.probability < 0 ||
        body.probability > 1
      ) {
        throw new ServiceUnavailableException(
          'API de Machine Learning retornou uma resposta V2 invalida.',
        );
      }
      return body as MlPredictResponse;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        'Nao foi possivel consultar a API de Machine Learning.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private assertFeatures(features: DeficitFeatures): void {
    const keys = Object.keys(features);
    if (
      keys.length !== ML_PREDICTION_FEATURES.length ||
      ML_PREDICTION_FEATURES.some((feature) => !keys.includes(feature)) ||
      Object.values(features).some(
        (value) => typeof value !== 'number' || !Number.isFinite(value),
      )
    ) {
      throw new ServiceUnavailableException(
        'Features incompativeis com o contrato ML V2.',
      );
    }
  }
}
