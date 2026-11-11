jest.mock("../../storage/authStorage", () => ({
  getSessionGeneration: () => 1,
  isSessionCurrent: async () => true,
  getSessionSnapshot: async () => ({
    generation: 1,
    incarnation: "owner",
    sessionId: "session",
    accessToken: "token",
  }),
  getToken: async () => "token",
  REFRESH_TIMEOUT_MS: 5000,
}));
jest.mock("../../src/modules/auth/services/sessionAuthority", () => ({
  getSessionAuthorityEpoch: () => 0,
  recordSessionAuthority: async () => {},
  suspendOwnedSessionAuthority: async () => {},
}));
import { api, API_TIMEOUT_MS } from "../../src/shared/services/api";

it("has a finite default and preserves explicit shorter authentication deadlines", async () => {
  expect(API_TIMEOUT_MS).toBeGreaterThan(0);
  expect(api.defaults.timeout).toBe(API_TIMEOUT_MS);
  const adapter = jest.fn(async (config) => ({
    config,
    data: {},
    status: 200,
    statusText: "OK",
    headers: {},
  }));
  await api.post("/auth/login", {}, { timeout: 2000, adapter });
  expect(adapter.mock.calls[0][0].timeout).toBe(2000);
});
it("never automatically replays a timed-out transfer POST", async () => {
  const adapter = jest.fn(async (config) => {
    throw { config, code: "ECONNABORTED" };
  });
  await expect(
    api.post("/transferencias", { idempotencyKey: "stable" }, { adapter }),
  ).rejects.toBeTruthy();
  expect(adapter).toHaveBeenCalledTimes(1);
});
