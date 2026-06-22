import { ValidationAppException } from '../../common/exceptions';
import { TipoTransacao } from '../../transacoes/enums/tipo-transacao.enum';
import { PrevisaoRepository } from '../repositories/previsao.repository';
import { DeficitFeaturesService } from './deficit-features.service';

describe('DeficitFeaturesService', () => {
  let repository: {
    findAccountsCreatedBefore: jest.Mock;
    findTransactionsBefore: jest.Mock;
    findTransactionsInHistoricalWindow: jest.Mock;
    findTransfersBefore: jest.Mock;
    findUserById: jest.Mock;
  };
  let service: DeficitFeaturesService;

  beforeEach(() => {
    repository = {
      findUserById: jest.fn(),
      findTransactionsInHistoricalWindow: jest.fn(),
      findAccountsCreatedBefore: jest.fn(),
      findTransactionsBefore: jest.fn(),
      findTransfersBefore: jest.fn(),
    } as never;
    service = new DeficitFeaturesService(
      repository as unknown as PrevisaoRepository,
    );
  });

  it('builds contract V2 using only the three months before the target', async () => {
    repository.findUserById.mockResolvedValue({
      id: 'user-1',
      dataRegistro: new Date('2026-01-01T00:00:00.000Z'),
    } as never);
    const transactions = [
      {
        contaId: 'account-1',
        data: '2026-02-10',
        tipo: TipoTransacao.RECEITA,
        valor: 1000,
      },
      {
        contaId: 'account-1',
        data: '2026-02-11',
        tipo: TipoTransacao.DESPESA,
        valor: 500,
      },
      {
        contaId: 'account-1',
        data: '2026-04-10',
        tipo: TipoTransacao.RECEITA,
        valor: 1600,
      },
      {
        contaId: 'account-1',
        data: '2026-04-11',
        tipo: TipoTransacao.DESPESA,
        valor: 1100,
      },
    ] as never;
    repository.findTransactionsInHistoricalWindow.mockResolvedValue(
      transactions,
    );
    repository.findAccountsCreatedBefore.mockResolvedValue([
      { id: 'account-1', saldoInicial: 100 },
    ] as never);
    repository.findTransactionsBefore.mockResolvedValue(transactions);
    repository.findTransfersBefore.mockResolvedValue([]);

    const result = await service.build('user-1', '2026-05');

    expect(repository.findTransactionsInHistoricalWindow).toHaveBeenCalledWith(
      'user-1',
      '2026-02-01',
      '2026-05-01',
    );
    expect(repository.findTransactionsBefore).toHaveBeenCalledWith(
      'user-1',
      '2026-05-01',
    );
    expect(result.schemaVersion).toBe(2);
    expect(result.features).toEqual({
      receita_lag_1: 1600,
      despesa_lag_1: 1100,
      media_receita_3m: 866.6667,
      media_despesa_3m: 533.3333,
      tendencia_receita_3m: 300,
      tendencia_despesa_3m: 300,
      volatilidade_despesa_3m: result.features.volatilidade_despesa_3m,
      media_transacoes_receita_3m: 0.6667,
      media_transacoes_despesa_3m: 0.6667,
      taxa_deficit_3m: 0,
      saldo_inicial_mes: 1100,
      mes_do_ano: 5,
    });
    expect(Number.isFinite(result.features.volatilidade_despesa_3m)).toBe(true);
    expect(result.features).not.toHaveProperty('receita_mes');
    expect(result.features).not.toHaveProperty('despesa_mes');
  });

  it('counts completed months with no transactions as zero', async () => {
    repository.findUserById.mockResolvedValue({
      id: 'user-1',
      dataRegistro: new Date('2026-01-01T00:00:00.000Z'),
    } as never);
    repository.findTransactionsInHistoricalWindow.mockResolvedValue([]);
    repository.findAccountsCreatedBefore.mockResolvedValue([]);
    repository.findTransactionsBefore.mockResolvedValue([]);
    repository.findTransfersBefore.mockResolvedValue([]);

    const result = await service.build('user-1', '2026-05');

    expect(result.indicadores.historicoMeses).toBe(3);
    expect(result.features.receita_lag_1).toBe(0);
    expect(result.features.volatilidade_despesa_3m).toBe(0);
  });

  it('returns a typed 422 error when registration does not cover three months', async () => {
    repository.findUserById.mockResolvedValue({
      id: 'user-1',
      dataRegistro: new Date('2026-03-15T10:00:00.000Z'),
    } as never);

    const promise = service.build('user-1', '2026-05');

    await expect(promise).rejects.toBeInstanceOf(ValidationAppException);
    await expect(promise).rejects.toMatchObject({
      code: 'PREVISAO_INSUFFICIENT_HISTORY',
      statusCode: 422,
      details: { requiredMonths: 3, availableMonths: 1 },
    });
    expect(
      repository.findTransactionsInHistoricalWindow,
    ).not.toHaveBeenCalled();
  });

  it('rejects future target months', async () => {
    await expect(service.build('user-1', '2099-01')).rejects.toMatchObject({
      code: 'PREVISAO_FUTURE_MONTH_NOT_ALLOWED',
      statusCode: 422,
    });
  });
});
