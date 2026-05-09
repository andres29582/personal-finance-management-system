import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

let currentAccessToken: string | null = null;
let currentRefreshToken: string | null = null;

const mockGetToken = jest.fn<() => Promise<string | null>>();
const mockGetRefreshToken = jest.fn<() => Promise<string | null>>();
const mockSaveToken = jest.fn<(token: string) => Promise<void>>();
const mockSaveRefreshToken = jest.fn<(refreshToken: string) => Promise<void>>();
const mockClearSession = jest.fn<() => Promise<void>>();

function buildResponse<T>(
  config: InternalAxiosRequestConfig,
  data: T,
): AxiosResponse<T> {
  return {
    config,
    data,
    headers: {},
    status: 200,
    statusText: 'OK',
  };
}

function buildUnauthorizedError(config: InternalAxiosRequestConfig) {
  return {
    config,
    isAxiosError: true,
    message: 'Unauthorized',
    response: {
      config,
      data: {},
      headers: {},
      status: 401,
      statusText: 'Unauthorized',
    },
    toJSON: () => ({}),
  };
}

function getAuthorization(config: InternalAxiosRequestConfig) {
  const headers = config.headers;

  if (headers && typeof headers.get === 'function') {
    return headers.get('Authorization');
  }

  return undefined;
}

function parseRequestData(data: unknown) {
  if (typeof data === 'string') {
    return JSON.parse(data) as unknown;
  }

  return data;
}

async function loadApi(adapter: AxiosAdapter) {
  jest.resetModules();
  jest.doMock('../../storage/authStorage', () => ({
    clearSession: mockClearSession,
    getRefreshToken: mockGetRefreshToken,
    getToken: mockGetToken,
    saveRefreshToken: mockSaveRefreshToken,
    saveToken: mockSaveToken,
  }));

  const axiosModule = jest.requireActual<typeof import('axios')>('axios');
  axiosModule.default.defaults.adapter = adapter;

  return jest.requireActual<typeof import('../../src/shared/services/api')>(
    '../../src/shared/services/api',
  );
}

beforeEach(() => {
  currentAccessToken = null;
  currentRefreshToken = null;
  jest.clearAllMocks();

  mockGetToken.mockImplementation(async () => currentAccessToken);
  mockGetRefreshToken.mockImplementation(async () => currentRefreshToken);
  mockSaveToken.mockImplementation(async (token) => {
    currentAccessToken = token;
  });
  mockSaveRefreshToken.mockImplementation(async (refreshToken) => {
    currentRefreshToken = refreshToken;
  });
  mockClearSession.mockImplementation(async () => {
    currentAccessToken = null;
    currentRefreshToken = null;
  });
});

