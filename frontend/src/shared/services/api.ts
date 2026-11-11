import {
  recordSessionAuthority,
  getSessionAuthorityEpoch,
  suspendOwnedSessionAuthority,
} from "../../modules/auth/services/sessionAuthority";
import axios, {
  AxiosHeaders,
  AxiosResponse,
  CanceledError,
  InternalAxiosRequestConfig,
  isAxiosError,
} from "axios";
import {
  getSessionSnapshot,
  getSessionGeneration,
  clearSessionIfCurrent,
  SessionSnapshot,
  getToken,
  isSessionCurrent,
  rotateSession,
  REFRESH_TIMEOUT_MS,
} from "../../../storage/authStorage";
import { RefreshTokenResponseDto } from "../../modules/auth/types/auth";
import { SessionRequestError } from "../../../utils/session-error";
const baseURL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _authorityEpoch?: number;
  _sessionGeneration?: number;
  _sessionSnapshot?: SessionSnapshot;
};
type ApiSuccessResponse<T = unknown> = {
  data: T;
  success: true;
};
// Technical transport deadline, not a product response-time objective.
export const API_TIMEOUT_MS = 15000;
export const api = axios.create({
  baseURL,
  timeout: API_TIMEOUT_MS,
});
const refreshApi = axios.create({
  baseURL,
  timeout: REFRESH_TIMEOUT_MS,
});
let refreshGeneration: number | undefined;
let refreshPromise: Promise<RefreshTokenResponseDto | null> | null = null;
function isApiSuccessResponse(value: unknown): value is ApiSuccessResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    "data" in value &&
    (value as { success?: unknown }).success === true
  );
}
function unwrapApiResponse<T>(
  response: AxiosResponse<T | ApiSuccessResponse<T>>,
) {
  if (isApiSuccessResponse(response.data)) {
    response.data = response.data.data as T;
  }

  return response as AxiosResponse<T>;
}
function isAuthRefreshExcluded(url?: string) {
  if (!url) {
    return false;
  }

  return [
    "/auth/login",
    "/auth/register",
    "/auth/refresh",
    "/auth/forgot-password",
    "/auth/reset-password-token",
  ].some((path) => url.includes(path));
}
async function attachBearerToken(
  config: InternalAxiosRequestConfig,
  token?: string | null,
) {
  assertSessionGeneration(config as RetriableRequestConfig);
  const accessToken = token ?? (await getToken());
  assertSessionGeneration(config as RetriableRequestConfig);

  if (!accessToken) {
    return config;
  }

  if (config.headers instanceof AxiosHeaders) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  } else {
    config.headers = new AxiosHeaders(config.headers);
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return config;
}
function assertSessionGeneration(request: RetriableRequestConfig) {
  if (request._sessionGeneration !== getSessionGeneration())
    throw new CanceledError("Authentication changed before request dispatch.");
}
async function clearRejectedSnapshot(snapshot: SessionSnapshot) {
  await clearSessionIfCurrent(snapshot);
  const current = await getSessionSnapshot();
  if (
    current.generation !== snapshot.generation + 1 ||
    current.refreshToken !== null
  )
    throw new SessionRequestError("stale");
  return null;
}
async function refreshAccessToken(snapshot: SessionSnapshot) {
  if (!refreshPromise || refreshGeneration !== snapshot.generation) {
    refreshGeneration = snapshot.generation;
    const operation = (async () => {
      if (snapshot.generation !== getSessionGeneration())
        throw new SessionRequestError("stale");
      if (!snapshot.refreshToken) {
        return clearRejectedSnapshot(snapshot);
      }
      return rotateSession(snapshot, async (refreshToken, signal) => {
        const response = await refreshApi.post<RefreshTokenResponseDto>(
          "/auth/refresh",
          { refreshToken },
          { signal },
        );
        return response.data;
      });
    })();
    refreshPromise = operation;
    const release = () => {
      if (refreshPromise === operation) refreshPromise = null;
    };
    void operation.then(release, release);
  }
  return refreshPromise;
}
export const refreshOwnedSession = refreshAccessToken;
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (config.url?.includes("/auth/refresh"))
    throw new Error("Use refreshOwnedSession for coordinated rotation.");
  const request = config as RetriableRequestConfig;
  request._authorityEpoch ??= getSessionAuthorityEpoch();
  request._sessionSnapshot ??= await getSessionSnapshot();
  request._sessionGeneration ??= request._sessionSnapshot.generation;
  assertSessionGeneration(request);
  if (isAuthRefreshExcluded(config.url)) {
    return config;
  }
  if (!(await isSessionCurrent(request._sessionSnapshot)))
    throw new SessionRequestError("stale");
  await attachBearerToken(config, request._sessionSnapshot.accessToken);
  assertSessionGeneration(request);
  const adapter = axios.getAdapter(config.adapter ?? api.defaults.adapter);
  config.adapter = async (dispatchConfig) => {
    assertSessionGeneration(dispatchConfig as RetriableRequestConfig);
    if (
      !(await isSessionCurrent(
        (dispatchConfig as RetriableRequestConfig)._sessionSnapshot!,
      ))
    )
      throw new SessionRequestError("stale");
    (dispatchConfig as RetriableRequestConfig)._authorityEpoch =
      getSessionAuthorityEpoch();
    return adapter(dispatchConfig);
  };
  return config;
});
refreshApi.interceptors.response.use(unwrapApiResponse);
api.interceptors.response.use(
  async (response) => {
    assertSessionGeneration(response.config as RetriableRequestConfig);
    if (
      !isAuthRefreshExcluded(response.config.url) &&
      !(await isSessionCurrent(
        (response.config as RetriableRequestConfig)._sessionSnapshot!,
      ))
    )
      throw new SessionRequestError("stale");
    const header = response.headers?.["x-session-state"];
    if (typeof header === "string") {
      let state: unknown;
      try {
        state = JSON.parse(header);
      } catch {
        state = null;
      }
      if (state)
        await recordSessionAuthority(
          state,
          (response.config as RetriableRequestConfig)._sessionSnapshot!,
          (response.config as RetriableRequestConfig)._authorityEpoch,
        );
    }
    return unwrapApiResponse(response);
  },
  async (error) => {
    if (
      error?.config &&
      error.config._sessionGeneration !== getSessionGeneration()
    )
      throw new SessionRequestError("stale");
    if (
      error?.config &&
      !isAuthRefreshExcluded(error.config.url) &&
      !(await isSessionCurrent(error.config._sessionSnapshot))
    )
      throw new SessionRequestError("stale");
    if (
      error?.config?._sessionSnapshot &&
      (!error.response || error.response.status >= 500)
    )
      await suspendOwnedSessionAuthority(
        error.config._sessionSnapshot,
        error.config._authorityEpoch,
      );
    if (
      !isAxiosError(error) ||
      error.response?.status !== 401 ||
      !error.config
    ) {
      return Promise.reject(error);
    }
    const originalRequest = error.config as RetriableRequestConfig;
    if (
      !isAuthRefreshExcluded(originalRequest.url) &&
      !(await isSessionCurrent(originalRequest._sessionSnapshot!))
    )
      throw new SessionRequestError("stale");
    if (originalRequest._sessionGeneration !== getSessionGeneration())
      return Promise.reject(error);
    if (originalRequest._retry || isAuthRefreshExcluded(originalRequest.url)) {
      if (
        (originalRequest.url?.includes("/auth/refresh") ||
          originalRequest._retry) &&
        originalRequest._sessionSnapshot
      )
        await clearRejectedSnapshot(originalRequest._sessionSnapshot);
      if (
        isAuthRefreshExcluded(originalRequest.url) &&
        !originalRequest.url?.includes("/auth/refresh")
      )
        (
          error as typeof error & {
            authRequestRejected?: boolean;
          }
        ).authRequestRejected = true;
      return Promise.reject(error);
    }
    const terminalCode = (
      error.response.data as { error?: { code?: string } } | undefined
    )?.error?.code;
    if (
      [
        "AUTH_INVALID_SESSION",
        "AUTH_SESSION_REVOKED",
        "AUTH_SESSION_IDLE_EXPIRED",
        "AUTH_SESSION_ABSOLUTE_EXPIRED",
      ].includes(terminalCode ?? "")
    ) {
      await clearRejectedSnapshot(originalRequest._sessionSnapshot!);
      return Promise.reject(error);
    }
    if (
      !["get", "head", "options"].includes(
        originalRequest.method?.toLowerCase() ?? "get",
      ) &&
      terminalCode !== "AUTH_ACCESS_TOKEN_EXPIRED"
    ) {
      await suspendOwnedSessionAuthority(
        originalRequest._sessionSnapshot!,
        originalRequest._authorityEpoch,
      );
      throw new SessionRequestError("unavailable");
    }
    let refreshedSession: RefreshTokenResponseDto | null;
    try {
      refreshedSession = await refreshAccessToken(
        originalRequest._sessionSnapshot!,
      );
    } catch (failure) {
      await suspendOwnedSessionAuthority(
        originalRequest._sessionSnapshot!,
        originalRequest._authorityEpoch,
      );
      if (
        originalRequest._sessionGeneration !== getSessionGeneration() &&
        !(
          failure instanceof SessionRequestError &&
          failure.sessionFailure === "unknown"
        )
      )
        throw new SessionRequestError("stale");
      throw failure;
    }
    if (
      !refreshedSession ||
      originalRequest._sessionGeneration !== getSessionGeneration()
    ) {
      if (
        originalRequest._sessionGeneration !== getSessionGeneration() &&
        (refreshedSession || (await getToken()))
      )
        throw new SessionRequestError("stale");
      return Promise.reject(error);
    }
    originalRequest._retry = true;
    originalRequest._sessionSnapshot = await getSessionSnapshot();
    await attachBearerToken(originalRequest, refreshedSession.access_token);
    assertSessionGeneration(originalRequest);
    return api(originalRequest);
  },
);
