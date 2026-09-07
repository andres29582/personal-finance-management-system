import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponse } from '../common/dto/api-response.dto';
import { AppException } from '../common/exceptions/app.exception';
import { applyRequestId } from '../common/middleware/request-id.middleware';
import { LogsService } from './logs.service';
import { AuditLogModule } from './types/audit-log.types';

const HTTP_ERROR_CODES: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
};

const PUBLIC_SERVER_ERROR_CODES = new Set(['CEP_LOOKUP_UNAVAILABLE']);

const PUBLIC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  BAD_GATEWAY: 'Servico externo indisponivel.',
  CEP_LOOKUP_UNAVAILABLE: 'Nao foi possivel consultar o CEP.',
  INTERNAL_SERVER_ERROR: 'Erro interno no servidor.',
  PAYLOAD_TOO_LARGE: 'Payload da requisicao excede o limite permitido.',
  SERVICE_UNAVAILABLE: 'Servico temporariamente indisponivel.',
  TOO_MANY_REQUESTS: 'Muitas requisicoes. Tente novamente mais tarde.',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly logsService: LogsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const status = this.resolveStatus(exception);
    const requestId = applyRequestId(request, response);
    const responsePayload = this.buildResponsePayload(
      exception,
      status,
      requestId,
    );

    response.status(status).json(responsePayload);

    void this.auditError(exception, request, responsePayload, status).catch(
      (loggingError: unknown) => {
        const trace =
          loggingError instanceof Error
            ? (loggingError.stack ?? loggingError.message)
            : String(loggingError);
        this.logger.error('Falha ao registrar erro HTTP.', trace);
      },
    );
  }

  private buildResponsePayload(
    exception: unknown,
    status: number,
    requestId: string,
  ): ErrorResponse {
    const error =
      status >= 500
        ? this.buildServerError(exception, status)
        : this.buildClientError(exception, status);

    return {
      success: false,
      error,
      timestamp: new Date().toISOString(),
      requestId,
    };
  }

  private buildServerError(
    exception: unknown,
    status: number,
  ): ErrorResponse['error'] {
    const appCode =
      exception instanceof AppException &&
      PUBLIC_SERVER_ERROR_CODES.has(exception.code)
        ? exception.code
        : undefined;
    const code = appCode ?? HTTP_ERROR_CODES[status] ?? 'INTERNAL_SERVER_ERROR';

    return {
      code,
      message:
        PUBLIC_ERROR_MESSAGES[code] ??
        PUBLIC_ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    };
  }

  private buildClientError(
    exception: unknown,
    status: number,
  ): ErrorResponse['error'] {
    if (exception instanceof AppException) {
      return {
        code: exception.code,
        message: exception.message,
        ...(exception.field ? { field: exception.field } : {}),
        ...(exception.details ? { details: exception.details } : {}),
      };
    }

    const validationMessages = this.extractValidationMessages(
      exception,
      status,
    );

    if (validationMessages) {
      return {
        code: 'VALIDATION_ERROR',
        message: validationMessages[0],
        details: { messages: validationMessages },
      };
    }

    const code = HTTP_ERROR_CODES[status] ?? 'HTTP_ERROR';

    return {
      code,
      message:
        PUBLIC_ERROR_MESSAGES[code] ??
        this.extractHttpExceptionMessage(exception) ??
        'Erro ao processar a requisicao.',
    };
  }

  private extractValidationMessages(
    exception: unknown,
    status: number,
  ): string[] | undefined {
    if (!(exception instanceof HttpException) || status !== 400) {
      return undefined;
    }

    const response = exception.getResponse();

    if (typeof response !== 'object' || response === null) {
      return undefined;
    }

    const message = (response as Record<string, unknown>).message;

    if (!Array.isArray(message)) {
      return undefined;
    }

    const messages = message.filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    );

    return messages.length > 0 ? messages : undefined;
  }

  private extractHttpExceptionMessage(exception: unknown): string | undefined {
    if (!(exception instanceof HttpException)) {
      return undefined;
    }

    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (typeof response !== 'object' || response === null) {
      return undefined;
    }

    const message = (response as Record<string, unknown>).message;

    return typeof message === 'string' && message.length > 0
      ? message
      : undefined;
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof AppException) {
      return exception.statusCode;
    }

    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (typeof exception === 'object' && exception !== null) {
      const candidate = exception as Record<string, unknown>;
      const status = candidate.statusCode ?? candidate.status;

      if (
        typeof status === 'number' &&
        Number.isInteger(status) &&
        status >= 400 &&
        status <= 599
      ) {
        return status;
      }
    }

    return 500;
  }

  private async auditError(
    exception: unknown,
    request: Request,
    responsePayload: ErrorResponse,
    status: number,
  ): Promise<void> {
    const userId = this.extractUserId(request);
    const context = {
      method: request.method,
      route: request.originalUrl.split('?')[0] || request.url,
      statusCode: status,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId,
    };
    const details = {
      requestId: responsePayload.requestId,
      statusCode: status,
    };

    if (status === 401 || status === 403) {
      await this.logsService.logAccessDenied({
        statusCode: status,
        userId,
        message: responsePayload.error.message,
        details,
        context,
      });
    } else if (status >= 500) {
      await this.logsService.logInternalError({
        module: this.resolveModuleFromPath(context.route),
        userId,
        message: responsePayload.error.message,
        error: exception,
        details,
        context,
      });
    }
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
      case 'planejamentos':
        return 'planejamentos';
      default:
        return 'system';
    }
  }
}
