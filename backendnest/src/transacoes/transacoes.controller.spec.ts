import { TransacoesController } from './transacoes.controller';
import { TransacoesService } from './transacoes.service';
import { TipoTransacao } from './enums/tipo-transacao.enum';

describe('TransacoesController', () => {
  let controller: TransacoesController;
  let transacoesService: jest.Mocked<
    Pick<
      TransacoesService,
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
    transacoesService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    };

    controller = new TransacoesController(
      transacoesService as unknown as TransacoesService,
    );
  });

  it('delegates create using the authenticated user id', async () => {
    const dto = {
      contaId: '11111111-1111-4111-8111-111111111111',
      categoriaId: '22222222-2222-4222-8222-222222222222',
      tipo: TipoTransacao.RECEITA,
      valor: 500,
      data: '2026-05-01',
    };
    transacoesService.create.mockResolvedValue({ id: 'transacao-1' } as never);

    const result = await controller.create(request, dto);

    expect(transacoesService.create).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({ id: 'transacao-1' });
  });

  it('delegates findAll using authenticated user id and query filters', async () => {
    const query = {
      mes: '2026-05',
      tipo: TipoTransacao.DESPESA,
      contaId: '11111111-1111-4111-8111-111111111111',
    };
    transacoesService.findAll.mockResolvedValue([
      { id: 'transacao-1' },
    ] as never);

    const result = await controller.findAll(request, query);

    expect(transacoesService.findAll).toHaveBeenCalledWith('user-1', query);
    expect(result).toEqual([{ id: 'transacao-1' }]);
  });

  it('delegates findOne using route id and authenticated user id', async () => {
    transacoesService.findOne.mockResolvedValue({ id: 'transacao-1' } as never);

    const result = await controller.findOne('transacao-1', request);

    expect(transacoesService.findOne).toHaveBeenCalledWith(
      'transacao-1',
      'user-1',
    );
    expect(result).toEqual({ id: 'transacao-1' });
  });

  it('delegates update using route id, authenticated user id and dto', async () => {
    const dto = {
      valor: 750,
      descricao: 'Salario atualizado',
    };
    transacoesService.update.mockResolvedValue({
      id: 'transacao-1',
      ...dto,
    } as never);

    const result = await controller.update('transacao-1', request, dto);

    expect(transacoesService.update).toHaveBeenCalledWith(
      'transacao-1',
      'user-1',
      dto,
    );
    expect(result).toEqual({ id: 'transacao-1', ...dto });
  });

  it('delegates remove using route id and authenticated user id', async () => {
    transacoesService.remove.mockResolvedValue({
      id: 'transacao-1',
      excluidoEm: new Date('2026-05-02T00:00:00.000Z'),
    } as never);

    const result = await controller.remove('transacao-1', request);

    expect(transacoesService.remove).toHaveBeenCalledWith(
      'transacao-1',
      'user-1',
    );
    expect(result.id).toBe('transacao-1');
  });
});
