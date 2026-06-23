import { ContasController } from './contas.controller';
import { ContasService } from './contas.service';
import { TipoConta } from './enums/tipo-conta.enum';

describe('ContasController', () => {
  let controller: ContasController;
  let contasService: jest.Mocked<
    Pick<ContasService, 'create' | 'deactivate' | 'findAll' | 'findOne' | 'update'>
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
    contasService = {
      create: jest.fn(),
      deactivate: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    controller = new ContasController(
      contasService as unknown as ContasService,
    );
  });

  it('delegates create using the authenticated user id', async () => {
    const dto = {
      nome: 'Conta Corrente',
      tipo: TipoConta.BANCO,
      saldoInicial: 1000,
    };
    contasService.create.mockResolvedValue({ id: 'conta-1' } as never);

    const result = await controller.create(request, dto);

    expect(contasService.create).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({ id: 'conta-1' });
  });

  it('delegates findAll using the authenticated user id', async () => {
    contasService.findAll.mockResolvedValue([{ id: 'conta-1' }] as never);

    const result = await controller.findAll(request);

    expect(contasService.findAll).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([{ id: 'conta-1' }]);
  });

  it('delegates findOne using route id and authenticated user id', async () => {
    contasService.findOne.mockResolvedValue({ id: 'conta-1' } as never);

    const result = await controller.findOne('conta-1', request);

    expect(contasService.findOne).toHaveBeenCalledWith('conta-1', 'user-1');
    expect(result).toEqual({ id: 'conta-1' });
  });

  it('delegates update using route id, authenticated user id and dto', async () => {
    const dto = {
      nome: 'Conta Atualizada',
      limiteCredito: 500,
    };
    contasService.update.mockResolvedValue({ id: 'conta-1', ...dto } as never);

    const result = await controller.update('conta-1', request, dto);

    expect(contasService.update).toHaveBeenCalledWith(
      'conta-1',
      'user-1',
      dto,
    );
    expect(result).toEqual({ id: 'conta-1', ...dto });
  });

  it('delegates deactivate using route id and authenticated user id', async () => {
    contasService.deactivate.mockResolvedValue({
      id: 'conta-1',
      ativa: false,
    } as never);

    const result = await controller.deactivate('conta-1', request);

    expect(contasService.deactivate).toHaveBeenCalledWith('conta-1', 'user-1');
    expect(result).toEqual({ id: 'conta-1', ativa: false });
  });
});
