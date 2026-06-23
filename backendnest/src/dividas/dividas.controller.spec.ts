import { DividasController } from './dividas.controller';
import { DividasService } from './dividas.service';

describe('DividasController', () => {
  let controller: DividasController;
  let dividasService: jest.Mocked<
    Pick<DividasService, 'create' | 'deactivate' | 'findAll' | 'findOne' | 'update'>
  >;

  const request = {
    user: {
      id: 'user-1',
      email: 'ana@example.com',
      nome: 'Ana',
      sid: 'session-1',
    },
  } as never;

  beforeEach(() => {
    dividasService = {
      create: jest.fn(),
      deactivate: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    controller = new DividasController(
      dividasService as unknown as DividasService,
    );
  });

  it('delegates create using the authenticated user id', async () => {
    const dto = {
      contaId: '11111111-1111-4111-8111-111111111111',
      nome: 'Financiamento',
      montoTotal: 1000,
      fechaInicio: '2026-05-01',
      fechaVencimiento: '2026-12-01',
    };
    dividasService.create.mockResolvedValue({ id: 'divida-1' } as never);

    const result = await controller.create(request, dto);

    expect(dividasService.create).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({ id: 'divida-1' });
  });

  it('delegates findAll using the authenticated user id', async () => {
    dividasService.findAll.mockResolvedValue([{ id: 'divida-1' }] as never);

    const result = await controller.findAll(request);

    expect(dividasService.findAll).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([{ id: 'divida-1' }]);
  });

  it('delegates findOne using route id and authenticated user id', async () => {
    dividasService.findOne.mockResolvedValue({ id: 'divida-1' } as never);

    const result = await controller.findOne('divida-1', request);

    expect(dividasService.findOne).toHaveBeenCalledWith('divida-1', 'user-1');
    expect(result).toEqual({ id: 'divida-1' });
  });

  it('delegates update using route id, authenticated user id and dto', async () => {
    const dto = {
      nome: 'Financiamento atualizado',
      cuotaMensual: 150,
    };
    dividasService.update.mockResolvedValue({ id: 'divida-1', ...dto } as never);

    const result = await controller.update('divida-1', request, dto);

    expect(dividasService.update).toHaveBeenCalledWith(
      'divida-1',
      'user-1',
      dto,
    );
    expect(result).toEqual({ id: 'divida-1', ...dto });
  });

  it('delegates deactivate using route id and authenticated user id', async () => {
    dividasService.deactivate.mockResolvedValue(undefined);

    const result = await controller.deactivate('divida-1', request);

    expect(dividasService.deactivate).toHaveBeenCalledWith(
      'divida-1',
      'user-1',
    );
    expect(result).toBeUndefined();
  });
});