describe('api', () => {
  it('adiciona o token Bearer nas requisicoes autenticadas', async () => {
    currentAccessToken = 'access-token-teste';
    const requests: Array<{ authorization: unknown; url?: string }> = [];

    const { api } = await loadApi(async (config) => {
      requests.push({
        authorization: getAuthorization(config),
        url: config.url,
      });

      return buildResponse(config, { ok: true });
    });

    const response = await api.get('/dashboard');

    expect(response.data).toEqual({ ok: true });
    expect(requests).toEqual([
      {
        authorization: 'Bearer access-token-teste',
        url: '/dashboard',
      },
    ]);
    expect(mockGetToken).toHaveBeenCalledTimes(1);
  });

  it('nao adiciona token Bearer nas rotas publicas de autenticacao', async () => {
    currentAccessToken = 'access-token-expirado';
    const requests: Array<{ authorization: unknown; url?: string }> = [];

    const { api } = await loadApi(async (config) => {
      requests.push({
        authorization: getAuthorization(config),
        url: config.url,
      });

      return buildResponse(config, { ok: true });
    });

    await api.post('/auth/login', {
      email: 'demo.financeiro@exemplo.com',
      senha: 'Demo@123456',
    });
    await api.post('/auth/register', {});
    await api.post('/auth/refresh', {
      refreshToken: 'refresh-token-valido',
    });

    expect(requests).toEqual([
      {
        authorization: undefined,
        url: '/auth/login',
      },
      {
        authorization: undefined,
        url: '/auth/register',
      },
      {
        authorization: undefined,
        url: '/auth/refresh',
      },
    ]);
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('renova a sessao depois de 401 e repete a requisicao original', async () => {
    currentAccessToken = 'access-token-expirado';
    currentRefreshToken = 'refresh-token-valido';
    let contasAttempts = 0;
    const contasAuthorizations: unknown[] = [];
    const refreshBodies: unknown[] = [];

    const { api } = await loadApi(async (config) => {
      if (config.url === '/auth/refresh') {
        refreshBodies.push(parseRequestData(config.data));

        return buildResponse(config, {
          access_token: 'access-token-renovado',
          refresh_token: 'refresh-token-renovado',
        });
      }

      if (config.url === '/contas') {
        contasAttempts += 1;
        contasAuthorizations.push(getAuthorization(config));

        if (contasAttempts === 1) {
          return Promise.reject(buildUnauthorizedError(config));
        }

        return buildResponse(config, { contas: [] });
      }

      throw new Error(`URL inesperada no teste: ${config.url}`);
    });

    const response = await api.get('/contas');

    expect(response.data).toEqual({ contas: [] });
    expect(contasAuthorizations).toEqual([
      'Bearer access-token-expirado',
      'Bearer access-token-renovado',
    ]);
    expect(refreshBodies).toEqual([{ refreshToken: 'refresh-token-valido' }]);
    expect(mockSaveToken).toHaveBeenCalledWith('access-token-renovado');
    expect(mockSaveRefreshToken).toHaveBeenCalledWith('refresh-token-renovado');
    expect(mockClearSession).not.toHaveBeenCalled();
  });

  it('limpa sessão se token ausente (null) e retorna 401', async () => {
    currentAccessToken = null;
    currentRefreshToken = null;

    const { api } = await loadApi(async (config) => {
      if (config.url === '/contas') {
        return Promise.reject(buildUnauthorizedError(config));
      }

      throw new Error(`URL inesperada: ${config.url}`);
    });

    await expect(api.get('/contas')).rejects.toBeDefined();
    expect(mockClearSession).toHaveBeenCalled();
  });

  it('limpa sessão se refresh token não existe', async () => {
    currentAccessToken = 'access-token-expirado';
    currentRefreshToken = null;

    const { api } = await loadApi(async (config) => {
      if (config.url === '/contas') {
        return Promise.reject(buildUnauthorizedError(config));
      }

      throw new Error(`URL inesperada: ${config.url}`);
    });

    await expect(api.get('/contas')).rejects.toBeDefined();
    expect(mockClearSession).toHaveBeenCalled();
  });

  it('limpa sessão se refresh token endpoint retorna 401', async () => {
    currentAccessToken = 'access-token-expirado';
    currentRefreshToken = 'refresh-token-invalido';
    let refreshAttempts = 0;

    const { api } = await loadApi(async (config) => {
      if (config.url === '/contas') {
        refreshAttempts === 0
          ? refreshAttempts++
          : (refreshAttempts = refreshAttempts);
        return Promise.reject(buildUnauthorizedError(config));
      }

      if (config.url === '/auth/refresh') {
        // Refresh também retorna 401 (token expirado)
        return Promise.reject(buildUnauthorizedError(config));
      }

      throw new Error(`URL inesperada: ${config.url}`);
    });

    await expect(api.get('/contas')).rejects.toBeDefined();
    expect(mockClearSession).toHaveBeenCalled();
  });

  it('não repete requisição após falha no refresh token', async () => {
    currentAccessToken = 'access-token-expirado';
    currentRefreshToken = 'refresh-token-invalido';
    let contasAttempts = 0;

    const { api } = await loadApi(async (config) => {
      if (config.url === '/contas') {
        contasAttempts += 1;
        return Promise.reject(buildUnauthorizedError(config));
      }

      if (config.url === '/auth/refresh') {
        return Promise.reject(buildUnauthorizedError(config));
      }

      throw new Error(`URL inesperada: ${config.url}`);
    });

    await expect(api.get('/contas')).rejects.toBeDefined();
    // Deve tentar refrescar apenas uma vez, não infinitamente
    expect(contasAttempts).toBe(1);
  });

  it('não tenta renovar token em endpoints de refresh (evita loop infinito)', async () => {
    currentAccessToken = 'access-token-expirado';
    currentRefreshToken = 'refresh-token-invalido';

    const { api } = await loadApi(async (config) => {
      if (config.url === '/auth/refresh') {
        return Promise.reject(buildUnauthorizedError(config));
      }

      throw new Error(`URL inesperada: ${config.url}`);
    });

    await expect(
      api.post('/auth/refresh', { refreshToken: 'token' })
    ).rejects.toBeDefined();
    expect(mockClearSession).toHaveBeenCalled();
  });

  it('rejeita erro 500 sem tentar renovar token', async () => {
    currentAccessToken = 'access-token-valido';

    const { api } = await loadApi(async (config) => {
      if (config.url === '/contas') {
        return Promise.reject({
          config,
          isAxiosError: true,
          message: 'Server Error',
          response: {
            config,
            data: { message: 'Internal Server Error' },
            headers: {},
            status: 500,
            statusText: 'Internal Server Error',
          },
          toJSON: () => ({}),
        });
      }

      throw new Error(`URL inesperada: ${config.url}`);
    });

    await expect(api.get('/contas')).rejects.toBeDefined();
    expect(mockClearSession).not.toHaveBeenCalled();
    expect(mockGetRefreshToken).not.toHaveBeenCalled();
  });

  it('rejeita erro de rede sem tentar renovar token', async () => {
    currentAccessToken = 'access-token-valido';

    const { api } = await loadApi(async () => {
      return Promise.reject(new Error('Network Error'));
    });

    await expect(api.get('/contas')).rejects.toThrow('Network Error');
    expect(mockClearSession).not.toHaveBeenCalled();
  });

  it('permite múltiplos requests concorrentes durante refresh (evita race condition)', async () => {
    currentAccessToken = 'access-token-expirado';
    currentRefreshToken = 'refresh-token-valido';
    let refreshAttempts = 0;

    const { api } = await loadApi(async (config) => {
      if (config.url === '/auth/refresh') {
        refreshAttempts += 1;
        // Simular delay de refresh
        await new Promise((resolve) => setTimeout(resolve, 10));
        return buildResponse(config, {
          access_token: 'access-token-renovado',
          refresh_token: 'refresh-token-renovado',
        });
      }

      if (config.url === '/contas' || config.url === '/transacoes') {
        return Promise.reject(buildUnauthorizedError(config));
      }

      throw new Error(`URL inesperada: ${config.url}`);
    });

    // Fazer múltiples requisiciones en paralelo
    const promises = [api.get('/contas'), api.get('/transacoes')];

    // Ambos deben fallar porque el refresh también falla en este test
    await expect(Promise.all(promises)).rejects.toBeDefined();

    // El refresh no debe intentarse múltiples veces (solo una vez)
    expect(refreshAttempts).toBeLessThanOrEqual(1);
  });
});
