import { ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';
import { AppConflictException, ValidationAppException } from '../exceptions';
import { AppExceptionFilter } from './exception.filter';

describe('AppExceptionFilter', () => {
  it('serializes app exceptions with the standard error contract', () => {
    const filter = new AppExceptionFilter();
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const response = { status } as unknown as Response;
    const request = { id: 'request-1' };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    filter.catch(
      new AppConflictException('EMAIL_ALREADY_EXISTS', 'E-mail já cadastrado', {
        field: 'email',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'EMAIL_ALREADY_EXISTS',
        field: 'email',
        message: 'E-mail já cadastrado',
      },
      requestId: 'request-1',
      success: false,
      timestamp: expect.any(String) as string,
    });
  });

  it('serializes structured error details when present', () => {
    const filter = new AppExceptionFilter();
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const response = { status } as unknown as Response;
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'request-2' }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    filter.catch(
      new ValidationAppException(
        'PREVISAO_INSUFFICIENT_HISTORY',
        'Historico insuficiente.',
        {
          details: { requiredMonths: 3, availableMonths: 1 },
        },
      ),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'PREVISAO_INSUFFICIENT_HISTORY',
          details: { requiredMonths: 3, availableMonths: 1 },
          field: undefined,
          message: 'Historico insuficiente.',
        },
      }),
    );
  });
});
