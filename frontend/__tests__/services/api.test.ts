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

  return jest.requireActual<typeof import('../../services/api')>(
    '../../services/api',
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
});
