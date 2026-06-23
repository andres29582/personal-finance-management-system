import { AuditLogsController } from './audit-logs.controller';
import { LogsService } from './logs.service';

describe('AuditLogsController', () => {
  let controller: AuditLogsController;
  let logsService: jest.Mocked<Pick<LogsService, 'findAuditLogsForUser'>>;

  const request = {
    user: {
      id: 'user-1',
      email: 'ana@example.com',
      nome: 'Ana',
      sid: 'session-1',
    },
  } as never;

  beforeEach(() => {
    logsService = {
      findAuditLogsForUser: jest.fn(),
    };

    controller = new AuditLogsController(logsService as unknown as LogsService);
  });

  it('delegates audit log listing using authenticated user id and explicit pagination', async () => {
    logsService.findAuditLogsForUser.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'audit-1',
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
          level: 'info',
          event: 'LOGIN_SUCCESS',
          module: 'auth',
          action: 'login',
          success: true,
          message: 'Login realizado com sucesso.',
          entity: null,
          entityId: null,
          method: 'POST',
          route: '/auth/login',
          statusCode: 200,
          ip: null,
          userAgent: null,
          details: null,
        },
      ],
    });

    const result = await controller.listMine(request, {
      limit: 25,
      offset: 10,
    });

    expect(logsService.findAuditLogsForUser).toHaveBeenCalledWith(
      'user-1',
      25,
      10,
    );
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('audit-1');
  });

  it('uses default pagination when query values are absent', async () => {
    logsService.findAuditLogsForUser.mockResolvedValue({
      total: 0,
      items: [],
    });

    const result = await controller.listMine(request, {});

    expect(logsService.findAuditLogsForUser).toHaveBeenCalledWith(
      'user-1',
      50,
      0,
    );
    expect(result).toEqual({ total: 0, items: [] });
  });
});
