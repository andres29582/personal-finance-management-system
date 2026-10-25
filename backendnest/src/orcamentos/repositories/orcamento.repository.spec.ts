import { DataSource, SelectQueryBuilder } from 'typeorm';
import { Orcamento } from '../entities/orcamento.entity';
import { Transacao } from '../../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../../transacoes/enums/tipo-transacao.enum';
import { OrcamentoRepository } from './orcamento.repository';

describe('OrcamentoRepository', () => {
  it('aggregates active non-adjustment expenses by month and category', async () => {
    const dataSource = new DataSource({ type: 'postgres' });
    const initialize = jest
      .spyOn(dataSource, 'initialize')
      .mockRejectedValue(new Error('Database initialization is forbidden'));
    const connect = jest
      .spyOn(dataSource.driver, 'connect')
      .mockRejectedValue(new Error('Database connection is forbidden'));
    const queryBuilder = new SelectQueryBuilder<Transacao>(dataSource);
    jest.spyOn(queryBuilder, 'select').mockReturnValue(queryBuilder);
    jest.spyOn(queryBuilder, 'addSelect').mockReturnValue(queryBuilder);
    jest.spyOn(queryBuilder, 'where').mockReturnValue(queryBuilder);
    jest.spyOn(queryBuilder, 'andWhere').mockReturnValue(queryBuilder);
    jest.spyOn(queryBuilder, 'groupBy').mockReturnValue(queryBuilder);
    jest.spyOn(queryBuilder, 'addGroupBy').mockReturnValue(queryBuilder);
    jest
      .spyOn(queryBuilder, 'getRawMany')
      .mockResolvedValue([
        { mesReferencia: '2026-04', categoriaId: 'food', gastoAtual: '75' },
      ]);
    const transactionRepository = dataSource.manager.getRepository(Transacao);
    jest
      .spyOn(transactionRepository, 'createQueryBuilder')
      .mockReturnValue(queryBuilder);
    const repository = new OrcamentoRepository(
      dataSource.manager.getRepository(Orcamento),
      transactionRepository,
    );

    await expect(
      repository.findExpenseTotalsByMonths('user-1', ['2026-04']),
    ).resolves.toEqual([
      { mesReferencia: '2026-04', categoriaId: 'food', gastoAtual: '75' },
    ]);

    expect(transactionRepository.createQueryBuilder).toHaveBeenCalledWith(
      'transaction',
    );
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'transaction.usuarioId = :usuarioId',
      { usuarioId: 'user-1' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "TO_CHAR(transaction.data, 'YYYY-MM') IN (:...mesReferencias)",
      { mesReferencias: ['2026-04'] },
    );
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
    expect(dataSource.isInitialized).toBe(false);
    expect(initialize).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });
});
