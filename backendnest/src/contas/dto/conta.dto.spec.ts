import { validate } from 'class-validator';
import { CreateContaDto } from './create-conta.dto';
import { UpdateContaDto } from './update-conta.dto';
import { TipoConta } from '../enums/tipo-conta.enum';

describe('Conta DTO validation', () => {
  it('accepts a valid account creation payload', async () => {
    const dto = Object.assign(new CreateContaDto(), {
      nome: 'Conta Corrente',
      tipo: TipoConta.BANCO,
      saldoInicial: 1000,
      limiteCredito: 500,
      dataCorte: 10,
      dataPagamento: 20,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects an invalid account type and missing name', async () => {
    const dto = Object.assign(new CreateContaDto(), {
      nome: '',
      tipo: 'INVALIDO',
      saldoInicial: 1000,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['nome', 'tipo']),
    );
  });

  it('rejects credit card dates outside the valid day range', async () => {
    const dto = Object.assign(new CreateContaDto(), {
      nome: 'Cartao',
      tipo: TipoConta.CARTAO_CREDITO,
      saldoInicial: 0,
      dataCorte: 0,
      dataPagamento: 32,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['dataCorte', 'dataPagamento']),
    );
  });

  it('accepts partial account updates', async () => {
    const dto = Object.assign(new UpdateContaDto(), {
      ativa: false,
      limiteCredito: 1200,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
