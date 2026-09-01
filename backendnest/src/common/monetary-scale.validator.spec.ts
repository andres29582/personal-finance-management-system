import { IsNumber, IsPositive, Min, validate } from 'class-validator';
import { CreateContaDto } from '../contas/dto/create-conta.dto';
import { UpdateContaDto } from '../contas/dto/update-conta.dto';
import { CreateDividaDto } from '../dividas/dto/create-divida.dto';
import { UpdateDividaDto } from '../dividas/dto/update-divida.dto';
import { CreateMetaDto } from '../metas/dto/create-meta.dto';
import { UpdateMetaDto } from '../metas/dto/update-meta.dto';
import { CreateOrcamentoDto } from '../orcamentos/dto/create-orcamento.dto';
import { UpdateOrcamentoDto } from '../orcamentos/dto/update-orcamento.dto';
import { CreatePagoDividaDto } from '../pagos-divida/dto/create-pago-divida.dto';
import { CreateTransacaoDto } from '../transacoes/dto/create-transacao.dto';
import { UpdateTransacaoDto } from '../transacoes/dto/update-transacao.dto';
import { CreateTransferenciaDto } from '../transferencias/dto/create-transferencia.dto';
import { UpdateTransferenciaDto } from '../transferencias/dto/update-transferencia.dto';
import { HasAtMostTwoDecimalPlaces } from './monetary-scale.validator';

type DtoConstructor = new () => object;
type FieldCase = [DtoConstructor, string];

class PositiveMoneyDto {
  @IsNumber()
  @IsPositive()
  @HasAtMostTwoDecimalPlaces()
  value: number;
}

class NonNegativeMoneyDto {
  @IsNumber()
  @Min(0)
  @HasAtMostTwoDecimalPlaces()
  value: number;
}

const monetaryFields: FieldCase[] = [
  [CreateContaDto, 'saldoInicial'],
  [CreateContaDto, 'limiteCredito'],
  [UpdateContaDto, 'limiteCredito'],
  [CreateTransacaoDto, 'valor'],
  [UpdateTransacaoDto, 'valor'],
  [CreateTransferenciaDto, 'valor'],
  [CreateTransferenciaDto, 'comissao'],
  [UpdateTransferenciaDto, 'valor'],
  [UpdateTransferenciaDto, 'comissao'],
  [CreateDividaDto, 'montoTotal'],
  [CreateDividaDto, 'cuotaMensual'],
  [UpdateDividaDto, 'cuotaMensual'],
  [CreatePagoDividaDto, 'valor'],
  [CreateMetaDto, 'montoObjetivo'],
  [UpdateMetaDto, 'montoObjetivo'],
  [UpdateMetaDto, 'montoActual'],
  [CreateOrcamentoDto, 'valorPlanejado'],
  [UpdateOrcamentoDto, 'valorPlanejado'],
];

const optionalMonetaryFields: FieldCase[] = monetaryFields.filter(
  ([Dto, field]) =>
    field !== 'saldoInicial' &&
    !(
      Dto === CreateTransacaoDto ||
      Dto === CreatePagoDividaDto ||
      Dto === CreateMetaDto ||
      Dto === CreateOrcamentoDto
    ) &&
    !(Dto === CreateTransferenciaDto && field === 'valor') &&
    !(Dto === CreateDividaDto && field === 'montoTotal'),
);

async function errorsFor(Dto: DtoConstructor, field: string, value: unknown) {
  return validate(Object.assign(new Dto(), { [field]: value })).then((errors) =>
    errors.filter((error) => error.property === field),
  );
}

describe('strict monetary write contract', () => {
  it.each([0.001, 1.999, 10.123, 1e-3, 1e-7, 0.30000000000000004])(
    'rejects a positive monetary value with unsupported scale: %s',
    async (value) => {
      await expect(
        errorsFor(PositiveMoneyDto, 'value', value),
      ).resolves.not.toHaveLength(0);
    },
  );

  it.each([-1, -0.01, 0, -0])(
    'rejects a non-positive monetary value: %s',
    async (value) => {
      await expect(
        errorsFor(PositiveMoneyDto, 'value', value),
      ).resolves.not.toHaveLength(0);
    },
  );

  it.each([0.01, 1, 1.2, 1.2, 123456.78, 1e2, 1e-2])(
    'accepts a positive monetary value with supported scale: %s',
    async (value) => {
      await expect(
        errorsFor(PositiveMoneyDto, 'value', value),
      ).resolves.toHaveLength(0);
    },
  );

  it.each([0, -0])('accepts nonnegative zero: %s', async (value) => {
    await expect(
      errorsFor(NonNegativeMoneyDto, 'value', value),
    ).resolves.toHaveLength(0);
  });

  it('rejects a negative nonnegative value', async () => {
    await expect(
      errorsFor(NonNegativeMoneyDto, 'value', -0.01),
    ).resolves.not.toHaveLength(0);
  });

  it('rejects scientific notation through validation without throwing', async () => {
    await expect(
      validate(Object.assign(new PositiveMoneyDto(), { value: 1e-7 })),
    ).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'value' })]),
    );
  });

  it('treats JSON 1.20 as the parsed numeric value 1.2', async () => {
    const { value } = JSON.parse('{"value":1.20}') as { value: number };

    expect(value).toBe(1.2);
    await expect(
      errorsFor(PositiveMoneyDto, 'value', value),
    ).resolves.toHaveLength(0);
  });

  it.each(monetaryFields)(
    '%p wires the two-decimal rule to %s',
    async (Dto, field) => {
      await expect(errorsFor(Dto, field, 1.001)).resolves.not.toHaveLength(0);
    },
  );

  it.each(optionalMonetaryFields)(
    '%p preserves optional null handling for %s',
    async (Dto, field) => {
      await expect(errorsFor(Dto, field, null)).resolves.toHaveLength(0);
    },
  );

  it.each([
    UpdateContaDto,
    UpdateTransacaoDto,
    UpdateTransferenciaDto,
    UpdateDividaDto,
    UpdateMetaDto,
    UpdateOrcamentoDto,
  ])('%p preserves an absent PATCH body', async (Dto) => {
    await expect(validate(new Dto())).resolves.toHaveLength(0);
  });
});
