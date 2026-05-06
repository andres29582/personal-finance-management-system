import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DeficitFeatures } from '../types/deficit-features.type';
import type { MlPredictResponse } from '../types/ml-predict-response.type';

@Injectable()
export class MlPredictClientService {
  constructor(private readonly configService: ConfigService) {}

  async predict(features: DeficitFeatures): Promise<MlPredictResponse> {
    const baseUrl =
      this.configService.get<string>('ML_API_URL') ?? 'http://127.0.0.1:8000';
    const timeoutMs = Number(
      this.configService.get<string>('ML_API_TIMEOUT_MS') ?? '5000',
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(features),
        signal: controller.signal,
      });

      if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new ServiceUnavailableException(
          `API de Machine Learning indisponivel ou retornou erro (${response.status}). ${details}`,
        );
      }

      const body = (await response.json()) as Partial<MlPredictResponse>;

      if (
        typeof body.prediction !== 'number' ||
        typeof body.probability !== 'number'
      ) {
        throw new ServiceUnavailableException(
          'API de Machine Learning retornou uma resposta invalida.',
        );
      }

      return {
        prediction: body.prediction,
        probability: body.probability,
      };
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
}
