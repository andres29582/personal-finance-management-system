import { AppException } from './app.exception';

export type AppExceptionOptions = {
  field?: string;
};

export class BusinessRuleException extends AppException {
  constructor(code: string, message: string, options?: AppExceptionOptions) {
    super(code, message, 400, options?.field);
  }
}

export class ValidationAppException extends AppException {
  constructor(code: string, message: string, options?: AppExceptionOptions) {
    super(code, message, 422, options?.field);
  }
}

export class ResourceNotFoundException extends AppException {
  constructor(code: string, message: string, options?: AppExceptionOptions) {
    super(code, message, 404, options?.field);
  }
}

export class AppUnauthorizedException extends AppException {
  constructor(code = 'UNAUTHORIZED', message = 'Não autorizado') {
    super(code, message, 401);
  }
}

export class ForbiddenResourceException extends AppException {
  constructor(code = 'FORBIDDEN_RESOURCE', message = 'Acesso negado') {
    super(code, message, 403);
  }
}

export class AppConflictException extends AppException {
  constructor(code: string, message: string, options?: AppExceptionOptions) {
    super(code, message, 409, options?.field);
  }
}

export class ExternalServiceException extends AppException {
  constructor(code: string, message: string) {
    super(code, message, 502);
  }
}

export class InternalServerAppException extends AppException {
  constructor(message = 'Erro interno do servidor') {
    super('INTERNAL_SERVER_ERROR', message, 500);
  }
}

export const BusinessException = BusinessRuleException;
export const ValidationException = ValidationAppException;
export const UnauthorizedException = AppUnauthorizedException;
export const ConflictException = AppConflictException;
export const InternalServerException = InternalServerAppException;
