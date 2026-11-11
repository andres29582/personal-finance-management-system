import { Platform, AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { installWebEnvironment, loginSession } from '../helpers/session-fixtures';
import * as storage from '../../storage/authStorage';
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
const values = new Map<string, string>();
beforeEach(async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  values.clear(); installWebEnvironment(values);
  await storage.reconcileSession();
});
it('publishes complete validated credentials and user in one envelope', async () => {
  const session = loginSession();
  await storage.installSession(session, await storage.reconcileSession());
  expect(await storage.getToken()).toBe(session.access_token);
  expect(await storage.getRefreshToken()).toBe(session.refresh_token);
  expect(await storage.getUser()).toEqual(session.usuario);
  expect(values.has('access_token')).toBe(false);
  const record = JSON.parse(values.get(storage.SESSION_KEY)!);
  expect(record).toMatchObject({ schemaVersion: 3, revision: 0, sessionId: 'session-A', status: 'valid' });
});
it.each(['id', 'nome', 'email'])('rejects invalid user field %s', async field => {
  await expect(storage.installSession({ ...loginSession(), usuario: { ...loginSession().usuario, [field]: undefined } } as never, await storage.reconcileSession())).rejects.toThrow();
  expect(await storage.getToken()).toBeNull();
});
it.each([null, 'undefined', '{', JSON.stringify({ schemaVersion: 999 })])('never authenticates corrupt/unsupported record %s', async raw => {
  if (raw === null) values.delete(storage.SESSION_KEY); else values.set(storage.SESSION_KEY, raw);
  await storage.reconcileSession();
  expect(await storage.getUser()).toBeNull();
  expect(await storage.getToken()).toBeNull();
});
it.each(['removeToken', 'removeRefreshToken', 'removeUser', 'clearSession'] as const)('legacy removal %s clears coherent session, never partial credentials', async method => {
  await storage.installSession(loginSession(), await storage.reconcileSession());
  await storage[method]();
  expect(await storage.getToken()).toBeNull(); expect(await storage.getRefreshToken()).toBeNull(); expect(await storage.getUser()).toBeNull();
  expect(JSON.parse(values.get(storage.SESSION_KEY)!).status).toBe('signedOut');
});
it('notifies auth state locally on login and immediate logout', async () => {
  const listener = jest.fn(), stop = storage.subscribeAuthState(listener);
  await storage.installSession(loginSession(), await storage.reconcileSession());
  expect(listener).toHaveBeenCalled(); listener.mockClear();
  const operation = storage.beginLocalLogout();
  expect(listener).toHaveBeenCalled(); expect(storage.isLocallySignedOut()).toBe(true);
  await operation.completion; stop();
});
it('allows only owner-fenced profile writes and validates payload', async () => {
  await storage.installSession(loginSession(), await storage.reconcileSession());
  const origin = await storage.getSessionSnapshot();
  await storage.saveUser({ ...loginSession().usuario, nome: 'Updated' }, origin);
  expect((await storage.getUser())?.nome).toBe('Updated');
  await expect(storage.saveUser(loginSession().usuario)).rejects.toThrow('snapshot');
  await expect(storage.saveUser({ ...loginSession().usuario, email: 7 } as never, origin)).rejects.toThrow();
});
it('native uses one SecureStore capsule and rejects application oversize before publishing', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  values.clear();
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => values.get(key) ?? null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { values.set(key, value); });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => { values.delete(key); });
  const origin = await storage.reconcileSession();
  await storage.installSession(loginSession(), origin);
  expect(await storage.getToken()).toBe(loginSession().access_token);
  await expect(storage.installSession({ ...loginSession('B'), usuario: { ...loginSession('B').usuario, extra: 'x'.repeat(3000) } } as never, await storage.reconcileSession())).rejects.toMatchObject({ sessionFailure: 'unavailable' });
  expect(await storage.getToken()).toBe(loginSession().access_token);
});
it('keeps the previous complete session when its replacement write is denied', async () => {
  await storage.installSession(loginSession(), await storage.reconcileSession());
  const write = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Denied'); };
  await expect(storage.installSession(loginSession('B'), await storage.getSessionSnapshot())).rejects.toThrow();
  localStorage.setItem = write;
  expect(await storage.getToken()).toBe(loginSession().access_token);
  expect(await storage.getUser()).toEqual(loginSession().usuario);
});
it('reconciles durable identity on native AppState activation and releases subscription', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  values.clear();
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => values.get(key) ?? null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { values.set(key, value); });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => { values.delete(key); });
  await storage.installSession(loginSession(), await storage.reconcileSession());
  const old = await storage.getSessionSnapshot(), remove = jest.fn();
  let activate!: (state: AppStateStatus) => void;
  const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { activate = listener; return { remove }; });
  try {
    const stop = storage.observeSessionLifecycle();
    let other!: typeof storage;
    jest.isolateModules(() => { other = require('../../storage/authStorage'); });
    await other.installSession(loginSession('B'), await other.reconcileSession());
    activate('active'); await storage.reconcileSession();
    expect(await storage.isSessionCurrent(old)).toBe(false);
    expect(await storage.getToken()).toBe(loginSession('B').access_token);
    stop(); expect(remove).toHaveBeenCalledTimes(1);
  } finally { spy.mockRestore(); }
});
