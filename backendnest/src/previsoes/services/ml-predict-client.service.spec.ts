import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { DeficitFeatures } from '../types/deficit-features.type';
import { MlPredictClientService } from './ml-predict-client.service';

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
  const configService = {
    get: jest.fn((key: string) =>
      key === 'ML_API_URL' ? 'http://ml:8000' : '5000',
    ),
  } as unknown as ConfigService;
  const service = new MlPredictClientService(configService);

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
      }),
    );
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
