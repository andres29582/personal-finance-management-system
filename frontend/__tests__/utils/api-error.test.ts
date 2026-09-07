import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { clearSession } from '../../storage/authStorage';
import { resolveApiError } from '../../utils/api-error';

jest.mock('../../storage/authStorage', () => ({
  clearSession: jest.fn(),
}));

const mockClearSession = clearSession as jest.MockedFunction<typeof clearSession>;

beforeEach(() => {
  jest.clearAllMocks();
  mockClearSession.mockResolvedValue(undefined);
});

describe('resolveApiError', () => {
  it('reads typed backend errors and preserves code and details', async () => {
    const result = await resolveApiError(
      {
        response: {
          status: 422,
          data: {
            error: {
              code: 'PREVISAO_INSUFFICIENT_HISTORY',
              message: 'Historico insuficiente.',
              details: { requiredMonths: 3, availableMonths: 1 },
            },
            requestId: 'request-1',
          },
        },
      },
      'Fallback',
    );

    expect(result).toEqual({
      code: 'PREVISAO_INSUFFICIENT_HISTORY',
      details: { requiredMonths: 3, availableMonths: 1 },
      message: 'Historico insuficiente.',
      requestId: 'request-1',
      unauthorized: false,
    });
  });
  it('permite personalizar a mensagem de 401 no login', async () => {
    const result = await resolveApiError(
      {
        response: {
          data: {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Nao autorizado.',
            },
            requestId: 'request-login',
          },
          status: 401,
        },
      },
      'Nao foi possivel entrar agora.',
      {
        401: 'E-mail ou senha invalidos.',
      },
    );

    expect(result).toEqual({
      code: 'UNAUTHORIZED',
      details: undefined,
      message: 'E-mail ou senha invalidos.',
      requestId: 'request-login',
      unauthorized: true,
    });
    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  it('mantem a mensagem de sessao expirada para 401 sem override', async () => {
    const result = await resolveApiError(
      {
        response: {
          data: {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Nao autorizado.',
            },
            requestId: 'request-session',
          },
          status: 401,
        },
      },
      'Nao foi possivel carregar os dados.',
    );

    expect(result).toEqual({
      code: 'UNAUTHORIZED',
      details: undefined,
      message: 'Sessao expirada. Faca login novamente.',
      requestId: 'request-session',
      unauthorized: true,
    });
    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  it('usa a mensagem do backend em erros nao autenticados', async () => {
    const result = await resolveApiError(
      {
        response: {
          data: {
            error: {
              code: 'EMAIL_ALREADY_EXISTS',
              message: 'E-mail ja cadastrado',
            },
            requestId: 'request-conflict',
          },
          status: 409,
        },
      },
      'Nao foi possivel criar a conta.',
    );

    expect(result).toEqual({
      code: 'EMAIL_ALREADY_EXISTS',
      details: undefined,
      message: 'E-mail ja cadastrado',
      requestId: 'request-conflict',
      unauthorized: false,
    });
    expect(mockClearSession).not.toHaveBeenCalled();
  });

  it('preserves the complete validation message list', async () => {
    const result = await resolveApiError(
      {
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'nome must be a string',
              details: {
                messages: ['nome must be a string', 'valor must be positive'],
              },
            },
            requestId: 'request-validation',
          },
        },
      },
      'Fallback',
    );

    expect(result).toEqual({
      code: 'VALIDATION_ERROR',
      details: {
        messages: ['nome must be a string', 'valor must be positive'],
      },
      message: 'nome must be a string',
      requestId: 'request-validation',
      unauthorized: false,
    });
  });

  it.each([
    [404, 'NOT_FOUND', 'Recurso nao encontrado.'],
    [413, 'PAYLOAD_TOO_LARGE', 'Payload excedido.'],
    [429, 'TOO_MANY_REQUESTS', 'Muitas requisicoes.'],
    [500, 'INTERNAL_SERVER_ERROR', 'Erro interno no servidor.'],
    [503, 'SERVICE_UNAVAILABLE', 'Servico temporariamente indisponivel.'],
  ])('resolves the unified envelope for HTTP %i', async (status, code, message) => {
    const result = await resolveApiError(
      {
        response: {
          status,
          data: {
            error: { code, message },
            requestId: `request-${status}`,
          },
        },
      },
      'Fallback',
    );

    expect(result).toEqual({
      code,
      details: undefined,
      message,
      requestId: `request-${status}`,
      unauthorized: false,
    });
  });

  it('uses the caller fallback when no HTTP response exists', async () => {
    const result = await resolveApiError(
      { message: 'Network Error' },
      'Nao foi possivel conectar.',
    );

    expect(result).toEqual({
      code: undefined,
      details: undefined,
      message: 'Nao foi possivel conectar.',
      requestId: undefined,
      unauthorized: false,
    });
  });
});
