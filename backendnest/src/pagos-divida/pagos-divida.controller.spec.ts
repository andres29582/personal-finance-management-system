import { PagosDividaController } from './pagos-divida.controller';
import { PagosDividaService } from './pagos-divida.service';

describe('PagosDividaController', () => {
  let controller: PagosDividaController;
  let pagosDividaService: jest.Mocked<
    Pick<
      PagosDividaService,
      'create' | 'findAllByDivida' | 'findOne' | 'remove'
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
    pagosDividaService = {
      create: jest.fn(),
      findAllByDivida: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    controller = new PagosDividaController(
      pagosDividaService as unknown as PagosDividaService,
    );
  });

  it('delegates create using the authenticated user id', async () => {
    const dto = {
      dividaId: '11111111-1111-4111-8111-111111111111',
      contaId: '22222222-2222-4222-8222-222222222222',
      categoriaId: '33333333-3333-4333-8333-333333333333',
      valor: 100,
      data: '2026-05-05',
      descricao: 'Pagamento de parcela',
    };
    pagosDividaService.create.mockResolvedValue({
      id: 'pago-1',
      transacaoId: 'transacao-1',
    } as never);

    const result = await controller.create(request, dto);

    expect(pagosDividaService.create).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({ id: 'pago-1', transacaoId: 'transacao-1' });
  });

  it('delegates findAllByDivida using route debt id and authenticated user id', async () => {
    pagosDividaService.findAllByDivida.mockResolvedValue([
      { id: 'pago-1' },
    ] as never);

    const result = await controller.findAllByDivida('divida-1', request);

    expect(pagosDividaService.findAllByDivida).toHaveBeenCalledWith(
      'divida-1',
      'user-1',
    );
    expect(result).toEqual([{ id: 'pago-1' }]);
  });

  it('delegates findOne using route id and authenticated user id', async () => {
    pagosDividaService.findOne.mockResolvedValue({ id: 'pago-1' } as never);

    const result = await controller.findOne('pago-1', request);

    expect(pagosDividaService.findOne).toHaveBeenCalledWith('pago-1', 'user-1');
    expect(result).toEqual({ id: 'pago-1' });
  });

  it('delegates remove using route id and authenticated user id', async () => {
    pagosDividaService.remove.mockResolvedValue(undefined);

    const result = await controller.remove('pago-1', request);

    expect(pagosDividaService.remove).toHaveBeenCalledWith('pago-1', 'user-1');
    expect(result).toBeUndefined();
  });
});
