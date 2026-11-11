import { validateSessionState } from "../../src/modules/auth/services/sessionAuthority";
describe("authoritative session metadata", () => {
  it("rejects token presence, missing deadlines and malformed clocks", () => {
    expect(validateSessionState({ access_token: "present" })).toBeNull();
    expect(
      validateSessionState({
        serverNow: "invalid",
        idleExpiresAt: "2026-10-09",
        absoluteExpiresAt: "2026-10-09",
        policyVersion: 1,
      }),
    ).toBeNull();
  });
  it("accepts current server deadlines but never a deadline at equality", () => {
    const valid = {
      serverNow: "2026-10-09T12:00:00.000Z",
      idleExpiresAt: "2026-10-09T12:15:00.000Z",
      absoluteExpiresAt: "2026-10-10T00:00:00.000Z",
      policyVersion: 1,
    };
    expect(validateSessionState(valid)).toEqual(valid);
    expect(
      validateSessionState({ ...valid, idleExpiresAt: valid.serverNow }),
    ).toBeNull();
  });
});
