import { beforeEach, expect, it, jest } from "@jest/globals";
import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

let generation = 0;
let accessToken: string | null = null;
const dispatch = jest.fn<AxiosAdapter>();
const rotate = jest.fn();
const clear = jest.fn();
let api: typeof import("../../src/shared/services/api").api;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  generation = 0;
  accessToken = null;
  jest.doMock("../../storage/authStorage", () => ({
    getSessionGeneration: () => generation,
    getSessionSnapshot: async () => ({
      generation,
      incarnation: "public-fixture",
      revision: 0,
      sessionId: null,
      accessToken,
      refreshToken: null,
    }),
    isSessionCurrent: async () => false,
    rotateSession: rotate,
    clearSessionIfCurrent: clear,
  }));
  jest.doMock("../../src/modules/auth/services/sessionAuthority", () => ({
    getSessionAuthorityEpoch: () => 0,
    recordSessionAuthority: jest.fn(),
    suspendOwnedSessionAuthority: jest.fn(),
  }));
  const axios = jest.requireActual<typeof import("axios")>("axios");
  axios.default.defaults.adapter = dispatch;
  api = jest.requireActual<typeof import("../../src/shared/services/api")>(
    "../../src/shared/services/api",
  ).api;
  dispatch.mockImplementation(async (config: InternalAxiosRequestConfig) => ({
    config,
    data: {
      success: true,
      data: { cep: "01001000", endereco: "Rua de teste" },
    },
    status: 200,
    statusText: "OK",
    headers: {},
  }));
});

it("dispatches and unwraps public CEP while signed out", async () => {
  const response = await api.get("/cep/01001000");
  expect(response.data).toEqual({ cep: "01001000", endereco: "Rua de teste" });
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(rotate).not.toHaveBeenCalled();
  expect(clear).not.toHaveBeenCalled();
});

it("never attaches credentials or refreshes a rejected public CEP request", async () => {
  accessToken = "synthetic-present-credential";
  dispatch.mockImplementation(async (config) => {
    expect(config.headers.get("Authorization")).toBeUndefined();
    throw { config, isAxiosError: true, response: { status: 401, data: {} } };
  });
  await expect(api.get("/cep/01001000")).rejects.toMatchObject({
    response: { status: 401 },
  });
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(rotate).not.toHaveBeenCalled();
  expect(clear).not.toHaveBeenCalled();
});

it.each(["/contas", "/contas/cep/01001000", "/cep/01001000/private"])(
  "keeps ownership checks for %s",
  async (url) => {
    await expect(api.get(url)).rejects.toMatchObject({
      sessionFailure: "stale",
    });
    expect(dispatch).not.toHaveBeenCalled();
  },
);

it("rejects a public CEP response from an earlier generation", async () => {
  let release!: (response: AxiosResponse) => void;
  let entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  dispatch.mockImplementation(async (config) => {
    const pending = new Promise<AxiosResponse>((resolve) => {
      release = resolve;
    });
    entered();
    const response = await pending;
    return { ...response, config };
  });
  const pending = api.get("/cep/01001000");
  const rejected = expect(pending).rejects.toMatchObject({
    code: "ERR_CANCELED",
  });
  await ready;
  generation++;
  release({
    data: {},
    headers: {},
    status: 200,
    statusText: "OK",
  } as AxiosResponse);
  await rejected;
  expect(clear).not.toHaveBeenCalled();
});
