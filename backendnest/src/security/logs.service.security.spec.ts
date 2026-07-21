import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager, Repository } from 'typeorm';
import { AuditLog } from '../logs/entities/audit-log.entity';
import { LogsService } from '../logs/logs.service';
import { RequestContextService } from '../logs/request-context.service';
import { AuditLogRepository } from '../logs/repositories/audit-log.repository';

describe('LogsService security', () => {
  let service: LogsService;
  let repository: jest.Mocked<
    Pick<AuditLogRepository, 'createAuditLog' | 'saveAuditLog'>
  >;
  let requestContextService: jest.Mocked<Pick<RequestContextService, 'get'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let managerRepository: {
    create: jest.Mock<AuditLog, [Partial<AuditLog>]>;
    save: jest.Mock<Promise<AuditLog>, [AuditLog]>;
  };
  let manager: jest.Mocked<Pick<EntityManager, 'getRepository'>>;

  beforeEach(() => {
    repository = {
      createAuditLog: jest.fn(
        (entity: Partial<AuditLog>) => entity as AuditLog,
      ),
      saveAuditLog: jest.fn().mockResolvedValue({} as AuditLog),
    };
    requestContextService = {
      get: jest.fn(() => ({
        ip: '127.0.0.1',
        method: 'POST',
        route: '/auth/login',
        userAgent: 'jest',
      })),
    };
    configService = {
      get: jest.fn(() => 'test'),
    };
    managerRepository = {
      create: jest.fn((entity) => entity as AuditLog),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };
    manager = {
      getRepository: jest.fn(
        () => managerRepository as unknown as Repository<AuditLog>,
      ),
    };

    service = new LogsService(
      repository as unknown as AuditLogRepository,
      requestContextService as unknown as RequestContextService,
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('redacts sensitive fields and masks personal data in audit log details', async () => {
    await service.create({
      action: 'login',
      details: {
        access_token: 'access-token-plain',
        cpf: '52998224725',
        email: 'ana@example.com',
        nested: {
          refresh_token: 'refresh-token-plain',
          senha: 'senha-plain',
        },
        password: 'password-plain',
        token: 'reset-token-plain',
      },
      event: 'SECURITY_TEST',
      level: 'info',
      module: 'auth',
      userId: 'user-1',
    });

    const createdLog = repository.createAuditLog.mock.calls[0][0] as AuditLog;

    expect(createdLog.details).toEqual({
      access_token: '[REDACTED]',
      cpf: '529***25',
      email: 'ana***@example.com',
      nested: {
        refresh_token: '[REDACTED]',
        senha: '[REDACTED]',
      },
      password: '[REDACTED]',
      token: '[REDACTED]',
    });
    expect(JSON.stringify(createdLog.details)).not.toContain('plain');
  });

  it('uses the active EntityManager repository and sanitizes transactional audit details', async () => {
    const saved = await service.logEntityEventTransactional(
      {
        action: 'update',
        context: { statusCode: 200 },
        details: {
          statusAnterior: 'ABERTO',
          statusPosterior: 'CANCELADO',
          token: 'token-plain',
        },
        entity: 'planejamento',
        entityId: '11111111-1111-1111-1111-111111111111',
        event: 'PLANEJAMENTO_CANCELADO',
        module: 'planejamentos',
        success: true,
        userId: '22222222-2222-2222-2222-222222222222',
      },
      manager as unknown as EntityManager,
    );

    expect(manager.getRepository).toHaveBeenCalledWith(AuditLog);
    expect(repository.createAuditLog).not.toHaveBeenCalled();
    expect(repository.saveAuditLog).not.toHaveBeenCalled();
    expect(managerRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        details: {
          statusAnterior: 'ABERTO',
          statusPosterior: 'CANCELADO',
          token: '[REDACTED]',
        },
        event: 'PLANEJAMENTO_CANCELADO',
        level: 'info',
        module: 'planejamentos',
        statusCode: 200,
        success: true,
      }),
    );
    expect(managerRepository.save).toHaveBeenCalledTimes(1);
    expect(saved).toBe(managerRepository.save.mock.calls[0][0]);
  });

  it('propagates transactional audit persistence failures', async () => {
    const persistenceError = new Error('transactional audit failure');
    managerRepository.save.mockRejectedValue(persistenceError);

    await expect(
      service.logEntityEventTransactional(
        {
          action: 'update',
          event: 'PLANEJAMENTO_FECHADO',
          module: 'planejamentos',
        },
        manager as unknown as EntityManager,
      ),
    ).rejects.toBe(persistenceError);

    expect(repository.saveAuditLog).not.toHaveBeenCalled();
  });

  it('keeps suppressing persistence failures on the existing fail-safe path', async () => {
    const persistenceError = new Error('fail-safe audit failure');
    repository.saveAuditLog.mockRejectedValue(persistenceError);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(
      service.logEntityEvent({
        action: 'create',
        event: 'CONTA_CREATED',
        module: 'contas',
      }),
    ).resolves.toBeUndefined();

    expect(repository.saveAuditLog).toHaveBeenCalledTimes(1);
    expect(manager.getRepository).not.toHaveBeenCalled();
  });
});
