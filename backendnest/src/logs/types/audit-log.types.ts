export type AuditLogLevel = 'info' | 'warn' | 'error';

export type AuditLogModule =
  | 'auth'
  | 'users'
  | 'contas'
  | 'categorias'
  | 'transacoes'
  | 'transferencias'
  | 'pagamentos_divida'
  | 'orcamentos'
  | 'dividas'
  | 'metas'
  | 'alertas'
  | 'dashboard'
  | 'relatorios'
  | 'system';

export type RequestLogContext = {
  method?: string;
  route?: string;
  statusCode?: number;
  ip?: string;
  userAgent?: string;
  userId?: string | null;
};

export type CreateAuditLogInput = {
  level: AuditLogLevel;
  event: string;
  module: AuditLogModule;
  action: string;
  success?: boolean;
  message?: string | null;
  userId?: string | null;
  entity?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  context?: RequestLogContext | null;
};

export type LogAuthEventInput = Omit<
  CreateAuditLogInput,
  'module' | 'action'
> & {
  action?: 'login' | 'logout' | 'reset_password';
};

export type LogEntityEventInput = Omit<CreateAuditLogInput, 'level'> & {
  level?: AuditLogLevel;
};

export type LogAccessDeniedInput = {
  userId?: string | null;
  statusCode: 401 | 403;
  message?: string;
  details?: Record<string, unknown>;
  context?: RequestLogContext | null;
};

export type LogInternalErrorInput = {
  module?: AuditLogModule;
  userId?: string | null;
  message?: string;
  error: unknown;
  details?: Record<string, unknown>;
  context?: RequestLogContext | null;
};
