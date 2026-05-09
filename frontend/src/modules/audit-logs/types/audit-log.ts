export type AuditLogItem = {
  id: string;
  createdAt: string;
  level: string;
  event: string;
  module: string;
  action: string;
  success: boolean;
  message: string | null;
  entity: string | null;
  entityId: string | null;
  method: string | null;
  route: string | null;
  statusCode: number | null;
  ip: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
};

export type AuditLogListResponse = {
  total: number;
  items: AuditLogItem[];
};
