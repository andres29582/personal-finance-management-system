import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SuccessResponse } from '../dto/api-response.dto';
import { resolveRequestId } from '../middleware/request-id.middleware';

/**
 * Interceptor global que envuelve TODAS las respuestas exitosas
 * en el formato estándar: { success: true, data: ..., timestamp, requestId }
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor<
  unknown,
  SuccessResponse<unknown>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<SuccessResponse<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = resolveRequestId(request);
    request.id = requestId;

    return next.handle().pipe(
      map((data) => {
        const response: SuccessResponse<unknown> = {
          success: true,
          data: data === undefined ? null : data,
          timestamp: new Date().toISOString(),
          requestId,
        };
        return response;
      }),
    );
  }
}
