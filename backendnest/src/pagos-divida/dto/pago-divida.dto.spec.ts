import { validate } from 'class-validator';
import { CreatePagoDividaDto } from './create-pago-divida.dto';

describe('PagoDivida DTO validation', () => {
  const dividaId = '11111111-1111-4111-8111-111111111111';
  const contaId = '22222222-2222-4222-8222-222222222222';
  const categoriaId = '33333333-3333-4333-8333-333333333333';

  it('accepts a valid debt payment creation payload', async () => {
    const dto = Object.assign(new CreatePagoDividaDto(), {
      dividaId,
      contaId,
      categoriaId,
      valor: 100,
      data: '2026-05-05',
      descricao: 'Pagamento de parcela',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid linked ids and non-positive amount', async () => {
    const dto = Object.assign(new CreatePagoDividaDto(), {
      dividaId: 'divida-invalida',
      contaId: 'conta-invalida',
      categoriaId: 'categoria-invalida',
      valor: 0,
      data: '2026-05-05',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['dividaId', 'contaId', 'categoriaId', 'valor']),
    );
  });

  it('rejects empty payment date', async () => {
    const dto = Object.assign(new CreatePagoDividaDto(), {
      dividaId,
      contaId,
      categoriaId,
      valor: 100,
      data: '',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('data');
  });

  it.each(['2026-99-99', '01/05/2026'])(
    'rejects invalid payment date: %s',
    async (data) => {
      const dto = Object.assign(new CreatePagoDividaDto(), {
        dividaId,
        contaId,
        categoriaId,
        valor: 100,
        data,
      });

      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).toContain('data');
    },
  );

  it('accepts payment creation without an optional description', async () => {
    const dto = Object.assign(new CreatePagoDividaDto(), {
      dividaId,
      contaId,
      categoriaId,
      valor: 100,
      data: '2026-05-05',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
