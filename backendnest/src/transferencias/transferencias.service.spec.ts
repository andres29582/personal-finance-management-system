import { DataSource, EntityManager } from 'typeorm';
import {
  BusinessRuleException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import { ContasService } from '../contas/contas.service';
import { Conta } from '../contas/entities/conta.entity';
import { LogsService } from '../logs/logs.service';
import { Transferencia } from './entities/transferencia.entity';
import { TransferenciaRepository } from './repositories/transferencia.repository';
import { TransferenciasService } from './transferencias.service';

type TestManager = {
  create: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
};

describe('TransferenciasService', () => {
  let service: TransferenciasService;
  let repository: jest.Mocked<
    Pick<
      TransferenciaRepository,
      'findByIdAndUser' | 'findByUser' | 'softDeleteByIdAndUser'
    >
  >;
  let contasService: jest.Mocked<Pick<ContasService, 'findActiveManyForWrite'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;
  let manager: TestManager;

  const createDto = {
    comissao: 3.5,
    contaDestinoId: 'conta-2',
    contaOrigemId: 'conta-1',
    data: '2026-04-01',
    descricao: 'Pix',
    valor: 100,
  };

  beforeEach(() => {
    repository = {
      findByIdAndUser: jest.fn(),
      findByUser: jest.fn(),
      softDeleteByIdAndUser: jest.fn(),
    };
    contasService = {
      findActiveManyForWrite: jest.fn(),
    };
    manager = {
      create: jest.fn((_entity: unknown, payload: Transferencia) => payload),
      findOne: jest.fn(),
      save: jest.fn((entity: Transferencia) => Promise.resolve(entity)),
      update: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(),
    };
    (dataSource.transaction as unknown as jest.Mock).mockImplementation(
      (callback: (transactionManager: EntityManager) => Promise<unknown>) =>
        callback(manager as unknown as EntityManager),
    );
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new TransferenciasService(
      repository as unknown as TransferenciaRepository,
      contasService as unknown as ContasService,
      dataSource as unknown as DataSource,
      logsService as unknown as LogsService,
    );
  });

  it('creates a transfer after locking both active accounts', async () => {
    contasService.findActiveManyForWrite.mockResolvedValue([
      { ativa: true, id: 'conta-1' } as Conta,
      { ativa: true, id: 'conta-2' } as Conta,
    ]);

    const result = await service.create('user-1', createDto);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(contasService.findActiveManyForWrite).toHaveBeenCalledWith(
      ['conta-1', 'conta-2'],
      'user-1',
      manager,
    );
    expect(manager.create).toHaveBeenCalledWith(
      Transferencia,
      expect.objectContaining({
        comissao: 3.5,
        contaDestinoId: 'conta-2',
        contaOrigemId: 'conta-1',
        id: expect.any(String) as string,
        usuarioId: 'user-1',
      }),
    );
    expect(result.contaOrigemId).toBe('conta-1');
    expect(logsService.logEntityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'TRANSFERENCIA_CREATED' }),
    );
    expect(manager.save.mock.invocationCallOrder[0]).toBeLessThan(
      logsService.logEntityEvent.mock.invocationCallOrder[0],
    );
  });

  it('rejects transfer between the same account before locking accounts', async () => {
    await expect(
      service.create('user-1', {
        ...createDto,
        contaDestinoId: 'conta-1',
      }),
    ).rejects.toMatchObject({
      code: 'TRANSFERENCIA_SAME_ACCOUNT',
      statusCode: 400,
    });

    expect(contasService.findActiveManyForWrite).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects transfer with a non-positive amount before locking accounts', async () => {
    await expect(
      service.create('user-1', { ...createDto, valor: 0 }),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(contasService.findActiveManyForWrite).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects transfer with a negative commission before locking accounts', async () => {
    await expect(
      service.create('user-1', { ...createDto, comissao: -1 }),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(contasService.findActiveManyForWrite).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it.each([
    {
      contaDestinoId: 'conta-2',
      contaOrigemId: 'conta-inativa',
      lado: 'origem',
    },
    {
      contaDestinoId: 'conta-inativa',
      contaOrigemId: 'conta-1',
      lado: 'destino',
    },
  ])(
    'rejects creation when the $lado account is inactive without persistence or log',
    async ({ contaDestinoId, contaOrigemId }) => {
      contasService.findActiveManyForWrite.mockRejectedValue(
        new BusinessRuleException(
          'CONTA_INACTIVE',
          'Não é possível realizar operações financeiras em uma conta inativa.',
        ),
      );

      await expect(
        service.create('user-1', {
          ...createDto,
          contaDestinoId,
          contaOrigemId,
        }),
      ).rejects.toMatchObject({
        code: 'CONTA_INACTIVE',
        statusCode: 400,
      });

      expect(contasService.findActiveManyForWrite).toHaveBeenCalledWith(
        [contaOrigemId, contaDestinoId],
        'user-1',
        manager,
      );
      expect(manager.create).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
      expect(logsService.logEntityEvent).not.toHaveBeenCalled();
    },
  );

  it('preserves CONTA_NOT_FOUND precedence for an absent or foreign account', async () => {
    contasService.findActiveManyForWrite.mockRejectedValue(
      new ResourceNotFoundException('CONTA_NOT_FOUND', 'Conta não encontrada'),
    );

    await expect(service.create('user-1', createDto)).rejects.toMatchObject({
      code: 'CONTA_NOT_FOUND',
      statusCode: 404,
    });
    expect(manager.save).not.toHaveBeenCalled();
    expect(logsService.logEntityEvent).not.toHaveBeenCalled();
  });

  it.each([
    {
      contaDestinoId: 'conta-2',
      contaOrigemId: 'conta-inativa',
      lado: 'origem',
    },
    {
      contaDestinoId: 'conta-inativa',
      contaOrigemId: 'conta-1',
      lado: 'destino',
    },
  ])(
    'blocks PATCH when the current $lado account is inactive',
    async ({ contaDestinoId, contaOrigemId }) => {
      manager.findOne.mockResolvedValueOnce({
        contaDestinoId,
        contaOrigemId,
        id: 'transferencia-1',
        usuarioId: 'user-1',
        valor: 100,
      } as Transferencia);
      contasService.findActiveManyForWrite.mockRejectedValue(
        new BusinessRuleException('CONTA_INACTIVE', 'Conta inativa'),
      );

      await expect(
        service.update('transferencia-1', 'user-1', {
          descricao: 'Pix ajustado',
        }),
      ).rejects.toMatchObject({ code: 'CONTA_INACTIVE' });

      expect(contasService.findActiveManyForWrite).toHaveBeenCalledWith(
        [contaOrigemId, contaDestinoId],
        'user-1',
        manager,
      );
      expect(manager.update).not.toHaveBeenCalled();
      expect(logsService.logEntityEvent).not.toHaveBeenCalled();
    },
  );

  it('updates a transfer with active accounts inside the same transaction', async () => {
    const current = {
      contaDestinoId: 'conta-2',
      contaOrigemId: 'conta-1',
      id: 'transferencia-1',
      usuarioId: 'user-1',
      valor: 100,
    } as Transferencia;
    const updated = { ...current, descricao: 'Pix ajustado' };
    manager.findOne
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(updated);
    contasService.findActiveManyForWrite.mockResolvedValue([
      { ativa: true, id: 'conta-1' } as Conta,
      { ativa: true, id: 'conta-2' } as Conta,
    ]);

    const result = await service.update('transferencia-1', 'user-1', {
      descricao: 'Pix ajustado',
    });

    expect(manager.findOne).toHaveBeenCalledWith(
      Transferencia,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      Transferencia,
      expect.objectContaining({
        id: 'transferencia-1',
        usuarioId: 'user-1',
      }),
      { descricao: 'Pix ajustado' },
    );
    expect(result).toBe(updated);
    expect(logsService.logEntityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'TRANSFERENCIA_UPDATED' }),
    );
  });

  it('rejects invalid financial values on PATCH before account validation', async () => {
    manager.findOne.mockResolvedValue({
      contaDestinoId: 'conta-2',
      contaOrigemId: 'conta-1',
      id: 'transferencia-1',
      usuarioId: 'user-1',
    } as Transferencia);

    await expect(
      service.update('transferencia-1', 'user-1', { valor: 0 }),
    ).rejects.toBeInstanceOf(ValidationAppException);
    await expect(
      service.update('transferencia-1', 'user-1', { comissao: -1 }),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(contasService.findActiveManyForWrite).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('continues allowing DELETE without active-account validation', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      contaDestinoId: 'conta-inativa-2',
      contaOrigemId: 'conta-inativa-1',
      id: 'transferencia-1',
      usuarioId: 'user-1',
      valor: 100,
    } as Transferencia);

    await service.remove('transferencia-1', 'user-1');

    expect(repository.softDeleteByIdAndUser).toHaveBeenCalledWith(
      'transferencia-1',
      'user-1',
    );
    expect(contasService.findActiveManyForWrite).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('preserves historical list and not-found behavior', async () => {
    const transfer = {
      id: 'transferencia-1',
      usuarioId: 'user-1',
    } as Transferencia;
    repository.findByUser.mockResolvedValue([transfer]);
    repository.findByIdAndUser.mockResolvedValue(null);

    await expect(service.findAll('user-1')).resolves.toEqual([transfer]);
    await expect(
      service.findOne('transferencia-inexistente', 'user-1'),
    ).rejects.toMatchObject({
      code: 'TRANSFERENCIA_NOT_FOUND',
      statusCode: 404,
    });
  });
});
