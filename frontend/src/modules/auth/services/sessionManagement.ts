import { AxiosRequestConfig } from "axios";
import { api } from "../../../shared/services/api";
import {
  SessionSnapshot,
  isSessionCurrent,
} from "../../../../storage/authStorage";
import { SessionRequestError } from "../../../../utils/session-error";
import { completeConfirmedSessionRevocation } from "./logoutCoordinator";

export type OwnSession = {
  id: string;
  isCurrent: boolean;
  authenticatedAt: string;
  lastActivityAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  clientDescription: null;
};
export type OwnSessionPage = {
  items: OwnSession[];
  nextCursor: string | null;
  serverNow: string;
};
function ownedConfig(
  origin: SessionSnapshot,
): AxiosRequestConfig & {
  _sessionSnapshot: SessionSnapshot;
  _sessionGeneration: number;
} {
  return {
    timeout: 5000,
    _sessionSnapshot: origin,
    _sessionGeneration: origin.generation,
  };
}
export async function listSessions(
  origin: SessionSnapshot,
  cursor?: string,
): Promise<OwnSessionPage> {
  const response = await api.get<OwnSessionPage>("/auth/sessions", {
    ...ownedConfig(origin),
    params: { limit: 20, cursor },
  });
  if (!(await isSessionCurrent(origin))) throw new SessionRequestError("stale");
  return response.data;
}
async function revoke(
  path: string,
  senhaAtual: string,
  origin: SessionSnapshot,
) {
  const response = await api.post(path, { senhaAtual }, ownedConfig(origin));
  if (!(await isSessionCurrent(origin))) throw new SessionRequestError("stale");
  if (
    response.status !== 204 ||
    (response.data !== "" &&
      response.data !== null &&
      response.data !== undefined)
  )
    throw new SessionRequestError("unavailable");
}
export async function revokeSession(
  id: string,
  senhaAtual: string,
  origin: SessionSnapshot,
): Promise<void> {
  await revoke(
    `/auth/sessions/${encodeURIComponent(id)}/revoke`,
    senhaAtual,
    origin,
  );
}
export async function revokeAllSessions(
  senhaAtual: string,
  origin: SessionSnapshot,
) {
  await revoke("/auth/sessions/revoke-all", senhaAtual, origin);
  return completeConfirmedSessionRevocation(origin);
}
