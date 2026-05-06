import { AuditLogListResponse } from '../types/audit-log';
import { api } from './api';

export async function listMyAuditLogs(params?: {
  limit?: number;
  offset?: number;
}): Promise<AuditLogListResponse> {
  const response = await api.get<AuditLogListResponse>('/audit-logs', {
    params: {
      limit: params?.limit,
      offset: params?.offset,
    },
  });
  return response.data;
}
