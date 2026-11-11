import * as storage from "../../../storage/authStorage";
import { api, refreshOwnedSession } from "../../../src/shared/services/api";
import { login } from "../../../src/modules/auth/services/authService";
import {
  getSessionAuthority,
  getSessionAuthorityEpoch,
} from "../../../src/modules/auth/services/sessionAuthority";
import { SessionRequestError } from "../../../utils/session-error";
import { logout } from "../../../src/modules/auth/services/logoutCoordinator";
import "expo-router/entry";

const u4 = {
  async logout() {
    return logout(() => {}).completion;
  },
  async capsule() {
    const snapshot = await storage.getSessionSnapshot();
    return {
      status: snapshot.status,
      sessionId: snapshot.sessionId,
      signedOut: storage.isLocallySignedOut(),
    };
  },
  async request(method: "get" | "patch", path: string, data?: unknown) {
    try {
      const response = await api.request({ method, url: path, data });
      return { ok: true, data: response.data, status: response.status };
    } catch (error: any) {
      return {
        ok: false,
        status: error.response?.status ?? null,
        code: error.response?.data?.error?.code ?? null,
        failure:
          error instanceof SessionRequestError ? error.sessionFailure : null,
      };
    }
  },
  async refresh() {
    await refreshOwnedSession(await storage.getSessionSnapshot());
  },
  async replaceLogin(email: string, senha: string) {
    const origin = await storage.reconcileSession();
    const response = await login({ email, senha });
    return storage.installSession(response, origin);
  },
  async identity() {
    const snapshot = await storage.getSessionSnapshot();
    const token = snapshot.accessToken;
    const payload = token
      ? JSON.parse(
          atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        )
      : null;
    const authority = getSessionAuthority();
    return {
      generation: snapshot.generation,
      sid: payload?.sid ?? null,
      exp: payload?.exp ?? null,
      signedOut: storage.isLocallySignedOut(),
      authority: authority?.state ?? null,
      authorityEpoch: getSessionAuthorityEpoch(),
      authorityOwned:
        !!authority &&
        authority.snapshot.incarnation === snapshot.incarnation &&
        authority.snapshot.sessionId === snapshot.sessionId &&
        authority.snapshot.generation === snapshot.generation,
    };
  },
};
declare global {
  interface Window {
    u4: typeof u4;
  }
}
window.u4 = u4;
