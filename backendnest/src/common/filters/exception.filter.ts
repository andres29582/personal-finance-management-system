import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { AppException } from '../exceptions/app.exception';
import { ErrorResponse } from '../dto/api-response.dto';

/**
 * Exception Filter global que captura AppException
 * y las convierte en respuestas JSON estandarizadas
 */
@Catch(AppException)
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: AppException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.id || uuid();

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: exception.code,
        message: exception.message,
        field: exception.field,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    response.status(exception.statusCode).json(errorResponse);
  }
}
