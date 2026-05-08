import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CategoriasService } from '../categorias/categorias.service';
import { TipoCategoria } from '../categorias/enums/tipo-categoria.enum';
import { ContasService } from '../contas/contas.service';
import { DividasService } from '../dividas/dividas.service';
import { LogsService } from '../logs/logs.service';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
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
    categoriasService.findOne.mockResolvedValue({
      id: 'categoria-1',
      tipo: TipoCategoria.DESPESA,
    } as never);
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
        tipo: TipoTransacao.DESPESA,
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      PagoDivida,
      expect.objectContaining({
        contaId: 'conta-1',
        dividaId: 'divida-1',
        valor: 350,
      }),
    );
    expect(manager.save).toHaveBeenCalledTimes(2);
    const transacaoPayload = createMock.mock.calls[0][1] as Transacao;
    const pagoDividaPayload = createMock.mock.calls[1][1] as PagoDivida;

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(transacaoPayload.id).toBeDefined();
    expect(pagoDividaPayload.transacaoId).toBe(transacaoPayload.id);
    expect(result.transacaoId).toBe(transacaoPayload.id);
    expect(result.dividaId).toBe('divida-1');
    expect(logsService.logEntityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'pagamento_divida',
        event: 'PAGAMENTO_DIVIDA_CREATED',
        userId: 'user-1',
        details: expect.objectContaining({
          transacaoId: transacaoPayload.id,
        }),
      }),
    );
  });

  it('propagates transaction failure so debt payment and transaction are rolled back together', async () => {
    const transactionError = new Error('Falha ao salvar pagamento');
    const createMock = jest.fn(
      <TPayload>(_entity: unknown, payload: TPayload) => payload,
    );
    const saveMock = jest
      .fn()
      .mockImplementationOnce(<TEntity>(entity: TEntity) =>
        Promise.resolve(entity),
      )
      .mockRejectedValueOnce(transactionError);
    const manager = {
      create: createMock,
      save: saveMock,
    };

    contasService.findOne.mockResolvedValue({ id: 'conta-1' } as never);
    dividasService.findOne.mockResolvedValue({ id: 'divida-1' } as never);
    categoriasService.findOne.mockResolvedValue({
      id: 'categoria-1',
      tipo: TipoCategoria.DESPESA,
    } as never);
    mockTransaction(manager);

    await expect(
      service.create('user-1', {
        categoriaId: 'categoria-1',
        contaId: 'conta-1',
        data: '2026-04-01',
        descricao: 'Parcela abril',
        dividaId: 'divida-1',
        valor: 350,
      }),
    ).rejects.toThrow(transactionError);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.create).toHaveBeenCalledTimes(2);
    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(logsService.logEntityEvent).not.toHaveBeenCalled();
  });

  it('rejects debt payment with a non-positive amount', async () => {
    await expect(
      service.create('user-1', {
        categoriaId: 'categoria-1',
        contaId: 'conta-1',
        data: '2026-04-01',
        dividaId: 'divida-1',
        valor: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects debt payment when category is not an expense', async () => {
    contasService.findOne.mockResolvedValue({ id: 'conta-1' } as never);
    dividasService.findOne.mockResolvedValue({ id: 'divida-1' } as never);
    categoriasService.findOne.mockResolvedValue({
      id: 'categoria-1',
      tipo: TipoCategoria.RECEITA,
    } as never);

    await expect(
      service.create('user-1', {
        categoriaId: 'categoria-1',
        contaId: 'conta-1',
        data: '2026-04-01',
        dividaId: 'divida-1',
        valor: 350,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
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

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
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
    const paymentDeletedAt = manager.update.mock.calls[0][2].excluidoEm;
    const transactionDeletedAt = manager.update.mock.calls[1][2].excluidoEm;

    expect(transactionDeletedAt).toBe(paymentDeletedAt);
    expect(logsService.logEntityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'pagamento_divida',
        event: 'PAGAMENTO_DIVIDA_SOFT_DELETED',
        userId: 'user-1',
      }),
    );
  });

  it('propagates remove transaction failure and does not log deletion success', async () => {
    const transactionError = new Error('Falha ao excluir transacao vinculada');
    const manager = {
      update: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(transactionError),
    };

    repository.findOneBy.mockResolvedValue({
      id: 'pago-1',
      transacaoId: 'transacao-1',
      usuarioId: 'user-1',
    } as PagoDivida);
    mockTransaction(manager);

    await expect(service.remove('pago-1', 'user-1')).rejects.toThrow(
      transactionError,
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
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
    expect(logsService.logEntityEvent).not.toHaveBeenCalled();
  });

  it('lists only debt payments that are not soft-deleted', async () => {
    const activePayment = {
      dividaId: 'divida-1',
      excluidoEm: null,
      id: 'pago-1',
      usuarioId: 'user-1',
    } as PagoDivida;

    dividasService.findOne.mockResolvedValue({ id: 'divida-1' } as never);
    repository.find.mockResolvedValue([activePayment]);

    const result = await service.findAllByDivida('divida-1', 'user-1');

    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dividaId: 'divida-1',
          excluidoEm: expect.any(Object),
          usuarioId: 'user-1',
        }),
      }),
    );
    expect(result).toEqual([activePayment]);
  });

  it('does not find a debt payment when it is soft-deleted', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne('pago-1', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(repository.findOneBy).toHaveBeenCalledWith({
      excluidoEm: expect.any(Object),
      id: 'pago-1',
      usuarioId: 'user-1',
    });
  });
});
