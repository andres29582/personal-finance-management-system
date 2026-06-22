import { PrevisoesController } from './previsoes.controller';
import { PrevisoesService } from './previsoes.service';

describe('PrevisoesController', () => {
  let controller: PrevisoesController;
  let previsoesService: jest.Mocked<Pick<PrevisoesService, 'preverDeficit'>>;

  const request = {
    user: {
      id: 'user-1',
      email: 'ana@example.com',
      nome: 'Ana',
      sid: 'session-1',
    },
  } as never;

  beforeEach(() => {
    previsoesService = {
      preverDeficit: jest.fn(),
    };

    controller = new PrevisoesController(
      previsoesService as unknown as PrevisoesService,
    );
  });

  it('delegates deficit prediction using authenticated user id and month query', async () => {
    previsoesService.preverDeficit.mockResolvedValue({
      deficitPrevisto: true,
      mesReferencia: '2026-05',
      prediction: 1,
      probability: 0.72,
      risco: 'alto',
      mensagem: 'Existe risco alto de deficit para o mes selecionado.',
      schemaVersion: 2,
      indicadores: {
        historicoMeses: 3,
      },
    } as never);

    const result = await controller.preverDeficit(request, { mes: '2026-05' });

    expect(previsoesService.preverDeficit).toHaveBeenCalledWith(
      'user-1',
      '2026-05',
    );
    expect(result).toEqual(
      expect.objectContaining({
        deficitPrevisto: true,
        mesReferencia: '2026-05',
        risco: 'alto',
      }),
    );
  });

  it('delegates deficit prediction without month when query is empty', async () => {
    previsoesService.preverDeficit.mockResolvedValue({
      deficitPrevisto: false,
      mesReferencia: '2026-06',
      prediction: 0,
      probability: 0.21,
      risco: 'baixo',
      mensagem: 'O modelo nao indica deficit para o mes selecionado.',
      schemaVersion: 2,
      indicadores: { historicoMeses: 3 },
    } as never);

    const result = await controller.preverDeficit(request, {});

    expect(previsoesService.preverDeficit).toHaveBeenCalledWith(
      'user-1',
      undefined,
    );
    expect(result).toEqual(
      expect.objectContaining({
        deficitPrevisto: false,
        risco: 'baixo',
      }),
    );
  });
});
