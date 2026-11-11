import { Platform } from "react-native";
import axios, { AxiosAdapter } from "axios";
import * as storage from "../../storage/authStorage";
import { resolveApiError } from "../../utils/api-error";
import {
  installWebEnvironment,
  loginSession,
} from "../helpers/session-fixtures";
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
const values = new Map<string, string>();
let adapter: AxiosAdapter;
const dispatch: AxiosAdapter = (config) => adapter(config);
let api: typeof import("../../src/shared/services/api").api;
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(async () => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  values.clear();
  installWebEnvironment(values);
  await storage.installSession(
    loginSession(),
    await storage.reconcileSession(),
  );
  axios.defaults.adapter = dispatch;
  api = require("../../src/shared/services/api").api;
  api.defaults.adapter = dispatch;
});
it.each([200, 401, 500])(
  "rejects stale ordinary response %i without exposing A or clearing B",
  async (status) => {
    const entered = deferred(),
      release = deferred();
    adapter = async (config) => {
      entered.resolve();
      await release.promise;
      if (status !== 200)
        throw { isAxiosError: true, config, response: { status } };
      return {
        config,
        headers: {},
        status,
        statusText: "OK",
        data: { privateA: true },
      };
    };
    let payload: unknown;
    const result = api.get("/contas").then(
      (response) => {
        payload = response.data;
        return null;
      },
      (error) => resolveApiError(error, "Fallback"),
    );
    await entered.promise;
    await storage.installSession(
      loginSession("B"),
      await storage.reconcileSession(),
    );
    release.resolve();
    expect(await result).toMatchObject({ unauthorized: false, message: "" });
    expect(payload).toBeUndefined();
    expect(await storage.getToken()).toBe(loginSession("B").access_token);
  },
);
it.each([undefined, 429, 500, 503])(
  "requires reauthentication for ambiguous refresh outcome %s",
  async (status) => {
    let refreshes = 0;
    adapter = async (config) => {
      if (config.url === "/auth/refresh") {
        refreshes++;
        throw {
          isAxiosError: true,
          config,
          response: status ? { status } : undefined,
        };
      }
      throw { isAxiosError: true, config, response: { status: 401 } };
    };
    const result = await api.get("/contas").then(
      () => {
        throw new Error("Expected rejected protected request.");
      },
      (error) => resolveApiError(error, "Fallback"),
    );
    expect(result.unauthorized).toBe(true);
    expect(result.message).toContain("confirmar");
    expect(await storage.getToken()).toBeNull();
    expect(refreshes).toBe(1);
  },
);
it("does not replay a protected financial mutation under another account", async () => {
  const entered = deferred(),
    release = deferred();
  const authorizations: unknown[] = [];
  adapter = async (config) => {
    if (config.url === "/auth/refresh")
      return {
        config,
        headers: {},
        status: 200,
        statusText: "OK",
        data: loginSession("A", "session-A", "1"),
      };
    authorizations.push(config.headers.get("Authorization"));
    throw {
      isAxiosError: true,
      config,
      response: {
        status: 401,
        data: { error: { code: "AUTH_ACCESS_TOKEN_EXPIRED" } },
      },
    };
  };
  const interceptor = api.interceptors.request.use(async (config) => {
    if ((config as unknown as { _retry?: boolean })._retry) {
      entered.resolve();
      await release.promise;
    }
    return config;
  });
  try {
    const request = api
      .post("/transacoes", { valor: 100 })
      .catch((error) => error);
    await entered.promise;
    await storage.installSession(
      loginSession("B"),
      await storage.reconcileSession(),
    );
    release.resolve();
    expect(axios.isCancel(await request)).toBe(true);
    expect(authorizations).toEqual([`Bearer ${loginSession().access_token}`]);
  } finally {
    api.interceptors.request.eject(interceptor);
  }
});
it("bounds refresh and preserves immediate local logout without resurrection", async () => {
  const entered = deferred(),
    release = deferred();
  adapter = async (config) => {
    if (config.url === "/auth/refresh") {
      entered.resolve();
      await release.promise;
      return {
        config,
        headers: {},
        status: 200,
        statusText: "OK",
        data: loginSession("A", "session-A", "1"),
      };
    }
    throw { isAxiosError: true, config, response: { status: 401 } };
  };
  const request = api.get("/contas").catch((error) => error);
  await entered.promise;
  const operation = storage.beginLocalLogout();
  expect(await storage.getToken()).toBeNull();
  release.resolve();
  await request;
  await operation.completion;
  expect(await storage.getToken()).toBeNull();
  expect(await storage.getRefreshToken()).toBeNull();
});
it("does not clear established credentials when public login is rejected", async () => {
  adapter = async (config) => {
    throw { isAxiosError: true, config, response: { status: 401 } };
  };
  const result = await api.post("/auth/login", {}).then(
    () => {
      throw new Error("Expected rejected login.");
    },
    (error) => resolveApiError(error, "Fallback"),
  );
  expect(result.unauthorized).toBe(false);
  expect(await storage.getToken()).toBe(loginSession().access_token);
});
it("preserves current credentials when current-password proof is rejected", async () => {
  adapter = async (config) => {
    throw {
      isAxiosError: true,
      config,
      response: {
        status: 422,
        data: { error: { code: "AUTH_CURRENT_PASSWORD_INVALID" } },
      },
    };
  };
  const result = await api.post("/auth/reset-password", {}).then(
    () => {
      throw new Error("Expected rejected password proof.");
    },
    (error) => resolveApiError(error, "Fallback"),
  );
  expect(result.unauthorized).toBe(false);
  expect(result.code).toBe("AUTH_CURRENT_PASSWORD_INVALID");
  expect(await storage.getToken()).toBe(loginSession().access_token);
});
it("does not send or discard the current snapshot when marker storage fails before HTTP", async () => {
  let refreshes = 0;
  adapter = async (config) => {
    if (config.url === "/auth/refresh") refreshes++;
    throw { isAxiosError: true, config, response: { status: 401 } };
  };
  const write = localStorage.setItem;
  localStorage.setItem = (key, value) => {
    if (value.includes("refreshInFlight")) throw new Error("Denied");
    write(key, value);
  };
  const result = await api.get("/contas").then(
    () => {
      throw new Error("Expected unavailable protected request.");
    },
    (error) => resolveApiError(error, "Fallback"),
  );
  localStorage.setItem = write;
  expect(refreshes).toBe(0);
  expect(result.unauthorized).toBe(false);
  expect(await storage.getToken()).toBe(loginSession().access_token);
});
it("does not allow raw public refresh to bypass the durable coordinator", async () => {
  adapter = jest.fn() as never;
  await expect(
    api.post("/auth/refresh", { refreshToken: loginSession().refresh_token }),
  ).rejects.toThrow("coordinated");
  expect(adapter).not.toHaveBeenCalled();
});
it.each(["http-failure", "publication-failure"])(
  "quarantines locally when post-send unknown persistence is denied (%s)",
  async (failure) => {
    const pendingEntered = deferred(),
      releasePending = deferred(),
      refreshEntered = deferred();
    let refreshes = 0,
      published: unknown;
    adapter = async (config) => {
      if (config.url === "/pending") {
        pendingEntered.resolve();
        await releasePending.promise;
        return {
          config,
          headers: {},
          status: 200,
          statusText: "OK",
          data: { privateA: true },
        };
      }
      if (config.url === "/auth/refresh") {
        refreshes++;
        refreshEntered.resolve();
        if (failure === "http-failure")
          throw new Error("Possible-send response lost");
        return {
          config,
          headers: {},
          status: 200,
          statusText: "OK",
          data: loginSession("A", "session-A", "1"),
        };
      }
      throw { isAxiosError: true, config, response: { status: 401 } };
    };
    const pending = api.get("/pending").then(
      (response) => {
        published = response.data;
      },
      () => {},
    );
    await pendingEntered.promise;
    const origin = await storage.getSessionSnapshot(),
      listener = jest.fn();
    const stop = storage.subscribeAuthState(listener),
      write = localStorage.setItem;
    localStorage.setItem = (key, value) => {
      const status = JSON.parse(value).status;
      if (
        status === "refreshOutcomeUnknown" ||
        (failure === "publication-failure" && status === "valid")
      )
        throw new Error("Post-send storage denied");
      write(key, value);
    };
    try {
      const result = await api.get("/contas").catch((error) => error);
      await refreshEntered.promise;
      releasePending.resolve();
      await pending;
      expect(published).toBeUndefined();
      expect(result).toMatchObject({
        sessionFailure: "unknown",
        sessionDurability: "unconfirmed",
      });
      expect(storage.isLocallySignedOut()).toBe(true);
      expect(storage.getSessionGeneration()).toBeGreaterThan(origin.generation);
      expect(listener).toHaveBeenCalled();
      expect(JSON.parse(values.get(storage.SESSION_KEY)!).status).toBe(
        "refreshInFlight",
      );
      expect(await storage.getToken()).toBeNull();
      expect((await storage.getSessionSnapshot()).status).toBe(
        "refreshOutcomeUnknown",
      );
      expect(await storage.isSessionCurrent(origin)).toBe(false);
      await storage.reconcileSession();
      expect(await storage.getToken()).toBeNull();
      await api.get("/contas").catch(() => {});
      expect(refreshes).toBe(1);
      localStorage.setItem = write;
      await storage.reconcileSession();
      expect(await storage.getToken()).toBeNull();
    } finally {
      releasePending.resolve();
      localStorage.setItem = write;
      stop();
      await pending;
    }
  },
);
it("does not invalidate durable B when a former refresh owner fails after a missed hint", async () => {
  const origin = await storage.getSessionSnapshot(),
    originalA = values.get(storage.SESSION_KEY)!;
  let b!: typeof storage;
  jest.isolateModules(() => {
    b = require("../../storage/authStorage");
  });
  await b.installSession(loginSession("B"), await b.reconcileSession());
  const publishedB = values.get(storage.SESSION_KEY)!;
  // Model owner loss: a previously published B capsule becomes current before the surviving callback finishes.
  values.set(storage.SESSION_KEY, originalA);
  await expect(
    storage.rotateSession(origin, async () => {
      values.set(storage.SESSION_KEY, publishedB);
      throw new Error("Old response lost");
    }),
  ).rejects.toMatchObject({ sessionFailure: "stale" });
  expect(values.get(storage.SESSION_KEY)).toBe(publishedB);
  expect(await b.getToken()).toBe(loginSession("B").access_token);
  await storage.reconcileSession();
  expect(await storage.getToken()).toBe(loginSession("B").access_token);
});

it("separately delayed terminal A 401 cannot clear B or trigger refresh", async () => {
  const entered = deferred(),
    release = deferred();
  let refreshes = 0;
  adapter = async (config) => {
    if (config.url === "/auth/refresh") {
      refreshes++;
      throw new Error("unexpected refresh");
    }
    entered.resolve();
    await release.promise;
    throw {
      isAxiosError: true,
      config,
      response: {
        status: 401,
        data: { error: { code: "AUTH_SESSION_IDLE_EXPIRED" } },
      },
    };
  };
  const pending = api.get("/contas").catch((error) => error);
  await entered.promise;
  await storage.installSession(
    loginSession("B"),
    await storage.reconcileSession(),
  );
  release.resolve();
  expect(await pending).toMatchObject({ sessionFailure: "stale" });
  expect((await storage.getUser())?.id).toBe("B");
  expect(refreshes).toBe(0);
});
