import { TransferenciasController } from './transferencias.controller';
import { TransferenciasService } from './transferencias.service';

describe('TransferenciasController', () => {
  let controller: TransferenciasController;
  let transferenciasService: jest.Mocked<
    Pick<
      TransferenciasService,
      'create' | 'findAll' | 'findOne' | 'remove' | 'update'
    >
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
    transferenciasService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    };

    controller = new TransferenciasController(
      transferenciasService as unknown as TransferenciasService,
    );
  });

  it('delegates create using the authenticated user id', async () => {
    const dto = {
      contaOrigemId: '11111111-1111-4111-8111-111111111111',
      contaDestinoId: '22222222-2222-4222-8222-222222222222',
      valor: 200,
      data: '2026-05-04',
      comissao: 5,
    };
    transferenciasService.create.mockResolvedValue({
      id: 'transferencia-1',
    } as never);

    const result = await controller.create(request, dto);

    expect(transferenciasService.create).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({ id: 'transferencia-1' });
  });

  it('delegates findAll using the authenticated user id', async () => {
    transferenciasService.findAll.mockResolvedValue([
      { id: 'transferencia-1' },
    ] as never);

    const result = await controller.findAll(request);

    expect(transferenciasService.findAll).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([{ id: 'transferencia-1' }]);
  });

  it('delegates findOne using route id and authenticated user id', async () => {
    transferenciasService.findOne.mockResolvedValue({
      id: 'transferencia-1',
    } as never);

    const result = await controller.findOne('transferencia-1', request);

    expect(transferenciasService.findOne).toHaveBeenCalledWith(
      'transferencia-1',
      'user-1',
    );
    expect(result).toEqual({ id: 'transferencia-1' });
  });

  it('delegates update using route id, authenticated user id and dto', async () => {
    const dto = {
      valor: 250,
      comissao: 0,
      descricao: 'Transferencia ajustada',
    };
    transferenciasService.update.mockResolvedValue({
      id: 'transferencia-1',
      ...dto,
    } as never);

    const result = await controller.update('transferencia-1', request, dto);

    expect(transferenciasService.update).toHaveBeenCalledWith(
      'transferencia-1',
      'user-1',
      dto,
    );
    expect(result).toEqual({ id: 'transferencia-1', ...dto });
  });

  it('delegates remove using route id and authenticated user id', async () => {
    transferenciasService.remove.mockResolvedValue(undefined);

    const result = await controller.remove('transferencia-1', request);

    expect(transferenciasService.remove).toHaveBeenCalledWith(
      'transferencia-1',
      'user-1',
    );
    expect(result).toBeUndefined();
  });
});
