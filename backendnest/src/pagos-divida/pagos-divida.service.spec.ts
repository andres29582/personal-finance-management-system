import { DataSource } from 'typeorm';
import { CategoriasService } from '../categorias/categorias.service';
import { TipoCategoria } from '../categorias/enums/tipo-categoria.enum';
import {
  BusinessRuleException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import { ContasService } from '../contas/contas.service';
import { DividasService } from '../dividas/dividas.service';
import { LogsService } from '../logs/logs.service';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { PagoDivida } from './entities/pago-divida.entity';
import { PagosDividaService } from './pagos-divida.service';
import { PagoDividaRepository } from './repositories/pago-divida.repository';

type TestTransactionManager = {
  create?: jest.Mock;
  save?: jest.Mock;
  update?: jest.Mock;
};

describe('PagosDividaService', () => {
  let service: PagosDividaService;
  let repository: jest.Mocked<
    Pick<PagoDividaRepository, 'findActiveById' | 'findByDivida'>
  >;
  let contasService: jest.Mocked<Pick<ContasService, 'findActiveForWrite'>>;
  let dividasService: jest.Mocked<Pick<DividasService, 'findOne'>>;
  let categoriasService: jest.Mocked<Pick<CategoriasService, 'findOne'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    repository = {
      findActiveById: jest.fn(),
      findByDivida: jest.fn(),
    };
    contasService = {
      findActiveForWrite: jest.fn(),
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
      repository as unknown as PagoDividaRepository,
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

    contasService.findActiveForWrite.mockResolvedValue({
      ativa: true,
      id: 'conta-1',
    } as never);
    dividasService.findOne.mockResolvedValue({
      ativa: true,
      id: 'divida-1',
    } as never);
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
        }) as Record<string, unknown>,
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

    contasService.findActiveForWrite.mockResolvedValue({
      ativa: true,
      id: 'conta-1',
    } as never);
    dividasService.findOne.mockResolvedValue({
      ativa: true,
      id: 'divida-1',
    } as never);
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
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects debt payment when debt is inactive before creating side effects', async () => {
    dividasService.findOne.mockResolvedValue({
      ativa: false,
      id: 'divida-1',
    } as never);

    await expect(
      service.create('user-1', {
        categoriaId: 'categoria-1',
        contaId: 'conta-1',
        data: '2026-04-01',
        dividaId: 'divida-1',
        valor: 350,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleException);
    await expect(
      service.create('user-1', {
        categoriaId: 'categoria-1',
        contaId: 'conta-1',
        data: '2026-04-01',
        dividaId: 'divida-1',
        valor: 350,
      }),
    ).rejects.toMatchObject({
      code: 'PAGAMENTO_DIVIDA_INACTIVE_DEBT',
      message: 'Nao e possivel registrar pagamento para uma divida inativa.',
      statusCode: 400,
    });

    expect(contasService.findActiveForWrite).not.toHaveBeenCalled();
    expect(categoriasService.findOne).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(logsService.logEntityEvent).not.toHaveBeenCalled();
  });

  it.each([
    {
      code: 'CONTA_INACTIVE',
      error: new BusinessRuleException(
        'CONTA_INACTIVE',
        'Não é possível realizar operações financeiras em uma conta inativa.',
      ),
      statusCode: 400,
    },
    {
      code: 'CONTA_NOT_FOUND',
      error: new ResourceNotFoundException(
        'CONTA_NOT_FOUND',
        'Conta não encontrada',
      ),
      statusCode: 404,
    },
  ])(
    'rejects debt payment with $code before creating either linked entity',
    async ({ error, code, statusCode }) => {
      const manager = {
        create: jest.fn(),
        save: jest.fn(),
      };
      dividasService.findOne.mockResolvedValue({
        ativa: true,
        id: 'divida-1',
      } as never);
      contasService.findActiveForWrite.mockRejectedValue(error);
      mockTransaction(manager);

      await expect(
        service.create('user-1', {
          categoriaId: 'categoria-1',
          contaId: 'conta-1',
          data: '2026-04-01',
          dividaId: 'divida-1',
          valor: 350,
        }),
      ).rejects.toMatchObject({ code, statusCode });

      expect(contasService.findActiveForWrite).toHaveBeenCalledWith(
        'conta-1',
        'user-1',
        manager,
      );
      expect(categoriasService.findOne).not.toHaveBeenCalled();
      expect(manager.create).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
      expect(logsService.logEntityEvent).not.toHaveBeenCalled();
    },
  );

  it('rejects debt payment when category is not an expense', async () => {
    const manager = {
      create: jest.fn(),
      save: jest.fn(),
    };
    contasService.findActiveForWrite.mockResolvedValue({
      ativa: true,
      id: 'conta-1',
    } as never);
    dividasService.findOne.mockResolvedValue({
      ativa: true,
      id: 'divida-1',
    } as never);
    categoriasService.findOne.mockResolvedValue({
      id: 'categoria-1',
      tipo: TipoCategoria.RECEITA,
    } as never);
    mockTransaction(manager);

    const promise = service.create('user-1', {
      categoriaId: 'categoria-1',
      contaId: 'conta-1',
      data: '2026-04-01',
      dividaId: 'divida-1',
      valor: 350,
    });

    await expect(promise).rejects.toBeInstanceOf(BusinessRuleException);
    await expect(promise).rejects.toMatchObject({
      code: 'PAGAMENTO_DIVIDA_CATEGORY_MUST_BE_EXPENSE',
      message: 'A categoria do pagamento de divida deve ser do tipo despesa.',
      statusCode: 400,
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.create).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
    expect(logsService.logEntityEvent).not.toHaveBeenCalled();
  });

  it('soft-deletes both the payment and the linked transaction', async () => {
    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
    };

    repository.findActiveById.mockResolvedValue({
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
    const updateCalls = manager.update.mock.calls as Array<
      [unknown, unknown, { excluidoEm: Date }]
    >;
    const paymentDeletedAt = updateCalls[0][2].excluidoEm;
    const transactionDeletedAt = updateCalls[1][2].excluidoEm;

    expect(transactionDeletedAt).toBe(paymentDeletedAt);
    expect(logsService.logEntityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'pagamento_divida',
        event: 'PAGAMENTO_DIVIDA_SOFT_DELETED',
        userId: 'user-1',
      }),
    );
    expect(contasService.findActiveForWrite).not.toHaveBeenCalled();
  });

  it('propagates remove transaction failure and does not log deletion success', async () => {
    const transactionError = new Error('Falha ao excluir transacao vinculada');
    const manager = {
      update: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(transactionError),
    };

    repository.findActiveById.mockResolvedValue({
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
    repository.findByDivida.mockResolvedValue([activePayment]);

    const result = await service.findAllByDivida('divida-1', 'user-1');

    expect(repository.findByDivida).toHaveBeenCalledWith('divida-1', 'user-1');
    expect(result).toEqual([activePayment]);
  });

  it('does not find a debt payment when it is soft-deleted', async () => {
    repository.findActiveById.mockResolvedValue(null);

    await expect(service.findOne('pago-1', 'user-1')).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.findOne('pago-1', 'user-1')).rejects.toMatchObject({
      code: 'PAGAMENTO_DIVIDA_NOT_FOUND',
      message: 'Pagamento não encontrado',
      statusCode: 404,
    });

    expect(repository.findActiveById).toHaveBeenCalledWith('pago-1', 'user-1');
  });
});
