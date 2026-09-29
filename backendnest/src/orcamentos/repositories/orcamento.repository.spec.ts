import { Repository } from 'typeorm';
import { Orcamento } from '../entities/orcamento.entity';
import { Transacao } from '../../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../../transacoes/enums/tipo-transacao.enum';
import { OrcamentoRepository } from './orcamento.repository';

describe('OrcamentoRepository', () => {
  it('aggregates active non-adjustment expenses by month and category', async () => {
    const queryBuilder = {
      select: jest.fn(),
      addSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      groupBy: jest.fn(),
      addGroupBy: jest.fn(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([
          { mesReferencia: '2026-04', categoriaId: 'food', gastoAtual: '75' },
        ]),
    };
    [
      queryBuilder.select,
      queryBuilder.addSelect,
      queryBuilder.where,
      queryBuilder.andWhere,
      queryBuilder.groupBy,
      queryBuilder.addGroupBy,
    ].forEach((method) => method.mockReturnValue(queryBuilder));
    const transactionRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const repository = new OrcamentoRepository(
      {} as Repository<Orcamento>,
      transactionRepository as Repository<Transacao>,
    );

    await expect(
      repository.findExpenseTotalsByMonths('user-1', ['2026-04']),
    ).resolves.toEqual([
      { mesReferencia: '2026-04', categoriaId: 'food', gastoAtual: '75' },
    ]);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'transaction.ehAjuste = :ehAjuste',
      { ehAjuste: false },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'transaction.tipo = :tipo',
      { tipo: TipoTransacao.DESPESA },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'transaction.excluidoEm IS NULL',
    );
    expect(queryBuilder.groupBy).toHaveBeenCalledWith(
      "TO_CHAR(transaction.data, 'YYYY-MM')",
    );
    expect(queryBuilder.addGroupBy).toHaveBeenCalledWith(
      'transaction.categoriaId',
    );
  });
});
