import * as SecureStore from 'expo-secure-store';
import { uuid } from 'expo-modules-core';
import { AppState, Platform } from 'react-native';
import { UsuarioLogado } from '../types/auth';
import { SessionRequestError } from '../utils/session-error';

export const SESSION_KEY = 'auth_session_v3';
const LEGACY_KEYS = ['access_token', 'refresh_token', 'usuario_logado', 'auth_signed_out'];
const LOCK_NAME = 'auth_session_v3';
const LOCK_WAIT_MS = 7000;
export const REFRESH_TIMEOUT_MS = 5000;
const MAX_ENVELOPE_BYTES = 16384;
// Application bound, not a guarantee of capacity on every SecureStore platform.
const MAX_NATIVE_BYTES = 2048;
type Tokens = { access_token: string; refresh_token: string };
type LoginSession = Tokens & { usuario: UsuarioLogado };
type Envelope = {
  schemaVersion: 3;
  incarnation: string;
  revision: number;
  sessionId: string | null;
  status: 'valid' | 'refreshInFlight' | 'refreshOutcomeUnknown' | 'signedOut';
  credentials: Tokens | null;
  user: UsuarioLogado | null;
  attempt: string | null;
};
export type SessionSnapshot = {
  generation: number;
  incarnation: string | null;
  revision: number;
  sessionId: string | null;
  refreshToken: string | null;
  accessToken: string | null;
  status?: Envelope['status'];
};
let sessionGeneration = 0;
let observed: Envelope | null = null;
let locallySignedOut = false;
let storageUnavailable = false;
let localLogout: LocalLogoutOperation | undefined;
let mutationQueue: Promise<unknown> = Promise.resolve();
const authStateListeners = new Set<() => void>();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation);
  mutationQueue = result.catch(() => undefined);
  return result;
}
async function coordinated<T>(operation: () => Promise<T>): Promise<T> {
  return serialize(async () => {
    if (Platform.OS !== 'web') return operation();
    if (typeof window === 'undefined' || !window.isSecureContext || !navigator.locks?.request)
      throw new SessionRequestError('compatibility');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOCK_WAIT_MS);
    try {
      return await navigator.locks.request(LOCK_NAME, { mode: 'exclusive', signal: controller.signal }, async () => {
        clearTimeout(timer);
        return operation();
      });
    } catch (error) {
      if (error instanceof SessionRequestError) throw error;
      throw new SessionRequestError('unavailable');
    } finally { clearTimeout(timer); }
  });
}
async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') localStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}
async function getItem(key: string) {
  return Platform.OS === 'web' ? localStorage.getItem(key) : SecureStore.getItemAsync(key);
}
async function removeItem(key: string) {
  if (Platform.OS === 'web') localStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}
