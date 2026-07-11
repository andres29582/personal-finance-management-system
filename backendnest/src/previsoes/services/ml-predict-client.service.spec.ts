import { ServiceUnavailableException } from '@nestjs/common';
import { DeficitFeatures } from '../types/deficit-features.type';
import { MlPredictClientService } from './ml-predict-client.service';
import { MlApiConfig } from '../config/ml-api.config';

const features: DeficitFeatures = {
  receita_lag_1: 1000,
  despesa_lag_1: 900,
  media_receita_3m: 950,
  media_despesa_3m: 850,
  tendencia_receita_3m: 50,
  tendencia_despesa_3m: -25,
  volatilidade_despesa_3m: 100,
  media_transacoes_receita_3m: 2,
  media_transacoes_despesa_3m: 10,
  taxa_deficit_3m: 0.3333,
  saldo_inicial_mes: 500,
  mes_do_ano: 5,
};

describe('MlPredictClientService', () => {
  const config: MlApiConfig = {
    baseUrl: 'http://ml:8000',
    timeoutMs: 5000,
  };
  const service = new MlPredictClientService(config);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends the exact V2 payload and validates the response', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          schema_version: 2,
          prediction: 1,
          probability: 0.75,
        }),
    } as Response);

    await expect(service.predict(features)).resolves.toEqual({
      schema_version: 2,
      prediction: 1,
      probability: 0.75,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://ml:8000/predict',
      expect.objectContaining({
        body: JSON.stringify({ schema_version: 2, features }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('does not send the internal key header when absent', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          schema_version: 2,
          prediction: 1,
          probability: 0.75,
        }),
    } as Response);

    await service.predict(features);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://ml:8000/predict',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('sends the internal key header when configured', async () => {
    const internalApiKey = 'synthetic-ml-key-with-at-least-32-chars';
    const serviceWithKey = new MlPredictClientService({
      ...config,
      internalApiKey,
    });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          schema_version: 2,
          prediction: 1,
          probability: 0.75,
        }),
    } as Response);

    await serviceWithKey.predict(features);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://ml:8000/predict',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          'X-ML-Internal-Key': internalApiKey,
        },
      }),
    );
  });

  it('keeps HTTP failures translated to unavailability', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    await expect(service.predict(features)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('aborts the request on timeout', async () => {
    jest.useFakeTimers();
    const timeoutService = new MlPredictClientService({
      baseUrl: 'http://ml:8000',
      timeoutMs: 10,
    });
    jest.spyOn(global, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );

    const promise = timeoutService.predict(features);
    jest.advanceTimersByTime(10);

    await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException);
    jest.useRealTimers();
  });

  it('rejects incompatible API responses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          schema_version: 1,
          prediction: 1,
          probability: 0.75,
        }),
    } as Response);

    await expect(service.predict(features)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
