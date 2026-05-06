import { DataSource, Repository } from 'typeorm';
import { CategoriasService } from '../categorias/categorias.service';
import { ContasService } from '../contas/contas.service';
import { DividasService } from '../dividas/dividas.service';
import { LogsService } from '../logs/logs.service';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { PagoDivida } from './entities/pago-divida.entity';
import { PagosDividaService } from './pagos-divida.service';

type TestTransactionManager = {
  create?: jest.Mock;
  save?: jest.Mock;
  update?: jest.Mock;
};

describe('PagosDividaService', () => {
  let service: PagosDividaService;
  let repository: jest.Mocked<
    Pick<Repository<PagoDivida>, 'find' | 'findOneBy'>
  >;
  let contasService: jest.Mocked<Pick<ContasService, 'findOne'>>;
  let dividasService: jest.Mocked<Pick<DividasService, 'findOne'>>;
  let categoriasService: jest.Mocked<Pick<CategoriasService, 'findOne'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    repository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
    };
    contasService = {
      findOne: jest.fn(),
    };
    dividasService = {
      findOne: jest.fn(),
    };
    categoriasService = {
      findOne: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new PagosDividaService(
      repository as unknown as Repository<PagoDivida>,
      contasService as unknown as ContasService,
      dividasService as unknown as DividasService,
      categoriasService as unknown as CategoriasService,
      dataSource as unknown as DataSource,
      logsService as unknown as LogsService,
    );
  });

  function mockTransaction(manager: TestTransactionManager) {
    const transactionMock = dataSource.transaction as unknown as jest.Mock;

    transactionMock.mockImplementation(
      (callback: (entityManager: TestTransactionManager) => Promise<unknown>) =>
        callback(manager),
    );
  }

  it('creates a debt payment linked to a generated transaction', async () => {
    const createMock = jest.fn(
      <TPayload>(_entity: unknown, payload: TPayload) => payload,
    );
    const saveMock = jest.fn(<TEntity>(entity: TEntity) =>
      Promise.resolve(entity),
    );

    const manager = {
      create: createMock,
      save: saveMock,
    };

    contasService.findOne.mockResolvedValue({ id: 'conta-1' } as never);
    dividasService.findOne.mockResolvedValue({ id: 'divida-1' } as never);
    categoriasService.findOne.mockResolvedValue({ id: 'categoria-1' } as never);
    mockTransaction(manager);

    const result = await service.create('user-1', {
      categoriaId: 'categoria-1',
      contaId: 'conta-1',
      data: '2026-04-01',
      descricao: 'Parcela abril',
      dividaId: 'divida-1',
      valor: 350,
    });

    expect(manager.create).toHaveBeenCalledWith(
      Transacao,
      expect.objectContaining({
        categoriaId: 'categoria-1',
        contaId: 'conta-1',
        tipo: 'despesa',
      }),
    );
    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(result.transacaoId).toBeDefined();
    expect(result.dividaId).toBe('divida-1');
    expect(logsService.logEntityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'pagamento_divida',
        event: 'PAGAMENTO_DIVIDA_CREATED',
        userId: 'user-1',
      }),
    );
  });

  it('soft-deletes both the payment and the linked transaction', async () => {
    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
    };

    repository.findOneBy.mockResolvedValue({
      id: 'pago-1',
      transacaoId: 'transacao-1',
      usuarioId: 'user-1',
    } as PagoDivida);
    mockTransaction(manager);

    await service.remove('pago-1', 'user-1');

    expect(manager.update).toHaveBeenCalledWith(
      PagoDivida,
      { id: 'pago-1', usuarioId: 'user-1' },
      expect.objectContaining({ excluidoEm: expect.any(Date) as Date }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      Transacao,
      { id: 'transacao-1', usuarioId: 'user-1' },
      expect.objectContaining({ excluidoEm: expect.any(Date) as Date }),
    );
    expect(logsService.logEntityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'pagamento_divida',
        event: 'PAGAMENTO_DIVIDA_SOFT_DELETED',
        userId: 'user-1',
      }),
    );
  });
});