function notifyAuthStateListeners() { authStateListeners.forEach(listener => listener()); }
function isUsuarioLogado(value: unknown): value is UsuarioLogado {
  if (!value || typeof value !== 'object') return false;
  const user = value as UsuarioLogado;
  return [user.id, user.nome, user.email].every(field => typeof field === 'string' && field.length > 0 && field.length <= 512);
}
function tokenIdentity(token: string): { sid: string; sub: string } {
  // Untrusted claims are a client fence only; the server still authenticates every protected request.
  if (typeof token !== 'string' || token.length > 8192) throw new Error('Invalid session credentials.');
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Invalid session credentials.');
  const value = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  if (typeof value.sid !== 'string' || !value.sid || value.sid.length > 128 ||
    typeof value.sub !== 'string' || !value.sub || value.sub.length > 128)
    throw new Error('Invalid session credentials.');
  return value;
}
function validateCredentials(tokens: Tokens, user: UsuarioLogado, expectedSid?: string) {
  const access = tokenIdentity(tokens.access_token), refresh = tokenIdentity(tokens.refresh_token);
  if (access.sid !== refresh.sid || access.sub !== refresh.sub || access.sub !== user.id ||
    (expectedSid !== undefined && access.sid !== expectedSid)) throw new Error('Incoherent session credentials.');
  return access.sid;
}
function byteLength(value: string) { return unescape(encodeURIComponent(value)).length; }
function validateEnvelope(value: unknown): Envelope {
  if (!value || typeof value !== 'object') throw new Error('Invalid session record.');
  const record = value as Envelope;
  if (record.schemaVersion !== 3 || typeof record.incarnation !== 'string' || record.incarnation.length !== 36 ||
    !Number.isSafeInteger(record.revision) || record.revision < 0 ||
    !(record.sessionId === null || (typeof record.sessionId === 'string' && record.sessionId.length > 0 && record.sessionId.length <= 128)) ||
    !['valid', 'refreshInFlight', 'refreshOutcomeUnknown', 'signedOut'].includes(record.status))
    throw new Error('Invalid session record.');
  if (record.status === 'valid' || record.status === 'refreshInFlight') {
    if (!isUsuarioLogado(record.user) || !record.credentials || typeof record.sessionId !== 'string' ||
      validateCredentials(record.credentials, record.user, record.sessionId) !== record.sessionId)
      throw new Error('Invalid session record.');
    if (record.status === 'refreshInFlight' ? typeof record.attempt !== 'string' || record.attempt.length !== 36 : record.attempt !== null)
      throw new Error('Invalid session attempt.');
  } else if (record.credentials !== null || record.user !== null || record.attempt !== null)
    throw new Error('Invalid signed-out record.');
  return record;
}
function signedOut(previous?: Envelope | null, unknown = false): Envelope {
  return {
    schemaVersion: 3, incarnation: previous?.incarnation ?? uuid.v4(), revision: (previous?.revision ?? -1) + 1,
    sessionId: previous?.sessionId ?? null, status: unknown ? 'refreshOutcomeUnknown' : 'signedOut', credentials: null, user: null, attempt: null
  };
}
async function persist(record: Envelope) {
  validateEnvelope(record);
  const serialized = JSON.stringify(record);
  if (byteLength(serialized) > (Platform.OS === 'web' ? MAX_ENVELOPE_BYTES : MAX_NATIVE_BYTES)) throw new SessionRequestError('unavailable');
  await setItem(SESSION_KEY, serialized);
  if (await getItem(SESSION_KEY) !== serialized) throw new SessionRequestError('unavailable');
}
async function removeSessionItems(): Promise<boolean> {
  let complete = true;
  for (const key of LEGACY_KEYS) { try { await removeItem(key); } catch { complete = false; } }
  return complete;
}
async function readEnvelope(initialize = true): Promise<Envelope> {
  try {
    const raw = await getItem(SESSION_KEY);
    if (raw !== null) {
      try {
        if (byteLength(raw) > (Platform.OS === 'web' ? MAX_ENVELOPE_BYTES : MAX_NATIVE_BYTES)) throw new Error('Invalid session size.');
        return validateEnvelope(JSON.parse(raw));
      }
      catch {
        if (!initialize) throw new Error('Invalid session record.');
        const record = signedOut();
        await persist(record);
        if (!await removeSessionItems()) throw new Error('Legacy cleanup unavailable.');
        return record;
      }
    }
    // Legacy pairs cannot prove coherence or ownership; require one-time login rather than revive them.
    if (!initialize) throw new Error('Session record missing.');
    const record = signedOut();
    await persist(record);
    if (!await removeSessionItems()) throw new Error('Legacy session cleanup unavailable.');
    return record;
  } catch {
    storageUnavailable = true;
    if (!locallySignedOut) { locallySignedOut = true; sessionGeneration++; notifyAuthStateListeners(); }
    throw new SessionRequestError('unavailable');
  }
}
function adopt(record: Envelope) {
  if (observed?.status === 'refreshOutcomeUnknown' && sameIdentity(record, snapshot())) return;
  const changed = observed !== null && (record.incarnation !== observed.incarnation || (record.status === 'valid') !== (observed.status === 'valid'));
  const newIncarnation = record.incarnation !== observed?.incarnation;
  observed = record;
  if (newIncarnation) locallySignedOut = record.status !== 'valid';
  else if (record.status !== 'valid') locallySignedOut = true;
  storageUnavailable = false;
  if (changed) { sessionGeneration++; notifyAuthStateListeners(); }
}
function snapshot(record = observed): SessionSnapshot {
  const valid = record?.status === 'valid' && !locallySignedOut && !storageUnavailable;
  return {
    generation: sessionGeneration, incarnation: record?.incarnation ?? null, revision: record?.revision ?? 0,
    sessionId: record?.sessionId ?? null, refreshToken: valid ? record!.credentials!.refresh_token : null,
    accessToken: valid ? record!.credentials!.access_token : null, status: record?.status
  };
}
function sameIdentity(record: Envelope, expected: SessionSnapshot) { return record.incarnation === expected.incarnation && record.sessionId === expected.sessionId; }
function broadcast(record: Envelope) {
  notifyAuthStateListeners();
  try { channel?.postMessage({ incarnation: record.incarnation, revision: record.revision }); } catch { /* Hints are optional. */ }
}
function quarantineUnknown(record: Envelope, expected?: SessionSnapshot): Envelope | null {
  if (expected && (!sameIdentity(record, expected) || (observed && !sameIdentity(observed, expected)))) return null;
  if (observed?.status !== 'refreshOutcomeUnknown' || !sameIdentity(record, snapshot())) {
    observed = signedOut(record, true);
    locallySignedOut = true;
    storageUnavailable = false;
    sessionGeneration++;
    notifyAuthStateListeners();
  }
  return observed;
}
async function reconcileInside() {
  let record = await readEnvelope();
  if (observed?.status === 'refreshOutcomeUnknown' && sameIdentity(record, snapshot())) return observed;
  if (record.status === 'refreshInFlight') {
    record = quarantineUnknown(record)!;
    try { await persist(record); broadcast(record); } catch { /* The durable attempt still forbids old-token replay. */ }
  }
  adopt(record);
  return record;
}
export function getSessionGeneration() { return sessionGeneration; }
export async function reconcileSession(): Promise<SessionSnapshot> {
  try { return await coordinated(async () => { await reconcileInside(); return snapshot(); }); }
  catch (error) { if (!locallySignedOut) { locallySignedOut = true; sessionGeneration++; notifyAuthStateListeners(); } throw error; }
}
export async function getSessionSnapshot(): Promise<SessionSnapshot> {
  if (locallySignedOut) return snapshot();
  return reconcileSession();
}
export async function isSessionCurrent(expected: SessionSnapshot): Promise<boolean> {
  if (expected.generation !== sessionGeneration || locallySignedOut || storageUnavailable) return false;
  const record = await readEnvelope(false);
  if (!sameIdentity(record, expected) || !['valid', 'refreshInFlight'].includes(record.status)) { adopt(record); return false; }
  return expected.generation === sessionGeneration;
}
export async function getToken() { try { return (await getSessionSnapshot()).accessToken; } catch { return null; } }
export async function getRefreshToken() { try { return (await getSessionSnapshot()).refreshToken; } catch { return null; } }
export async function getUser() { try { await getSessionSnapshot(); return !locallySignedOut && observed?.status === 'valid' ? observed.user : null; } catch { return null; } }
export function isLocallySignedOut() { return locallySignedOut || storageUnavailable; }
export async function isLocalLogoutCurrent(generation: number): Promise<boolean> {
  if (generation !== sessionGeneration || !observed) return false;
  try {
    const current = await readEnvelope(false);
    return generation === sessionGeneration && current.incarnation === observed.incarnation && current.sessionId === observed.sessionId;
  } catch { return false; } // Unknown ownership must not attach A's warning to B.
}
export function subscribeAuthState(listener: () => void) { authStateListeners.add(listener); return () => { authStateListeners.delete(listener); }; }

