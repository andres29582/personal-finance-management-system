import { validate } from 'class-validator';
import { CreateDividaDto } from './create-divida.dto';
import { UpdateDividaDto } from './update-divida.dto';
import { Periodicidade } from '../enums/periodicidade.enum';

describe('Divida DTO validation', () => {
  const contaId = '11111111-1111-4111-8111-111111111111';

  it('accepts a valid debt creation payload', async () => {
    const dto = Object.assign(new CreateDividaDto(), {
      contaId,
      nome: 'Financiamento',
      montoTotal: 1000,
      tasaInteres: 2.5,
      cuotaMensual: 150,
      fechaInicio: '2026-05-01',
      fechaVencimiento: '2026-12-01',
      proximoVencimiento: '2026-06-01',
      periodicidade: Periodicidade.MENSAL,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid account id, missing name and non-positive total amount', async () => {
    const dto = Object.assign(new CreateDividaDto(), {
      contaId: 'conta-invalida',
      nome: '',
      montoTotal: 0,
      fechaInicio: '2026-05-01',
      fechaVencimiento: '2026-12-01',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['contaId', 'nome', 'montoTotal']),
    );
  });

  it('rejects negative interest, non-positive installment and invalid periodicity', async () => {
    const dto = Object.assign(new CreateDividaDto(), {
      nome: 'Financiamento',
      montoTotal: 1000,
      tasaInteres: -1,
      cuotaMensual: 0,
      fechaInicio: '2026-05-01',
      fechaVencimiento: '2026-12-01',
      periodicidade: 'diaria',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['tasaInteres', 'cuotaMensual', 'periodicidade']),
    );
  });

  it('accepts partial debt updates', async () => {
    const dto = Object.assign(new UpdateDividaDto(), {
      nome: 'Financiamento atualizado',
      tasaInteres: 0,
      cuotaMensual: 200,
      ativa: false,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid partial debt updates', async () => {
    const dto = Object.assign(new UpdateDividaDto(), {
      tasaInteres: -1,
      cuotaMensual: 0,
      periodicidade: 'diaria',
      ativa: 'nao',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'tasaInteres',
        'cuotaMensual',
        'periodicidade',
        'ativa',
      ]),
    );
  });
});
