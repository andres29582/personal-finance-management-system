import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { SuccessResponse } from '../dto/api-response.dto';

/**
 * Interceptor global que envuelve TODAS las respuestas exitosas
 * en el formato estándar: { success: true, data: ..., timestamp, requestId }
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.id || uuid();

    return next.handle().pipe(
      map((data) => {
        const response: SuccessResponse<any> = {
          success: true,
          data,
          timestamp: new Date().toISOString(),
          requestId,
        };
        return response;
      }),
    );
  }
}