export async function installSession(session: LoginSession, expected: number | SessionSnapshot): Promise<boolean> {
  if (typeof expected === 'number' || expected.incarnation === null) return false;
  if (!isUsuarioLogado(session.usuario)) throw new Error('Invalid login session.');
  const sid = validateCredentials(session, session.usuario);
  const origin = expected;
  return coordinated(async () => {
    const current = await readEnvelope();
    if (origin.generation !== sessionGeneration || !sameIdentity(current, origin)) return false;
    const record: Envelope = {
      schemaVersion: 3, incarnation: uuid.v4(), revision: 0, sessionId: sid, status: 'valid',
      credentials: { access_token: session.access_token, refresh_token: session.refresh_token }, user: session.usuario, attempt: null
    };
    await persist(record);
    if (origin.generation !== sessionGeneration) { await persist(signedOut(record)); return false; }
    sessionGeneration++; locallySignedOut = false; observed = record; storageUnavailable = false;
    if (!await removeSessionItems()) { storageUnavailable = true; locallySignedOut = true; notifyAuthStateListeners(); throw new SessionRequestError('unavailable'); }
    broadcast(record); return true;
  });
}
export async function saveUser(user: UsuarioLogado, expected?: SessionSnapshot): Promise<void> {
  if (!isUsuarioLogado(user)) throw new Error('Dados de usuario invalidos para salvar na sessao.');
  if (!expected) throw new Error('Session snapshot required for profile persistence.');
  return coordinated(async () => {
    const record = await readEnvelope();
    if (expected.generation !== sessionGeneration || !sameIdentity(record, expected) || record.status !== 'valid' || record.user?.id !== user.id || locallySignedOut)
      throw new SessionRequestError('stale');
    const updated = { ...record, revision: record.revision + 1, user };
    await persist(updated); adopt(updated); broadcast(updated);
  });
}
// Partial writers cannot create or reopen a coherent session.
export async function saveToken(_token: string): Promise<void> { throw new Error('Use installSession for complete credentials.'); }
export async function saveRefreshToken(_token: string): Promise<void> { throw new Error('Use installSession for complete credentials.'); }
export async function removeToken() { await clearSession(); }
export async function removeRefreshToken() { await clearSession(); }
export async function removeUser() { await clearSession(); }
export async function clearSession(expected?: SessionSnapshot) {
  const result = await beginLocalLogout(false, expected).completion;
  if (!result.localDurable || !result.cleanupComplete) throw new SessionRequestError('unavailable');
}
export async function clearSessionIfCurrent(expected: SessionSnapshot) {
  return coordinated(async () => {
    const record = await readEnvelope();
    if (expected.generation !== sessionGeneration || !sameIdentity(record, expected) || record.revision !== expected.revision) return;
    const next = signedOut(record);
    await persist(next); adopt(next); locallySignedOut = true; broadcast(next); await removeSessionItems();
  });
}
// Retained export cannot bypass a durable owned refresh attempt.
export async function applyRefreshIfCurrent(_snapshot: SessionSnapshot, _tokens: Tokens): Promise<boolean> { return false; }
export async function rotateSession(expected: SessionSnapshot, send: (refreshToken: string, signal: AbortSignal) => Promise<Tokens>): Promise<Tokens | null> {
  return coordinated(async () => {
    let record = await readEnvelope();
    if (expected.generation !== sessionGeneration || !sameIdentity(record, expected) || locallySignedOut) throw new SessionRequestError('stale');
    if (record.status === 'refreshInFlight' || record.status === 'refreshOutcomeUnknown') {
      const next = quarantineUnknown(record, expected);
      if (!next) throw new SessionRequestError('stale');
      let durable = false;
      try { await persist(next); durable = true; broadcast(next); } catch { /* Keep the local quarantine and durable attempt. */ }
      throw new SessionRequestError('unknown', durable ? 'confirmed' : 'unconfirmed');
    }
    if (record.status !== 'valid' || !record.credentials || !record.user) return null;
    if (record.revision > expected.revision && record.credentials.refresh_token !== expected.refreshToken) return record.credentials;
    if (record.credentials.refresh_token !== expected.refreshToken) throw new SessionRequestError('stale');
    const inflight: Envelope = { ...record, status: 'refreshInFlight', attempt: uuid.v4(), revision: record.revision + 1 };
    await persist(inflight); // If this fails, no HTTP is sent.
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Refresh outcome unavailable.')); }, REFRESH_TIMEOUT_MS); });
      const tokens = await Promise.race([send(record.credentials.refresh_token, controller.signal), deadline]);
      validateCredentials(tokens, record.user, record.sessionId!);
      const latest = await readEnvelope();
      if (!sameIdentity(latest, expected) || latest.attempt !== inflight.attempt) throw new SessionRequestError('stale');
      if (expected.generation !== sessionGeneration || locallySignedOut) {
        const next = signedOut(latest); await persist(next); observed = next; broadcast(next); throw new SessionRequestError('stale');
      }
      const next: Envelope = { ...latest, status: 'valid', revision: latest.revision + 1, credentials: tokens, attempt: null };
      await persist(next); adopt(next); broadcast(next); return tokens;
    } catch (error) {
      if (error instanceof SessionRequestError && error.sessionFailure === 'stale') throw error;
      const next = quarantineUnknown(inflight, expected);
      if (!next) throw new SessionRequestError('stale');
      let durable = false;
      try {
        const latest = await readEnvelope(false);
        if (!sameIdentity(latest, expected)) throw new SessionRequestError('stale');
        if (latest.attempt === inflight.attempt) { await persist(next); durable = true; broadcast(next); }
      } catch (failure) {
        if (failure instanceof SessionRequestError && failure.sessionFailure === 'stale') throw failure;
      }
      throw new SessionRequestError('unknown', durable ? 'confirmed' : 'unconfirmed');
    } finally { if (timer) clearTimeout(timer); }
  });
}
export type LocalLogoutResult = { localDurable: boolean; cleanupComplete: boolean; accessToken: string | null };
export type LocalLogoutOperation = { generation: number; completion: Promise<LocalLogoutResult> };
export function beginLocalLogout(captureRemoteCredential = true, expected?: SessionSnapshot): LocalLogoutOperation {
  if (expected && expected.generation !== sessionGeneration)
    return { generation: expected.generation, completion: Promise.resolve({ localDurable: true, cleanupComplete: true, accessToken: null }) };
  if (localLogout?.generation === sessionGeneration) return localLogout;
  const owner = expected ?? snapshot();
  let accessToken = captureRemoteCredential ? owner.accessToken : null;
  const generation = ++sessionGeneration;
  locallySignedOut = true; notifyAuthStateListeners();
  const completion = coordinated(async () => {
    let localDurable = false, cleanupComplete = false;
    try {
      const current = await readEnvelope();
      if (owner.incarnation !== null && !sameIdentity(current, owner)) {
        accessToken = null; sessionGeneration++; // Suppress old-account warnings without adopting B here.
        return { localDurable: true, cleanupComplete: true, accessToken };
      }
      const next = signedOut(current);
      await persist(next); localDurable = true; observed = next; broadcast(next); cleanupComplete = await removeSessionItems();
    } catch { storageUnavailable = true; }
    return { localDurable, cleanupComplete, accessToken };
  }).catch(() => ({ localDurable: false, cleanupComplete: false, accessToken: null }));
  localLogout = { generation, completion }; return localLogout;
}
let channel: BroadcastChannel | undefined;
export function observeSessionLifecycle() {
  const reconcile = () => { void reconcileSession().catch(() => notifyAuthStateListeners()); };
  if (Platform.OS !== 'web') {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') reconcile(); });
    return () => subscription.remove();
  }
  if (typeof window === 'undefined') return () => { };
  const onStorage = (event: StorageEvent) => { if (event.key === SESSION_KEY) reconcile(); };
  const onVisibility = () => { if (document.visibilityState === 'visible') reconcile(); };
  const onPageHide = () => { channel?.close(); channel = undefined; };
  const onPageShow = () => {
    try { if (!channel && typeof BroadcastChannel !== 'undefined') { channel = new BroadcastChannel(LOCK_NAME); channel.onmessage = reconcile; } } catch { channel = undefined; }
    reconcile();
  };
  window.addEventListener('storage', onStorage); window.addEventListener('pageshow', onPageShow); window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onVisibility); onPageShow();
  return () => {
    onPageHide(); window.removeEventListener('storage', onStorage); window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('pagehide', onPageHide); document.removeEventListener('visibilitychange', onVisibility);
  };
}
