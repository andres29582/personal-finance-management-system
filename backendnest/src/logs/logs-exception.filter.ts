import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LogsService } from './logs.service';
import { AuditLogModule } from './types/audit-log.types';

@Catch()
export class LogsExceptionFilter implements ExceptionFilter {
  constructor(private readonly logsService: LogsService) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const httpContext = host.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const responsePayload = this.normalizeResponsePayload(exception, status);
    const userId = this.extractUserId(request);
    const context = {
      method: request.method,
      route: request.originalUrl.split('?')[0] || request.url,
      statusCode: status,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId,
    };

    if (status === 401 || status === 403) {
      await this.logsService.logAccessDenied({
        statusCode: status,
        userId,
        message: this.extractMessage(responsePayload),
        details: this.buildAccessDeniedDetails(exception),
        context,
      });
    } else if (status === 500) {
      await this.logsService.logInternalError({
        module: this.resolveModuleFromPath(context.route),
        userId,
        message: this.extractMessage(responsePayload),
        error: exception,
        details: {
          statusCode: status,
        },
        context,
      });
    }

    response.status(status).json(responsePayload);
  }

  private normalizeResponsePayload(
    exception: unknown,
    status: number,
  ): Record<string, unknown> {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          statusCode: status,
          message: response,
        };
      }

      if (typeof response === 'object' && response !== null) {
        return {
          statusCode: status,
          ...response,
        };
      }
    }

    return {
      statusCode: 500,
      message: 'Erro interno no servidor.',
    };
  }

  private extractMessage(payload: Record<string, unknown>): string {
    const message = payload.message;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message
        .filter((item): item is string => typeof item === 'string')
        .join(', ');
    }

    return 'Erro interno no servidor.';
  }

  private buildAccessDeniedDetails(
    exception: unknown,
  ): Record<string, unknown> | undefined {
    if (!(exception instanceof Error)) {
      return undefined;
    }

    return {
      errorName: exception.name,
    };
  }

  private extractUserId(req: Request): string | null {
    const requestUser = req.user;

    if (
      requestUser &&
      typeof requestUser === 'object' &&
      'id' in requestUser &&
      typeof requestUser.id === 'string'
    ) {
      return requestUser.id;
    }

    return null;
  }

  private resolveModuleFromPath(path: string): AuditLogModule {
    const routeSegment = path.replace(/^\//, '').split('/')[0];

    switch (routeSegment) {
      case 'auth':
        return 'auth';
      case 'users':
        return 'users';
      case 'contas':
        return 'contas';
      case 'categorias':
        return 'categorias';
      case 'transacoes':
        return 'transacoes';
      case 'transferencias':
        return 'transferencias';
      case 'pagos-divida':
        return 'pagamentos_divida';
      case 'orcamentos':
        return 'orcamentos';
      case 'dividas':
        return 'dividas';
      case 'metas':
        return 'metas';
      case 'alertas':
        return 'alertas';
      case 'dashboard':
        return 'dashboard';
      case 'relatorios':
        return 'relatorios';
      default:
        return 'system';
    }
  }
}
