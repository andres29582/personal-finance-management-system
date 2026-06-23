import { validate } from 'class-validator';
import { CreateTransacaoDto } from './create-transacao.dto';
import { FindTransacoesDto } from './find-transacoes.dto';
import { UpdateTransacaoDto } from './update-transacao.dto';
import { TipoTransacao } from '../enums/tipo-transacao.enum';

describe('Transacao DTO validation', () => {
  const contaId = '11111111-1111-4111-8111-111111111111';
  const categoriaId = '22222222-2222-4222-8222-222222222222';

  it('accepts a valid transaction creation payload', async () => {
    const dto = Object.assign(new CreateTransacaoDto(), {
      contaId,
      categoriaId,
      tipo: TipoTransacao.RECEITA,
      valor: 500,
      data: '2026-05-01',
      descricao: 'Salario',
      ehAjuste: false,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects non-positive values and invalid foreign ids', async () => {
    const dto = Object.assign(new CreateTransacaoDto(), {
      contaId: 'conta-invalida',
      categoriaId: 'categoria-invalida',
      tipo: TipoTransacao.DESPESA,
      valor: 0,
      data: '2026-05-01',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['contaId', 'categoriaId', 'valor']),
    );
  });

  it('rejects invalid transaction type and empty date', async () => {
    const dto = Object.assign(new CreateTransacaoDto(), {
      contaId,
      categoriaId,
      tipo: 'INVALIDO',
      valor: 100,
      data: '',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['tipo', 'data']),
    );
  });

  it('rejects invalid transaction dates', async () => {
    const dto = Object.assign(new CreateTransacaoDto(), {
      contaId,
      categoriaId,
      tipo: TipoTransacao.DESPESA,
      valor: 100,
      data: '2026-99-99',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('data');
  });

  it('accepts valid transaction filters', async () => {
    const dto = Object.assign(new FindTransacoesDto(), {
      mes: '2026-05',
      tipo: TipoTransacao.DESPESA,
      contaId,
      categoriaId,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects malformed month filters', async () => {
    const dto = Object.assign(new FindTransacoesDto(), {
      mes: '05-2026',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('mes');
  });

  it('accepts partial transaction updates', async () => {
    const dto = Object.assign(new UpdateTransacaoDto(), {
      valor: 250,
      descricao: 'Mercado atualizado',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid date in partial transaction updates', async () => {
    const dto = Object.assign(new UpdateTransacaoDto(), {
      data: '01/05/2026',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('data');
  });
});
