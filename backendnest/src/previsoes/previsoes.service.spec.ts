import { DeficitFeaturesService } from './services/deficit-features.service';
import { MlPredictClientService } from './services/ml-predict-client.service';
import { PrevisoesService } from './previsoes.service';

describe('PrevisoesService', () => {
  it('maps internal features to the stable public V2 response', async () => {
    const featureService = {
      build: jest.fn().mockResolvedValue({
        schemaVersion: 2,
        mesReferencia: '2026-05',
        features: { receita_lag_1: 1000 },
        indicadores: {
          historicoMeses: 3,
          saldoInicialMes: 500,
          mediaReceitas3Meses: 1000,
          mediaDespesas3Meses: 900,
          tendenciaReceitas3Meses: 50,
          tendenciaDespesas3Meses: -25,
          taxaDeficit3Meses: 0.3333,
        },
      }),
    };
    const mlClient = {
      predict: jest.fn().mockResolvedValue({
        schema_version: 2,
        prediction: 1,
        probability: 0.73456,
      }),
    };
    const service = new PrevisoesService(
      featureService as unknown as DeficitFeaturesService,
      mlClient as unknown as MlPredictClientService,
    );

    const result = await service.preverDeficit('user-1', '2026-05');

    expect(result.schemaVersion).toBe(2);
    expect(result.deficitPrevisto).toBe(true);
    expect(result.probability).toBe(0.7346);
    expect(result.risco).toBe('alto');
    expect(result.indicadores.historicoMeses).toBe(3);
    expect(result).not.toHaveProperty('features');
  });
});
