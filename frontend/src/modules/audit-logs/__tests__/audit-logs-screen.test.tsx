import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { AuditLogsScreen } from '../screens/AuditLogsScreen';
import * as auditLogService from '../services/auditLogService';
import * as authStorage from '../../../../storage/authStorage';
import { AuditLogItem } from '../types/audit-log';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('../services/auditLogService');
jest.mock('../../../../storage/authStorage');

const mockListMyAuditLogs = auditLogService.listMyAuditLogs as jest.MockedFunction<typeof auditLogService.listMyAuditLogs>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<typeof authStorage.clearSession>;

const auditLog: AuditLogItem = {
  action: 'CREATE',
  createdAt: '2026-06-01T10:00:00.000Z',
  details: null,
  entity: 'Transacao',
  entityId: 'transacao1',
  event: 'TRANSACAO_CREATED',
  id: 'audit1',
  ip: null,
  level: 'info',
  message: 'Transacao criada com sucesso',
  method: 'POST',
  module: 'transacoes',
  route: '/transacoes',
  statusCode: 201,
  success: true,
  userAgent: null,
};

describe('AuditLogsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearSession.mockResolvedValue(undefined);
    mockListMyAuditLogs.mockResolvedValue({
      items: [auditLog],
      total: 31,
    });
  });

  it('renders audit log event, status and message', async () => {
    render(<AuditLogsScreen />);

    await waitFor(() => {
      expect(mockListMyAuditLogs).toHaveBeenCalledWith({ limit: 30, offset: 0 });
      expect(screen.getByText('Log de auditoria')).toBeTruthy();
      expect(screen.getByText('TRANSACAO_CREATED')).toBeTruthy();
      expect(screen.getByText('Sucesso')).toBeTruthy();
      expect(screen.getByText('Transacao criada com sucesso')).toBeTruthy();
      expect(screen.getByText(/transacoes\.CREATE/)).toBeTruthy();
    });
  });

  it('loads next page when pagination is available', async () => {
    render(<AuditLogsScreen />);

    await waitFor(() => {
      expect(screen.getByText('TRANSACAO_CREATED')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Proxima'));

    await waitFor(() => {
      expect(mockListMyAuditLogs).toHaveBeenLastCalledWith({
        limit: 30,
        offset: 30,
      });
    });
  });

  it('refreshes current page from header action', async () => {
    render(<AuditLogsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Atualizar')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Atualizar'));

    await waitFor(() => {
      expect(mockListMyAuditLogs).toHaveBeenCalledTimes(2);
      expect(mockListMyAuditLogs).toHaveBeenLastCalledWith({
        limit: 30,
        offset: 0,
      });
    });
  });

  it('redirects to login when audit log request returns unauthorized', async () => {
    mockListMyAuditLogs.mockRejectedValue({
      response: { status: 401, data: { message: 'Unauthorized' } },
    });

    render(<AuditLogsScreen />);

    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });
});
