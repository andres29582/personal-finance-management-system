import { api } from "../../../shared/services/api";
import {
  getSessionSnapshot,
  isSessionCurrent,
} from "../../../../storage/authStorage";
import { completeConfirmedSessionRevocation } from "../services/logoutCoordinator";
import * as sessions from "../services/sessionManagement";
jest.mock("../../../shared/services/api");
jest.mock("../../../../storage/authStorage");
jest.mock("../services/logoutCoordinator");
const origin = {
  generation: 1,
  incarnation: "account-a",
  revision: 0,
  sessionId: "a",
  accessToken: "access",
  refreshToken: "refresh",
};
describe("U5 session service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getSessionSnapshot).mockResolvedValue(origin);
    jest.mocked(isSessionCurrent).mockResolvedValue(true);
  });
  it("uses a bounded owner-fenced GET page", async () => {
    jest
      .mocked(api.get)
      .mockResolvedValue({
        data: {
          items: [],
          nextCursor: null,
          serverNow: "2026-10-11T00:00:00Z",
        },
      });
    await sessions.listSessions(origin, "cursor");
    expect(api.get).toHaveBeenCalledWith(
      "/auth/sessions",
      expect.objectContaining({
        params: { limit: 20, cursor: "cursor" },
        _sessionSnapshot: origin,
      }),
    );
  });
  it("accepts an empty 204 remote revocation without a message", async () => {
    jest.mocked(api.post).mockResolvedValue({ status: 204, data: "" });
    await sessions.revokeSession("remote", " password ", origin);
    expect(api.post).toHaveBeenCalledWith(
      "/auth/sessions/remote/revoke",
      { senhaAtual: " password " },
      expect.objectContaining({ _sessionSnapshot: origin }),
    );
    expect(completeConfirmedSessionRevocation).not.toHaveBeenCalled();
  });
  it("cleans up locally only after confirmed global 204", async () => {
    jest.mocked(api.post).mockResolvedValue({ status: 204, data: "" });
    await sessions.revokeAllSessions("password", origin);
    expect(completeConfirmedSessionRevocation).toHaveBeenCalledWith(origin);
    expect(api.post).toHaveBeenCalledTimes(1);
  });
  it("does not clean up locally or replay an ambiguous global outcome", async () => {
    jest.mocked(api.post).mockRejectedValue(new Error("network"));
    await expect(
      sessions.revokeAllSessions("password", origin),
    ).rejects.toThrow();
    expect(completeConfirmedSessionRevocation).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledTimes(1);
  });
  it("never attaches a previous account global result to its replacement", async () => {
    jest.mocked(api.post).mockResolvedValue({ status: 204, data: "" });
    jest.mocked(isSessionCurrent).mockResolvedValue(false);
    await expect(
      sessions.revokeAllSessions("password", origin),
    ).rejects.toThrow();
    expect(completeConfirmedSessionRevocation).not.toHaveBeenCalled();
  });
});
