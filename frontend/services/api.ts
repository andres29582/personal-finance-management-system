import axios, {
  AxiosHeaders,
  InternalAxiosRequestConfig,
  isAxiosError,
} from 'axios';
import {
  clearSession,
  getRefreshToken,
  getToken,
  saveRefreshToken,
  saveToken,
} from '../storage/authStorage';
import { RefreshTokenResponseDto } from '../types/auth';

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export const api = axios.create({
  baseURL,
});

const refreshApi = axios.create({
  baseURL,
});

let refreshPromise: Promise<RefreshTokenResponseDto | null> | null = null;

function isAuthRefreshExcluded(url?: string) {
  if (!url) {
    return false;
  }

  return ['/auth/login', '/auth/register', '/auth/refresh'].some((path) =>
    url.includes(path),
  );
}

async function attachBearerToken(
  config: InternalAxiosRequestConfig,
  token?: string | null,
) {
  const accessToken = token ?? (await getToken());

  if (!accessToken) {
    return config;
  }

  if (config.headers instanceof AxiosHeaders) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  } else {
    config.headers = new AxiosHeaders(config.headers);
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return config;
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getRefreshToken();

      if (!refreshToken) {
        await clearSession();
        return null;
      }

      try {
        const response = await refreshApi.post<RefreshTokenResponseDto>(
          '/auth/refresh',
          {
            refreshToken,
          },
        );

        await saveToken(response.data.access_token);
        await saveRefreshToken(response.data.refresh_token);

        return response.data;
      } catch {
        await clearSession();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  return await attachBearerToken(config);
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!isAxiosError(error) || error.response?.status !== 401 || !error.config) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as RetriableRequestConfig;

    if (originalRequest._retry || isAuthRefreshExcluded(originalRequest.url)) {
      if (originalRequest.url?.includes('/auth/refresh')) {
        await clearSession();
      }

      return Promise.reject(error);
    }

    const refreshedSession = await refreshAccessToken();

    if (!refreshedSession) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    await attachBearerToken(originalRequest, refreshedSession.access_token);

    return api(originalRequest);
  },
);
