import { listMyAuditLogs } from '../services/auditLogService';
import { AuditLogItem, AuditLogListResponse } from '../types/audit-log';
import { api } from '../../../shared/services/api';

jest.mock('../../../shared/services/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function makeAuditLog(overrides: Partial<AuditLogItem> = {}): AuditLogItem {
  return {
    action: 'list',
    createdAt: '2026-01-01T00:00:00.000Z',
    details: null,
    entity: null,
    entityId: null,
    event: 'audit.list',
    id: 'audit-1',
    ip: null,
    level: 'info',
    message: null,
    method: 'GET',
    module: 'audit',
    route: '/audit-logs',
    statusCode: 200,
    success: true,
    userAgent: null,
    ...overrides,
  };
}

describe('auditLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lista logs de auditoria com paginacao', async () => {
    const response: AuditLogListResponse = {
      items: [makeAuditLog()],
      total: 1,
    };
    mockedApi.get.mockResolvedValueOnce({ data: response });

    const result = await listMyAuditLogs({ limit: 30, offset: 60 });

    expect(mockedApi.get).toHaveBeenCalledWith('/audit-logs', {
      params: {
        limit: 30,
        offset: 60,
      },
    });
    expect(result).toEqual(response);
  });

  it('lista logs de auditoria sem parametros explicitos', async () => {
    const response: AuditLogListResponse = {
      items: [],
      total: 0,
    };
    mockedApi.get.mockResolvedValueOnce({ data: response });

    const result = await listMyAuditLogs();

    expect(mockedApi.get).toHaveBeenCalledWith('/audit-logs', {
      params: {
        limit: undefined,
        offset: undefined,
      },
    });
    expect(result).toEqual(response);
  });
});
