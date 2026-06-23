import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  constructor(private readonly configService: ConfigService) {}

  async predict(features: DeficitFeatures): Promise<MlPredictResponse> {
    this.assertFeatures(features);
    const baseUrl =
      this.configService.get<string>('ML_API_URL') ?? 'http://127.0.0.1:8000';
    const timeoutMs = Number(
      this.configService.get<string>('ML_API_TIMEOUT_MS') ?? '5000',
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const payload: MlPredictRequestV2 = {
      schema_version: ML_PREDICTION_SCHEMA_VERSION,
      features,
    };

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
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
