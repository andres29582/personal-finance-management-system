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
          },
        },
      },
      'Fallback',
    );

    expect(result).toEqual({
      code: 'PREVISAO_INSUFFICIENT_HISTORY',
      details: { requiredMonths: 3, availableMonths: 1 },
      message: 'Historico insuficiente.',
      unauthorized: false,
    });
  });
  it('permite personalizar a mensagem de 401 no login', async () => {
    const result = await resolveApiError(
      {
        response: {
          data: {
            message: 'E-mail ou senha invalidos',
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
      message: 'E-mail ou senha invalidos.',
      unauthorized: true,
    });
    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  it('mantem a mensagem de sessao expirada para 401 sem override', async () => {
    const result = await resolveApiError(
      {
        response: {
          data: {
            message: 'Sessao invalida',
          },
          status: 401,
        },
      },
      'Nao foi possivel carregar os dados.',
    );

    expect(result).toEqual({
      message: 'Sessao expirada. Faca login novamente.',
      unauthorized: true,
    });
    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  it('usa a mensagem do backend em erros nao autenticados', async () => {
    const result = await resolveApiError(
      {
        response: {
          data: {
            message: 'E-mail ja cadastrado',
          },
          status: 409,
        },
      },
      'Nao foi possivel criar a conta.',
    );

    expect(result).toEqual({
      message: 'E-mail ja cadastrado',
      unauthorized: false,
    });
    expect(mockClearSession).not.toHaveBeenCalled();
  });
});
