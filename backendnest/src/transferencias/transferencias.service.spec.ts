import {
  BusinessRuleException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import { Conta } from '../contas/entities/conta.entity';
import { ContasService } from '../contas/contas.service';
import { LogsService } from '../logs/logs.service';
import { Transferencia } from './entities/transferencia.entity';
import { TransferenciasService } from './transferencias.service';
import { TransferenciaRepository } from './repositories/transferencia.repository';

describe('TransferenciasService', () => {
  let service: TransferenciasService;
  let repository: jest.Mocked<
    Pick<
      TransferenciaRepository,
      | 'create'
      | 'findByIdAndUser'
      | 'findByUser'
      | 'softDeleteByIdAndUser'
      | 'updateByIdAndUser'
    >
  >;
  let contasService: jest.Mocked<Pick<ContasService, 'findOne'>>;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findByIdAndUser: jest.fn(),
      findByUser: jest.fn(),
      softDeleteByIdAndUser: jest.fn(),
      updateByIdAndUser: jest.fn(),
    };
    contasService = {
      findOne: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new TransferenciasService(
      repository as unknown as TransferenciaRepository,
      contasService as unknown as ContasService,
      logsService as unknown as LogsService,
    );
  });

  it('rejects transfer between the same account', async () => {
    const promise = service.create('user-1', {
      contaDestinoId: 'conta-1',
      contaOrigemId: 'conta-1',
      data: '2026-04-01',
      valor: 100,
    });

    await expect(promise).rejects.toBeInstanceOf(BusinessRuleException);
    await expect(promise).rejects.toMatchObject({
      code: 'TRANSFERENCIA_SAME_ACCOUNT',
      message: 'Conta origem e destino devem ser diferentes',
      statusCode: 400,
    });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects transfer with a non-positive amount', async () => {
    await expect(
      service.create('user-1', {
        contaDestinoId: 'conta-2',
        contaOrigemId: 'conta-1',
        data: '2026-04-01',
        valor: 0,
      }),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(contasService.findOne).not.toHaveBeenCalled();
  });

  it('rejects transfer with a negative commission', async () => {
    await expect(
      service.create('user-1', {
        comissao: -1,
        contaDestinoId: 'conta-2',
        contaOrigemId: 'conta-1',
        data: '2026-04-01',
        valor: 100,
      }),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(contasService.findOne).not.toHaveBeenCalled();
  });

  it('rejects transfer update with a non-positive amount', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      id: 'transferencia-1',
      usuarioId: 'user-1',
      valor: 100,
    } as Transferencia);

    await expect(
      service.update('transferencia-1', 'user-1', {
        valor: 0,
      }),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(repository.updateByIdAndUser).not.toHaveBeenCalled();
  });

  it('rejects transfer update with a negative commission', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      id: 'transferencia-1',
      usuarioId: 'user-1',
      valor: 100,
    } as Transferencia);

    await expect(
      service.update('transferencia-1', 'user-1', {
        comissao: -1,
      }),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(repository.updateByIdAndUser).not.toHaveBeenCalled();
  });

  it('rejects transfer when a loaded account does not belong to the user', async () => {
    contasService.findOne
      .mockResolvedValueOnce({
        id: 'conta-1',
        usuarioId: 'user-1',
      } as Conta)
      .mockResolvedValueOnce({
        id: 'conta-2',
        usuarioId: 'user-2',
      } as Conta);

    const promise = service.create('user-1', {
      contaDestinoId: 'conta-2',
      contaOrigemId: 'conta-1',
      data: '2026-04-01',
      valor: 100,
    });

    await expect(promise).rejects.toBeInstanceOf(ResourceNotFoundException);
    await expect(promise).rejects.toMatchObject({
      code: 'TRANSFERENCIA_ACCOUNT_NOT_FOUND',
      message: 'Conta nao encontrada',
      statusCode: 404,
    });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('creates a transfer when both accounts belong to the user', async () => {
    const transferencia = {
      contaDestinoId: 'conta-2',
      contaOrigemId: 'conta-1',
      data: '2026-04-01',
      id: 'transferencia-1',
      usuarioId: 'user-1',
      valor: 100,
    } as Transferencia;

    contasService.findOne
      .mockResolvedValueOnce({
        id: 'conta-1',
        usuarioId: 'user-1',
      } as Conta)
      .mockResolvedValueOnce({
        id: 'conta-2',
        usuarioId: 'user-1',
      } as Conta);
    repository.create.mockResolvedValue(transferencia);

    const result = await service.create('user-1', {
      contaDestinoId: 'conta-2',
      contaOrigemId: 'conta-1',
      data: '2026-04-01',
      valor: 100,
    });

    expect(contasService.findOne).toHaveBeenCalledWith('conta-1', 'user-1');
    expect(contasService.findOne).toHaveBeenCalledWith('conta-2', 'user-1');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contaDestinoId: 'conta-2',
        contaOrigemId: 'conta-1',
        usuarioId: 'user-1',
        valor: 100,
      }),
    );
    expect(result.id).toBe('transferencia-1');
  });

  it('creates a transfer preserving commission when both accounts belong to the user', async () => {
    const transferencia = {
      comissao: 3.5,
      contaDestinoId: 'conta-2',
      contaOrigemId: 'conta-1',
      data: '2026-04-01',
      id: 'transferencia-1',
      usuarioId: 'user-1',
      valor: 100,
    } as Transferencia;

    contasService.findOne
      .mockResolvedValueOnce({
        id: 'conta-1',
        usuarioId: 'user-1',
      } as Conta)
      .mockResolvedValueOnce({
        id: 'conta-2',
        usuarioId: 'user-1',
      } as Conta);
    repository.create.mockResolvedValue(transferencia);

    await service.create('user-1', {
      comissao: 3.5,
      contaDestinoId: 'conta-2',
      contaOrigemId: 'conta-1',
      data: '2026-04-01',
      valor: 100,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        comissao: 3.5,
        contaDestinoId: 'conta-2',
        contaOrigemId: 'conta-1',
        usuarioId: 'user-1',
        valor: 100,
      }),
    );
  });

  it('updates a transfer using id and user criteria', async () => {
    const transferencia = {
      id: 'transferencia-1',
      usuarioId: 'user-1',
      valor: 100,
    } as Transferencia;

    repository.findByIdAndUser.mockResolvedValue(transferencia);

    await service.update('transferencia-1', 'user-1', {
      descricao: 'Pix ajustado',
    });

    expect(repository.updateByIdAndUser).toHaveBeenCalledWith(
      'transferencia-1',
      'user-1',
      { descricao: 'Pix ajustado' },
    );
  });

  it('lists transfers isolated by user and excluding soft-deleted records', async () => {
    const activeTransfer = {
      excluidoEm: null,
      id: 'transferencia-1',
      usuarioId: 'user-1',
    } as Transferencia;

    repository.findByUser.mockResolvedValue([activeTransfer]);

    const result = await service.findAll('user-1');

    expect(repository.findByUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([activeTransfer]);
  });

  it('finds one transfer using id, user and soft-delete criteria', async () => {
    const activeTransfer = {
      excluidoEm: null,
      id: 'transferencia-1',
      usuarioId: 'user-1',
    } as Transferencia;

    repository.findByIdAndUser.mockResolvedValue(activeTransfer);

    const result = await service.findOne('transferencia-1', 'user-1');

    expect(repository.findByIdAndUser).toHaveBeenCalledWith(
      'transferencia-1',
      'user-1',
    );
    expect(result).toBe(activeTransfer);
  });

  it('lists only transfers that are not soft-deleted', async () => {
    const activeTransfer = {
      excluidoEm: null,
      id: 'transferencia-1',
      usuarioId: 'user-1',
    } as Transferencia;

    repository.findByUser.mockResolvedValue([activeTransfer]);

    const result = await service.findAll('user-1');

    expect(repository.findByUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([activeTransfer]);
  });

  it('does not find a transfer when it is soft-deleted', async () => {
    repository.findByIdAndUser.mockResolvedValue(null);

    const promise = service.findOne('transferencia-1', 'user-1');

    await expect(promise).rejects.toBeInstanceOf(ResourceNotFoundException);
    await expect(promise).rejects.toMatchObject({
      code: 'TRANSFERENCIA_NOT_FOUND',
      message: 'Transferência não encontrada',
      statusCode: 404,
    });

    expect(repository.findByIdAndUser).toHaveBeenCalledWith(
      'transferencia-1',
      'user-1',
    );
  });

  it('soft-deletes a transfer using id and user criteria', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      contaDestinoId: 'conta-2',
      contaOrigemId: 'conta-1',
      id: 'transferencia-1',
      usuarioId: 'user-1',
      valor: 100,
    } as Transferencia);

    await service.remove('transferencia-1', 'user-1');

    expect(repository.softDeleteByIdAndUser).toHaveBeenCalledWith(
      'transferencia-1',
      'user-1',
    );
    expect(logsService.logEntityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'transferencia',
        event: 'TRANSFERENCIA_SOFT_DELETED',
        userId: 'user-1',
      }),
    );
  });
});
