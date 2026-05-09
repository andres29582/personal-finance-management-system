import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { RequestContextService } from './request-context.service';
import {
  CreateAuditLogInput,
  LogAccessDeniedInput,
  LogAuthEventInput,
  LogEntityEventInput,
  LogInternalErrorInput,
  RequestLogContext,
} from './types/audit-log.types';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly requestContextService: RequestContextService,
    private readonly configService: ConfigService,
  ) {}

  async create(input: CreateAuditLogInput): Promise<void> {
    const context = this.resolveContext(input.context);
    const entity = this.auditLogRepository.create({
      id: randomUUID(),
      level: input.level,
      event: input.event,
      module: input.module,
      action: input.action,
      success: input.success ?? true,
      message: this.truncate(input.message ?? null, 255),
      userId: input.userId ?? context.userId ?? null,
      entity: input.entity ?? null,
      entityId: input.entityId ?? null,
      method: context.method ?? null,
      route: this.truncate(context.route ?? null, 255),
      statusCode: context.statusCode ?? null,
      ip: this.truncate(context.ip ?? null, 45),
      userAgent: this.truncate(context.userAgent ?? null, 255),
      details: this.sanitizeDetails(input.details),
    });

    await this.persistSafely(entity);
  }

  async logAuthEvent(input: LogAuthEventInput): Promise<void> {
    await this.create({
      ...input,
      module: 'auth',
      action: input.action ?? this.resolveAuthAction(input.event),
      level: input.level,
      success: input.success ?? true,
    });
  }

  async logEntityEvent(input: LogEntityEventInput): Promise<void> {
    await this.create({
      ...input,
      level: input.level ?? 'info',
      success: input.success ?? true,
    });
  }

  async logAccessDenied(input: LogAccessDeniedInput): Promise<void> {
    await this.create({
      level: 'warn',
      event: input.statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
      module: 'system',
      action: 'access_denied',
      success: false,
      message: input.message ?? 'Acesso negado.',
      userId: input.userId ?? null,
      details: input.details ?? null,
      context: {
        ...input.context,
        statusCode: input.statusCode,
      },
    });
  }

  async findAuditLogsForUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{
    total: number;
    items: Array<{
      id: string;
      createdAt: Date;
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
    }>;
  }> {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = Math.max(offset, 0);
    const [rows, total] = await this.auditLogRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });

    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        level: row.level,
        event: row.event,
        module: row.module,
        action: row.action,
        success: row.success,
        message: row.message,
        entity: row.entity,
        entityId: row.entityId,
        method: row.method,
        route: row.route,
        statusCode: row.statusCode,
        ip: row.ip,
        userAgent: row.userAgent,
        details: row.details,
      })),
    };
  }

  async logInternalError(input: LogInternalErrorInput): Promise<void> {
    await this.create({
      level: 'error',
      event: 'INTERNAL_SERVER_ERROR',
      module: input.module ?? 'system',
      action: 'server_error',
      success: false,
      message: input.message ?? 'Erro interno no servidor.',
      userId: input.userId ?? null,
      details: {
        ...this.serializeError(input.error),
        ...(input.details ?? {}),
      },
      context: {
        ...input.context,
        statusCode: 500,
      },
    });
  }

  private async persistSafely(entity: AuditLog): Promise<void> {
    try {
      await this.auditLogRepository.save(entity);
    } catch (error) {
      const trace =
        error instanceof Error ? (error.stack ?? error.message) : String(error);

      this.logger.error('Falha ao persistir audit_log.', trace);
    }
  }

  private resolveContext(
    override?: RequestLogContext | null,
  ): RequestLogContext {
    return {
      ...this.requestContextService.get(),
      ...(override ?? {}),
    };
  }

  private resolveAuthAction(
    event: string,
  ): 'login' | 'logout' | 'reset_password' {
    if (event.includes('LOGOUT')) {
      return 'logout';
    }

    if (event.includes('PASSWORD_RESET')) {
      return 'reset_password';
    }

    return 'login';
  }

  private sanitizeDetails(
    details?: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!details) {
      return null;
    }

    return Object.fromEntries(
      Object.entries(details).map(([key, value]) => [
        key,
        this.sanitizeValue(key, value),
      ]),
    );
  }

  private sanitizeValue(key: string, value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (this.isSensitiveKey(key)) {
      return '[REDACTED]';
    }

    if (key.toLowerCase().includes('email') && typeof value === 'string') {
      return this.maskEmail(value);
    }

    if (key.toLowerCase().includes('cpf') && typeof value === 'string') {
      return this.maskCpf(value);
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string') {
      return this.truncate(value, 500);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(key, item));
    }

    if (typeof value === 'object') {
      return this.sanitizeDetails(value as Record<string, unknown>);
    }

    return value;
  }

  private isSensitiveKey(key: string): boolean {
    const normalizedKey = key.toLowerCase();

    return [
      'senha',
      'password',
      'token',
      'access_token',
      'refresh_token',
      'authorization',
    ].some((sensitive) => normalizedKey.includes(sensitive));
  }

  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');

    if (!name || !domain) {
      return '[INVALID_EMAIL]';
    }

    const visibleCharacters = name.length >= 3 ? name.slice(0, 3) : name[0];

    return `${visibleCharacters}***@${domain}`;
  }

  private maskCpf(cpf: string): string {
    const digits = cpf.replace(/\D/g, '');

    if (digits.length !== 11) {
      return '[INVALID_CPF]';
    }

    return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
  }

  private serializeError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      const shouldIncludeStack =
        this.configService.get<string>('NODE_ENV') === 'development';

      return {
        errorName: error.name,
        errorMessage: this.truncate(error.message, 255),
        ...(shouldIncludeStack
          ? {
              stack: this.truncate(error.stack ?? '', 2000),
            }
          : {}),
      };
    }

    return {
      errorName: 'UnknownError',
      errorMessage: 'Erro desconhecido.',
    };
  }

  private truncate(value: string | null, maxLength: number): string | null {
    if (!value) {
      return value;
    }

    return value.length > maxLength
      ? `${value.slice(0, maxLength - 3)}...`
      : value;
  }
}
