import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ErrorResponse } from '../common/dto/api-response.dto';
import {
  AppConflictException,
  ExternalServiceException,
  InternalServerAppException,
} from '../common/exceptions';
import { GlobalExceptionFilter } from './global-exception.filter';
import { LogsService } from './logs.service';

type LogsMock = jest.Mocked<
  Pick<LogsService, 'logAccessDenied' | 'logInternalError'>
>;

describe('GlobalExceptionFilter', () => {
  let logsService: LogsMock;
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    logsService = {
      logAccessDenied: jest.fn().mockResolvedValue(undefined),
      logInternalError: jest.fn().mockResolvedValue(undefined),
    };
    filter = new GlobalExceptionFilter(logsService as unknown as LogsService);
  });

  it('preserves the public AppException contract below 500', () => {
    const result = execute(
      filter,
      new AppConflictException('EMAIL_ALREADY_EXISTS', 'E-mail ja cadastrado', {
        field: 'email',
        details: { source: 'registration' },
      }),
    );

    expect(result.status).toBe(409);
    expect(result.body.error).toEqual({
      code: 'EMAIL_ALREADY_EXISTS',
      details: { source: 'registration' },
      field: 'email',
      message: 'E-mail ja cadastrado',
    });
  });

  it('normalizes ValidationPipe-shaped errors without inferring fields', () => {
    const result = execute(
      filter,
      new BadRequestException({
        error: 'Bad Request',
        message: ['nome must be a string', 'valor must be positive'],
        statusCode: 400,
      }),
    );

    expect(result.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      details: {
        messages: ['nome must be a string', 'valor must be positive'],
      },
      message: 'nome must be a string',
    });
  });

  it.each([
    [new HttpException('Formato invalido', 400), 'Formato invalido'],
    [
      new HttpException(
        { message: 'Recurso ausente', internal: 'ignored' },
        404,
      ),
      'Recurso ausente',
    ],
  ])('normalizes safe HttpException messages', (exception, message) => {
    const result = execute(filter, exception);

    expect(result.body.error.message).toBe(message);
    expect(result.body.error).not.toHaveProperty('internal');
  });

  it('preserves a platform 413 and uses a controlled public message', () => {
    const result = execute(filter, {
      message: 'request entity too large: internal parser detail',
      status: 413,
      statusCode: 413,
    });

    expect(result.status).toBe(413);
    expect(result.body.error).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Payload da requisicao excede o limite permitido.',
    });
  });

  it('normalizes throttling without requiring an E2E request storm', () => {
    const result = execute(filter, new ThrottlerException());

    expect(result.status).toBe(429);
    expect(result.body.error).toEqual({
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas requisicoes. Tente novamente mais tarde.',
    });
  });

  it('keeps the audited CEP code but sanitizes its 502 message', () => {
    const result = execute(
      filter,
      new ExternalServiceException(
        'CEP_LOOKUP_UNAVAILABLE',
        'postgres://admin:SUPER_SECRET@localhost/finance',
      ),
    );

    expect(result.status).toBe(502);
    expect(result.body.error).toEqual({
      code: 'CEP_LOOKUP_UNAVAILABLE',
      message: 'Nao foi possivel consultar o CEP.',
    });
  });

  it.each([
    [
      new ServiceUnavailableException('ML_API_KEY=SUPER_SECRET'),
      503,
      'SERVICE_UNAVAILABLE',
      'Servico temporariamente indisponivel.',
    ],
    [
      new InternalServerAppException(
        'postgres://admin:SUPER_SECRET@localhost/finance',
      ),
      500,
      'INTERNAL_SERVER_ERROR',
      'Erro interno no servidor.',
    ],
    [
      new Error('postgres://admin:SUPER_SECRET@localhost/finance'),
      500,
      'INTERNAL_SERVER_ERROR',
      'Erro interno no servidor.',
    ],
  ])(
    'sanitizes server errors before class-specific handling',
    (exception, status, code, message) => {
      const result = execute(filter, exception);
      const serialized = JSON.stringify(result.body);

      expect(result.status).toBe(status);
      expect(result.body.error).toEqual({ code, message });
      expect(serialized).not.toContain('postgres');
      expect(serialized).not.toContain('admin');
      expect(serialized).not.toContain('SUPER_SECRET');
      expect(serialized).not.toContain('localhost');
      expect(serialized).not.toContain('stack');
    },
  );

  it('repairs a missing requestId across header, body and audit metadata', () => {
    const result = execute(filter, new Error('unexpected'), { id: undefined });

    expect(result.body.requestId).toEqual(expect.any(String));
    expect(result.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      result.body.requestId,
    );
    expect(logsService.logInternalError).toHaveBeenCalledWith(
      expect.objectContaining({
        details: {
          requestId: result.body.requestId,
          statusCode: 500,
        },
      }),
    );
  });

  it('sends the response before starting best-effort logging', () => {
    execute(filter, new Error('unexpected'));

    const responseOrder = lastExecution!.json.mock.invocationCallOrder[0];
    const loggingOrder =
      logsService.logInternalError.mock.invocationCallOrder[0];
    expect(responseOrder).toBeLessThan(loggingOrder);
  });

  it('keeps the response when best-effort logging rejects', async () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    logsService.logInternalError.mockRejectedValue(
      new Error('log unavailable'),
    );

    const result = execute(filter, new Error('unexpected'));
    await new Promise((resolve) => setImmediate(resolve));

    expect(result.status).toBe(500);
    expect(result.json).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalled();
    logger.mockRestore();
  });
});

let lastExecution:
  | {
      json: jest.Mock;
    }
  | undefined;

function execute(
  filter: GlobalExceptionFilter,
  exception: unknown,
  requestOverrides: Partial<Request> = {},
) {
  let capturedBody: ErrorResponse | undefined;
  let capturedStatus: number | undefined;
  const json = jest.fn((body: ErrorResponse) => {
    capturedBody = body;
  });
  const setHeader = jest.fn();
  const status = jest.fn((value: number) => {
    capturedStatus = value;

    return response;
  });
  const response = {
    json,
    setHeader,
    status,
  } as unknown as Response;
  const request = {
    headers: {},
    id: 'request-1',
    ip: '127.0.0.1',
    method: 'GET',
    originalUrl: '/contas?active=true',
    url: '/contas?active=true',
    ...requestOverrides,
  } as Request;
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  filter.catch(exception, host);
  lastExecution = { json };

  if (!capturedBody || capturedStatus === undefined) {
    throw new Error('Expected the filter to write an HTTP response.');
  }

  return {
    body: capturedBody,
    json,
    setHeader,
    status: capturedStatus,
  };
}
