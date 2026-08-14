import { EntityManager } from 'typeorm';
import {
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import { ContasService } from '../contas/contas.service';
import { LogsService } from '../logs/logs.service';
import { Divida } from './entities/divida.entity';
import { DividasService } from './dividas.service';
import { DividaRepository } from './repositories/divida.repository';

describe('DividasService', () => {
  let service: DividasService;
  let repository: jest.Mocked<
    Pick<
      DividaRepository,
      | 'create'
      | 'findActiveByUser'
      | 'findByIdAndUser'
      | 'findByIdAndUserForWrite'
      | 'updateByIdAndUser'
    >
  >;
  let contasService: jest.Mocked<Pick<ContasService, 'findOne'>>;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findActiveByUser: jest.fn(),
      findByIdAndUser: jest.fn(),
      findByIdAndUserForWrite: jest.fn(),
      updateByIdAndUser: jest.fn(),
    };
    contasService = {
      findOne: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new DividasService(
      repository as unknown as DividaRepository,
      contasService as unknown as ContasService,
      logsService as unknown as LogsService,
    );
  });

  it('rejects creation with a non-positive total amount', async () => {
    await expect(
      service.create('user-1', {
        fechaInicio: '2026-04-01',
        fechaVencimiento: '2026-12-01',
        montoTotal: 0,
        nome: 'Cartao',
      }),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects creation with a non-positive monthly installment', async () => {
    await expect(
      service.create('user-1', {
        cuotaMensual: -10,
        fechaInicio: '2026-04-01',
        fechaVencimiento: '2026-12-01',
        montoTotal: 1000,
        nome: 'Cartao',
      }),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('updates a debt using id and user criteria', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      id: 'divida-1',
      usuarioId: 'user-1',
    } as Divida);

    await service.update('divida-1', 'user-1', {
      nome: 'Cartao atualizado',
    });

    expect(repository.updateByIdAndUser).toHaveBeenCalledWith(
      'divida-1',
      'user-1',
      { nome: 'Cartao atualizado' },
    );
  });

  it('deactivates a debt using id and user criteria', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      id: 'divida-1',
      montoTotal: 1000,
      usuarioId: 'user-1',
    } as Divida);

    await service.deactivate('divida-1', 'user-1');

    expect(repository.updateByIdAndUser).toHaveBeenCalledWith(
      'divida-1',
      'user-1',
      { ativa: false },
    );
  });

  it('throws a typed not found error when debt does not exist', async () => {
    repository.findByIdAndUser.mockResolvedValue(null);

    await expect(service.findOne('divida-1', 'user-1')).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.findOne('divida-1', 'user-1')).rejects.toMatchObject({
      code: 'DIVIDA_NOT_FOUND',
      message: 'Dívida não encontrada',
      statusCode: 404,
    });
  });

  it.each([
    { ativa: true, description: 'active' },
    { ativa: false, description: 'inactive' },
  ])(
    'returns an owned $description debt for write without filtering its active state',
    async ({ ativa }) => {
      const manager = {} as EntityManager;
      const debt = {
        ativa,
        id: 'divida-1',
        usuarioId: 'user-1',
      } as Divida;
      repository.findByIdAndUserForWrite.mockResolvedValue(debt);

      await expect(
        service.findOneForWrite('divida-1', 'user-1', manager),
      ).resolves.toBe(debt);
      expect(repository.findByIdAndUserForWrite).toHaveBeenCalledWith(
        'divida-1',
        'user-1',
        manager,
      );
    },
  );

  it.each([
    { debtId: 'missing-debt', description: 'missing' },
    { debtId: 'foreign-debt', description: 'owned by another user' },
  ])(
    'keeps a $description debt private in the locked lookup',
    async ({ debtId }) => {
      const manager = {} as EntityManager;
      repository.findByIdAndUserForWrite.mockResolvedValue(null);

      const promise = service.findOneForWrite(debtId, 'user-1', manager);

      await expect(promise).rejects.toBeInstanceOf(ResourceNotFoundException);
      await expect(promise).rejects.toMatchObject({
        code: 'DIVIDA_NOT_FOUND',
        message: 'Dívida não encontrada',
        statusCode: 404,
      });
      expect(repository.findByIdAndUserForWrite).toHaveBeenCalledWith(
        debtId,
        'user-1',
        manager,
      );
    },
  );
});
