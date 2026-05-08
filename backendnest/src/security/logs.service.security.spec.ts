import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AuditLog } from '../logs/entities/audit-log.entity';
import { LogsService } from '../logs/logs.service';
import { RequestContextService } from '../logs/request-context.service';

describe('LogsService security', () => {
  let service: LogsService;
  let repository: jest.Mocked<Pick<Repository<AuditLog>, 'create' | 'save'>>;
  let requestContextService: jest.Mocked<Pick<RequestContextService, 'get'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn((entity: Partial<AuditLog>) => entity as AuditLog),
      save: jest.fn().mockResolvedValue(undefined),
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

    service = new LogsService(
      repository as unknown as Repository<AuditLog>,
      requestContextService as unknown as RequestContextService,
      configService as unknown as ConfigService,
    );
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

    const createdLog = repository.create.mock.calls[0][0] as AuditLog;

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
});
