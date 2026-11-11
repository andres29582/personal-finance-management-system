import {
  getSessionSnapshot,
  isSessionCurrent,
  SessionSnapshot,
} from "../../../../storage/authStorage";
import { SessionRequestError } from "../../../../utils/session-error";

export type SessionState = {
  serverNow: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  policyVersion: number;
};
export type Authority = {
  snapshot: SessionSnapshot;
  state: SessionState;
  receivedAt: number;
} | null;
let authority: Authority = null;
let authorityEpoch = 0;
let confirmedEpoch: number | null = null;
export function getSessionAuthorityEpoch() {
  return authorityEpoch;
}
const listeners = new Set<() => void>();
export function validateSessionState(value: unknown): SessionState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as SessionState;
  if (
    state.policyVersion !== 1 ||
    [state.serverNow, state.idleExpiresAt, state.absoluteExpiresAt].some(
      (date) => typeof date !== "string" || !Number.isFinite(Date.parse(date)),
    )
  )
    return null;
  if (
    Date.parse(state.idleExpiresAt) <= Date.parse(state.serverNow) ||
    Date.parse(state.absoluteExpiresAt) < Date.parse(state.idleExpiresAt)
  )
    return null;
  return {
    serverNow: state.serverNow,
    idleExpiresAt: state.idleExpiresAt,
    absoluteExpiresAt: state.absoluteExpiresAt,
    policyVersion: 1,
  };
}
export function getSessionAuthority(): Authority {
  return authority;
}
export function subscribeSessionAuthority(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export async function recordSessionAuthority(
  value: unknown,
  snapshot: SessionSnapshot,
  epoch = authorityEpoch,
  confirmation = false,
) {
  const state = validateSessionState(value);
  if (
    !state ||
    epoch !== authorityEpoch ||
    (!confirmation && confirmedEpoch !== epoch) ||
    !(await isSessionCurrent(snapshot))
  )
    return false;
  // Storage reconciliation can suspend authority while the ownership check awaits.
  if (epoch !== authorityEpoch) return false;
  if (confirmation) confirmedEpoch = epoch;
  authority = { snapshot, state, receivedAt: Date.now() };
  listeners.forEach((listener) => listener());
  return true;
}
export function suspendSessionAuthority() {
  authorityEpoch++;
  confirmedEpoch = null;
  authority = null;
  listeners.forEach((listener) => listener());
}
export async function suspendOwnedSessionAuthority(
  snapshot: SessionSnapshot,
  epoch = authorityEpoch,
) {
  if (
    epoch === authorityEpoch &&
    (await isSessionCurrent(snapshot)) &&
    epoch === authorityEpoch
  )
    suspendSessionAuthority();
}
export async function confirmSessionAuthority(
  request: () => Promise<{ data: unknown }>,
) {
  const epoch = authorityEpoch;
  const origin = await getSessionSnapshot();
  if (!origin.accessToken) return false;
  const response = await request();
  const current = await getSessionSnapshot();
  // Rotation may change revision, but an A response must never authorize B.
  if (
    current.incarnation !== origin.incarnation ||
    current.sessionId !== origin.sessionId ||
    !(await recordSessionAuthority(response.data, current, epoch, true))
  )
    throw new SessionRequestError("stale");
  return true;
}
