import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios, { AxiosAdapter } from 'axios';
import * as storage from '../../storage/authStorage';
import { logout } from '../../src/modules/auth/services/logoutCoordinator';
import { loginSession, installWebEnvironment } from '../helpers/session-fixtures';
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
const values = new Map<string, string>();
let remote: AxiosAdapter;
const dispatch: AxiosAdapter = config => remote(config);
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(async () => {
  jest.useRealTimers(); jest.clearAllMocks(); values.clear();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => values.get(key) ?? null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { values.set(key, value); });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => { values.delete(key); });
  await storage.installSession(loginSession(), await storage.reconcileSession());
  axios.defaults.adapter = dispatch;
});
it('invalidates synchronously and bounds hung old-JWT remote logout', async () => {
  jest.useFakeTimers(); const entered = deferred(), headers: unknown[] = [];
  remote = async config => { headers.push(config.headers.get('Authorization')); entered.resolve(); return new Promise(() => { }); };
  const before = storage.getSessionGeneration(), notice = jest.fn(), operation = logout(notice);
  expect(storage.getSessionGeneration()).toBeGreaterThan(before); expect(storage.isLocallySignedOut()).toBe(true);
  expect(await storage.getToken()).toBeNull(); await entered.promise;
  await jest.advanceTimersByTimeAsync(5000);
  expect(await operation.completion).toMatchObject({ localDurable: true, remote: 'unconfirmed' });
  expect(headers).toEqual([`Bearer ${loginSession().access_token}`]); expect(notice).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});
it.each([undefined, 401, 429, 503])('never refreshes, retries, or confirms remote failure %s', async status => {
  const calls: string[] = [];
  remote = async config => { calls.push(config.url!); throw { isAxiosError: true, config, response: status ? { status } : undefined }; };
  expect(await logout(() => { }).completion).toMatchObject({ localDurable: true, remote: 'unconfirmed' });
  expect(calls).toEqual(['/auth/logout']); expect(await storage.getToken()).toBeNull();
});
it.each([{ success: false, message: 'not revoked' }, { success: true, data: {} }, {}])('does not confirm malformed successful HTTP %j', async data => {
  remote = async config => ({ config, headers: {}, status: 200, statusText: 'OK', data });
  expect((await logout(() => { }).completion).remote).toBe('unconfirmed');
});
it('confirms only the successful server message contract', async () => {
  remote = async config => ({ config, headers: {}, status: 200, statusText: 'OK', data: { success: true, data: { message: 'Logout realizado com sucesso.' } } });
  expect((await logout().completion).remote).toBe('confirmed');
});
it('coalesces and suppresses completion warning after B without B credentials', async () => {
  const entered = deferred(), release = deferred(), notice = jest.fn(); let calls = 0;
  remote = async config => { calls++; expect(config.headers.get('Authorization')).toBe(`Bearer ${loginSession().access_token}`); entered.resolve(); await release.promise; throw new Error('Offline'); };
  const first = logout(notice); expect(logout(notice)).toBe(first);
  await entered.promise; await storage.installSession(loginSession('B'), await storage.reconcileSession());
  release.resolve(); await first.completion;
  expect(await storage.getToken()).toBe(loginSession('B').access_token); expect(notice).not.toHaveBeenCalled(); expect(calls).toBe(1);
});
it('preserves signed-out envelope after failed later login, no A resurrection', async () => {
  remote = async () => { throw new Error('Offline'); };
  await logout(() => { }).completion;
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('Write denied'));
  await expect(storage.installSession(loginSession('B'), await storage.reconcileSession())).rejects.toThrow();
  expect(await storage.getToken()).toBeNull(); expect(JSON.parse(values.get(storage.SESSION_KEY)!).status).toBe('signedOut');
});
it.each(['access_token', 'refresh_token', 'usuario_logado', 'auth_signed_out'])('retains signed-out fence if legacy cleanup fails for %s', async key => {
  values.set(key, 'old residual'); remote = async () => { throw new Error('Offline'); };
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async current => { if (current === key) throw new Error('Delete denied'); values.delete(current); });
  expect(await logout(() => { }).completion).toMatchObject({ localDurable: true, cleanupComplete: false });
  expect(await storage.getToken()).toBeNull(); expect(JSON.parse(values.get(storage.SESSION_KEY)!).status).toBe('signedOut');
});
it('reports persistence failure honestly while keeping local UI signed out', async () => {
  remote = async () => { throw new Error('Offline'); };
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('Write denied'));
  expect(await logout(() => { }).completion).toMatchObject({ localDurable: false, cleanupComplete: false });
  expect(storage.isLocallySignedOut()).toBe(true); expect(await storage.getToken()).toBeNull();
});
it('does not publish installation superseded by local logout', async () => {
  const entered = deferred(), release = deferred(); let calls = 0;
  remote = async () => { calls++; throw new Error('No request expected'); };
  jest.mocked(SecureStore.setItemAsync).mockImplementationOnce(async (key, value) => { entered.resolve(); await release.promise; values.set(key, value); });
  const pending = storage.installSession(loginSession('B'), await storage.reconcileSession());
  await entered.promise; const operation = logout(() => { }); release.resolve();
  expect(await pending).toBe(false); await operation.completion;
  expect(await storage.getToken()).toBeNull(); expect(calls).toBe(0);
});
it('legacy service delegates to safe coordinator rather than current-token client', async () => {
  remote = async config => { expect(config.headers.get('Authorization')).toBe(`Bearer ${loginSession().access_token}`); return { config, headers: {}, status: 200, statusText: 'OK', data: { message: 'Logout realizado com sucesso.' } }; };
  const { logoutSession } = require('../../src/modules/auth/services/authService');
  expect(await logoutSession()).toEqual({ message: 'Logout realizado com sucesso.' });
  expect(await storage.getToken()).toBeNull();
});
it('suppresses A completion warning after a missed notification from another web context B', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  installWebEnvironment(values);
  const entered = deferred(), release = deferred(), notice = jest.fn();
  remote = async () => { entered.resolve(); await release.promise; throw new Error('Offline'); };
  const old = logout(notice); await entered.promise;
  let other!: typeof storage;
  jest.isolateModules(() => { other = require('../../storage/authStorage'); });
  await other.installSession(loginSession('B'), await other.reconcileSession());
  release.resolve(); await old.completion;
  expect(notice).not.toHaveBeenCalled();
  expect(await other.getToken()).toBe(loginSession('B').access_token);
});
