import { Platform } from 'react-native';
import { installWebEnvironment, loginSession } from '../helpers/session-fixtures';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('expo-modules-core', () => ({ ...jest.requireActual('expo-modules-core'), uuid: { v4: () => require('crypto').randomUUID() } }));

function context() {
  let storage!: typeof import('../../storage/authStorage');
  jest.isolateModules(() => { storage = require('../../storage/authStorage'); });
  return storage;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('shared session identity', () => {
  const values = new Map<string, string>();
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    installWebEnvironment(values);
    values.clear();
  });

  it('does not let logout from an old context erase a new login', async () => {
    const a = context();
    const b = context();
    await a.installSession(loginSession('A'), await a.reconcileSession());
    await a.getSessionSnapshot();
    await b.installSession(loginSession('B'), await b.reconcileSession());
    const result = await a.beginLocalLogout().completion;
    expect(result.accessToken).not.toBe(loginSession('B').access_token);
    expect(await b.getToken()).toBe(loginSession('B').access_token);
  });

  it('rotates once across three contexts and adopts N+1 for a late N rejection', async () => {
    const a = context(), b = context(), c = context();
    await a.installSession(loginSession(), await a.reconcileSession());
    const [sa, sb, sc] = await Promise.all([a.getSessionSnapshot(), b.getSessionSnapshot(), c.getSessionSnapshot()]);
    const entered = deferred<void>(), release = deferred<void>();
    const send = jest.fn(async () => { entered.resolve(); await release.promise; return loginSession('A', 'session-A', '1'); });
    const first = a.rotateSession(sa, send);
    await entered.promise;
    const others = [b.rotateSession(sb, send), c.rotateSession(sc, send)];
    release.resolve();
    await Promise.all([first, ...others]);
    await b.rotateSession(sb, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await c.getToken()).toBe(loginSession('A', 'session-A', '1').access_token);
  });

  it('fences old 200/401 and stale profile metadata after same-account new login', async () => {
    const a = context(), b = context();
    await a.installSession(loginSession(), await a.reconcileSession());
    const old = await a.getSessionSnapshot();
    await b.installSession(loginSession('A', 'new-session'), await b.reconcileSession());
    expect(await a.isSessionCurrent(old)).toBe(false);
    await expect(a.saveUser({ ...loginSession().usuario, nome: 'old profile' }, old)).rejects.toMatchObject({ sessionFailure: 'stale' });
    await a.clearSessionIfCurrent(old);
    expect(await b.getUser()).toEqual(loginSession().usuario);
    expect((await b.getSessionSnapshot()).incarnation).not.toBe(old.incarnation);
  });

  it('rejects an old login result without rollback over B', async () => {
    const a = context(), b = context();
    const origin = await a.reconcileSession();
    await b.installSession(loginSession('B'), await b.reconcileSession());
    expect(await a.installSession(loginSession('A'), origin)).toBe(false);
    expect(await b.getToken()).toBe(loginSession('B').access_token);
  });
  it('rejects a legacy epoch-only installation that never captured durable ownership', async () => {
    const a = context(), b = context(), origin = a.getSessionGeneration();
    await b.installSession(loginSession('B'), await b.reconcileSession());
    expect(await a.installSession(loginSession('A'), origin)).toBe(false);
    expect(await b.getToken()).toBe(loginSession('B').access_token);
  });

  it.each(['before-send', 'after-commit'])('never resends an orphan durable attempt (%s)', async () => {
    const a = context();
    await a.installSession(loginSession(), await a.reconcileSession());
    const record = JSON.parse(values.get(a.SESSION_KEY)!);
    values.set(a.SESSION_KEY, JSON.stringify({ ...record, status: 'refreshInFlight', attempt: require('crypto').randomUUID(), revision: 1 }));
    const reloaded = context();
    expect((await reloaded.reconcileSession()).refreshToken).toBeNull();
    expect(JSON.parse(values.get(a.SESSION_KEY)!).status).toBe('refreshOutcomeUnknown');
    const send = jest.fn();
    await expect(reloaded.rotateSession(await reloaded.getSessionSnapshot(), send)).rejects.toMatchObject({ sessionFailure: 'stale' });
    expect(send).not.toHaveBeenCalled();
  });

  it('asks for login on possible-send failure, including bare 503', async () => {
    const a = context();
    await a.installSession(loginSession(), await a.reconcileSession());
    const send = jest.fn(async () => { throw { response: { status: 503 } }; });
    await expect(a.rotateSession(await a.getSessionSnapshot(), send)).rejects.toMatchObject({ sessionFailure: 'unknown' });
    expect(await a.getToken()).toBeNull();
    expect(JSON.parse(values.get(a.SESSION_KEY)!).status).toBe('refreshOutcomeUnknown');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not send when durable attempt persistence fails', async () => {
    const a = context();
    await a.installSession(loginSession(), await a.reconcileSession());
    const origin = await a.getSessionSnapshot();
    const write = localStorage.setItem;
    localStorage.setItem = () => { throw new Error('Storage denied'); };
    const send = jest.fn();
    await expect(a.rotateSession(origin, send)).rejects.toMatchObject({ sessionFailure: 'unavailable' });
    localStorage.setItem = write;
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps logout UI immediate while shared durability waits for bounded refresh', async () => {
    const a = context();
    await a.installSession(loginSession(), await a.reconcileSession());
    const origin = await a.getSessionSnapshot(), entered = deferred<void>(), release = deferred<void>();
    const rotating = a.rotateSession(origin, async () => { entered.resolve(); await release.promise; return loginSession('A', 'session-A', '1'); }).catch(error => error);
    await entered.promise;
    const logout = a.beginLocalLogout();
    expect(a.isLocallySignedOut()).toBe(true);
    expect(await a.getToken()).toBeNull();
    expect(JSON.parse(values.get(a.SESSION_KEY)!).status).toBe('refreshInFlight');
    release.resolve();
    expect(await rotating).toMatchObject({ sessionFailure: 'stale' });
    expect(await logout.completion).toMatchObject({ localDurable: true });
    expect(JSON.parse(values.get(a.SESSION_KEY)!).status).toBe('signedOut');
  });

  it('requires explicit reconciliation to adopt a legitimate login after local logout', async () => {
    const a = context(), b = context();
    await a.installSession(loginSession(), await a.reconcileSession());
    await a.clearSession();
    values.set('access_token', 'surviving legacy secret');
    const reloaded = context();
    expect(await reloaded.getToken()).toBeNull();
    await b.installSession(loginSession('B'), await b.reconcileSession());
    expect(await a.getToken()).toBeNull();
    await a.reconcileSession();
    expect(await a.getToken()).toBe(loginSession('B').access_token);
  });

  it.each(['absent', 'denied'])('fails closed without a safe Web Lock (%s)', async mode => {
    const a = context();
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: mode === 'absent' ? {} : { locks: { request: () => Promise.reject(new Error('Denied')) } } });
    await expect(a.reconcileSession()).rejects.toMatchObject({ sessionFailure: mode === 'absent' ? 'compatibility' : 'unavailable' });
    expect(await a.getToken()).toBeNull();
    expect(values.size).toBe(0);
  });

  it('forces one-time login for legacy partial or signed-out credentials', async () => {
    values.set('auth_signed_out', '1'); values.set('access_token', loginSession().access_token);
    const a = context();
    expect(await a.getToken()).toBeNull();
    expect(values.has('access_token')).toBe(false);
    expect(JSON.parse(values.get(a.SESSION_KEY)!).status).toBe('signedOut');
  });

  it('rejects incoherent sid/user payload and deprecated partial writers', async () => {
    const a = context();
    const origin = await a.reconcileSession();
    await expect(a.installSession({ ...loginSession(), refresh_token: loginSession('B').refresh_token }, origin)).rejects.toThrow();
    await expect(a.saveToken(loginSession().access_token)).rejects.toThrow('installSession');
    await expect(a.saveRefreshToken(loginSession().refresh_token)).rejects.toThrow('installSession');
    expect(await a.getToken()).toBeNull();
  });
  it('bounds lock waiting without acquiring an unsafe lease', async () => {
    jest.useFakeTimers();
    try {
      const held = deferred<void>();
      const holder = navigator.locks.request('auth_session_v3', { signal: new AbortController().signal }, () => held.promise);
      const a = context();
      const waiting = a.reconcileSession().catch(error => error);
      await jest.advanceTimersByTimeAsync(7000);
      expect(await waiting).toMatchObject({ sessionFailure: 'unavailable' });
      expect(values.size).toBe(0);
      held.resolve(); await holder;
    } finally { jest.useRealTimers(); }
  });
  it('never retries an old token after the bounded refresh deadline', async () => {
    const a = context();
    await a.installSession(loginSession(), await a.reconcileSession());
    const origin = await a.getSessionSnapshot(), entered = deferred<void>();
    jest.useFakeTimers();
    try {
      const send = jest.fn(async () => { entered.resolve(); return new Promise<never>(() => { }); });
      const pending = a.rotateSession(origin, send).catch(error => error);
      await entered.promise;
      await jest.advanceTimersByTimeAsync(5000);
      expect(await pending).toMatchObject({ sessionFailure: 'unknown' });
      const reloaded = context();
      expect((await reloaded.reconcileSession()).refreshToken).toBeNull();
      expect(send).toHaveBeenCalledTimes(1);
    } finally { jest.useRealTimers(); }
  });
  it('reconciles persisted B on pageshow/visibility even when channel hints were missed', async () => {
    const listeners = new Map<string, () => void>();
    Object.defineProperty(globalThis, 'addEventListener', { configurable: true, value: (name: string, handler: () => void) => listeners.set(name, handler) });
    Object.defineProperty(globalThis, 'removeEventListener', { configurable: true, value: (name: string) => listeners.delete(name) });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { visibilityState: 'visible', addEventListener: (name: string, handler: () => void) => listeners.set(name, handler), removeEventListener: (name: string) => listeners.delete(name) } });
    const a = context(), b = context();
    await a.installSession(loginSession(), await a.reconcileSession()); await a.clearSession();
    const stop = a.observeSessionLifecycle();
    await a.reconcileSession();
    await b.installSession(loginSession('B'), await b.reconcileSession());
    expect(await a.getToken()).toBeNull();
    listeners.get('pageshow')!();
    await a.reconcileSession();
    expect(await a.getToken()).toBe(loginSession('B').access_token);
    listeners.get('visibilitychange')!(); await a.reconcileSession();
    stop(); expect(listeners.size).toBe(0);
  });
});
