import { Logger } from '@nestjs/common';
import { AuditLog } from './entities/audit-log.entity';
import { LogsService } from './logs.service';
import { RequestContextService } from './request-context.service';
import { AuditLogRepository } from './repositories/audit-log.repository';

describe('LogsService', () => {
  it('keeps raw server causes out of user-visible AuditLog details', async () => {
    const repository = {
      createAuditLog: jest.fn((input: Partial<AuditLog>) => input as AuditLog),
      saveAuditLog: jest.fn().mockResolvedValue(undefined),
    };
    const requestContext = {
      get: jest.fn().mockReturnValue({}),
    };
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const service = new LogsService(
      repository as unknown as AuditLogRepository,
      requestContext as unknown as RequestContextService,
    );

    await service.logInternalError({
      context: { statusCode: 503 },
      details: { requestId: 'request-1', statusCode: 503 },
      error: new Error('postgres://admin:SUPER_SECRET@localhost/finance'),
      message: 'Servico temporariamente indisponivel.',
    });

    expect(repository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        details: { requestId: 'request-1', statusCode: 503 },
        message: 'Servico temporariamente indisponivel.',
        statusCode: 503,
      }),
    );
    const persisted = repository.createAuditLog.mock.calls[0][0];
    expect(JSON.stringify(persisted)).not.toContain('SUPER_SECRET');
    expect(JSON.stringify(persisted)).not.toContain('postgres');
    expect(logger).toHaveBeenCalledWith(
      'Servico temporariamente indisponivel.',
      expect.stringContaining('SUPER_SECRET'),
    );
    logger.mockRestore();
  });
});
