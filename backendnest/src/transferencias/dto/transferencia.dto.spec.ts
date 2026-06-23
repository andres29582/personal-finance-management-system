import { validate } from 'class-validator';
import { CreateTransferenciaDto } from './create-transferencia.dto';
import { UpdateTransferenciaDto } from './update-transferencia.dto';

describe('Transferencia DTO validation', () => {
  const contaOrigemId = '11111111-1111-4111-8111-111111111111';
  const contaDestinoId = '22222222-2222-4222-8222-222222222222';

  it('accepts a valid transfer creation payload', async () => {
    const dto = Object.assign(new CreateTransferenciaDto(), {
      contaOrigemId,
      contaDestinoId,
      valor: 200,
      data: '2026-05-04',
      descricao: 'Transferencia entre contas',
      comissao: 5,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid account ids and non-positive amount', async () => {
    const dto = Object.assign(new CreateTransferenciaDto(), {
      contaOrigemId: 'origem-invalida',
      contaDestinoId: 'destino-invalido',
      valor: 0,
      data: '2026-05-04',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['contaOrigemId', 'contaDestinoId', 'valor']),
    );
  });

  it('rejects empty date and negative commission', async () => {
    const dto = Object.assign(new CreateTransferenciaDto(), {
      contaOrigemId,
      contaDestinoId,
      valor: 200,
      data: '',
      comissao: -1,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['data', 'comissao']),
    );
  });

  it('accepts partial transfer updates', async () => {
    const dto = Object.assign(new UpdateTransferenciaDto(), {
      valor: 250,
      comissao: 0,
      descricao: 'Atualizada',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid partial transfer updates', async () => {
    const dto = Object.assign(new UpdateTransferenciaDto(), {
      valor: -10,
      comissao: -1,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['valor', 'comissao']),
    );
  });
});
