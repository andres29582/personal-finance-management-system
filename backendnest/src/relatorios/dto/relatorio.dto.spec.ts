import { validate } from 'class-validator';
import { TipoTransacao } from '../../transacoes/enums/tipo-transacao.enum';
import { PeriodoRelatorio } from '../enums/periodo-relatorio.enum';
import { GetRelatorioDto } from './get-relatorio.dto';

describe('Relatorio DTO validation', () => {
  const contaId = '11111111-1111-4111-8111-111111111111';
  const categoriaId = '22222222-2222-4222-8222-222222222222';

  it('accepts a valid monthly report query with filters', async () => {
    const dto = Object.assign(new GetRelatorioDto(), {
      periodo: PeriodoRelatorio.MENSAL,
      mes: '2026-05',
      tipo: TipoTransacao.DESPESA,
      contaId,
      categoriaId,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts a valid quarterly report query', async () => {
    const dto = Object.assign(new GetRelatorioDto(), {
      periodo: PeriodoRelatorio.TRIMESTRAL,
      ano: '2026',
      trimestre: '2',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts a valid custom interval report query', async () => {
    const dto = Object.assign(new GetRelatorioDto(), {
      periodo: PeriodoRelatorio.INTERVALO,
      dataInicio: '2026-05-01',
      dataFim: '2026-05-31',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects missing or invalid report period', async () => {
    const dto = Object.assign(new GetRelatorioDto(), {
      periodo: 'semanal',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('periodo');
  });

  it('rejects malformed date period fields', async () => {
    const dto = Object.assign(new GetRelatorioDto(), {
      periodo: PeriodoRelatorio.INTERVALO,
      mes: '05-2026',
      ano: '26',
      trimestre: '5',
      dataInicio: '01-05-2026',
      dataFim: '2026/05/31',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'mes',
        'ano',
        'trimestre',
        'dataInicio',
        'dataFim',
      ]),
    );
  });

  it('rejects invalid transaction type and linked ids', async () => {
    const dto = Object.assign(new GetRelatorioDto(), {
      periodo: PeriodoRelatorio.MENSAL,
      tipo: 'INVALIDO',
      contaId: 'conta-invalida',
      categoriaId: 'categoria-invalida',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['tipo', 'contaId', 'categoriaId']),
    );
  });
});
