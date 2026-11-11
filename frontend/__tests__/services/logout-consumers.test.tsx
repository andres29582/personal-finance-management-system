import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { Alert, Platform, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios, { AxiosAdapter } from 'axios';
import * as storage from '../../storage/authStorage';
import { logout } from '../../src/modules/auth/services/logoutCoordinator';
import { HomeScreen } from '../../src/modules/dashboard/screens/HomeScreen';
import { RootLayout } from '../../src/navigation/RootLayout';
import { useDashboardData } from '../../src/modules/dashboard/hooks/useDashboardData';
import { getDashboard } from '../../src/modules/dashboard/services/dashboardService';
import { loginSession } from '../helpers/session-fixtures';
import { UsuarioScreen } from '../../src/modules/usuario/screens/UsuarioScreen';
import { ResetPasswordScreen } from '../../src/modules/auth/screens/ResetPasswordScreen';
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace, push: jest.fn() };
jest.mock('expo-router', () => { const React = require('react'); return { router: mockRouter, useRouter: () => mockRouter, useSegments: () => ['home'], useRootNavigationState: () => ({ key: 'navigation' }), useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]), Stack: () => null }; });
jest.mock('../../src/modules/dashboard/services/dashboardService');
jest.mock('../../src/modules/metas/services/metaService', () => ({ listMetas: jest.fn(async () => []) }));
jest.mock('../../src/modules/orcamentos/services/orcamentoService', () => ({ listOrcamentos: jest.fn(async () => []) }));
const values = new Map<string, string>();
let adapter: AxiosAdapter;
const dispatch: AxiosAdapter = config => adapter(config);
const original = axios.defaults.adapter;
function deferred<T = void>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(async () => { jest.useRealTimers(); jest.clearAllMocks(); Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' }); values.clear(); (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key) => values.get(key) ?? null); (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key, value) => { values.set(key, value); }); (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key) => { values.delete(key); }); await storage.installSession({ ...loginSession(), usuario: { id: 'A', nome: 'Ana', email: 'ana@example.com' } }, await storage.reconcileSession()); axios.defaults.adapter = dispatch; });
afterAll(() => { axios.defaults.adapter = original; });
it('actual profile consumer cannot publish or persist an old response after B', async () => {
  const entered = deferred(), release = deferred();
  adapter = async config => {
    entered.resolve(); await release.promise;
    return { config, headers: {}, status: 200, statusText: 'OK', data: { ...loginSession().usuario, nome: 'Private profile A' } };
  };
  const { api } = require('../../src/shared/services/api'); api.defaults.adapter = dispatch;
  render(<UsuarioScreen />);
  await entered.promise;
  await act(async () => {
    await storage.installSession(loginSession('B'), await storage.reconcileSession());
    release.resolve();
  });
  await waitFor(() => expect(screen.queryByDisplayValue('Private profile A')).toBeNull());
  expect((await storage.getUser())?.id).toBe('B');
});
it('actual password-change consumer does not clear B on late successful A response', async () => {
  const entered = deferred(), release = deferred();
  adapter = async config => {
    entered.resolve(); await release.promise;
    return { config, headers: {}, status: 200, statusText: 'OK', data: { message: 'Senha atualizada.' } };
  };
  const { api } = require('../../src/shared/services/api'); api.defaults.adapter = dispatch;
  render(<ResetPasswordScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Digite sua senha atual'), 'old password');
  fireEvent.changeText(screen.getByPlaceholderText('Entre 6 e 64 caracteres'), 'new password');
  fireEvent.changeText(screen.getByPlaceholderText('Repita a nova senha'), 'new password');
  fireEvent.press(screen.getByText('Atualizar senha'));
  await entered.promise;
  await act(async () => { await storage.installSession(loginSession('B'), await storage.reconcileSession()); release.resolve(); });
  await waitFor(() => expect(screen.queryByText('Senha atualizada.')).toBeNull());
  expect((await storage.getUser())?.id).toBe('B');
});
it('Root and Home close protected UI even if post-send unknown storage is denied', async () => {
  const entered = deferred(), release = deferred();
  adapter = async config => {
    if (config.url === '/pending') { entered.resolve(); await release.promise; return { config, headers: {}, status: 200, statusText: 'OK', data: { privateA: true } }; }
    if (config.url === '/auth/refresh') throw new Error('Possible-send response lost');
    throw { isAxiosError: true, config, response: { status: 401 } };
  };
  const { api } = require('../../src/shared/services/api'); api.defaults.adapter = dispatch;
  const home = render(<HomeScreen />);
  await waitFor(() => expect(home.getByText('Bem-vindo, Ana')).toBeTruthy());
  render(<RootLayout />);
  let published: unknown;
  const pending = api.get('/pending').then((response: { data: unknown }) => { published = response.data; }, () => { });
  await entered.promise;
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => {
    if (JSON.parse(value).status === 'refreshOutcomeUnknown') throw new Error('Unknown write denied');
    values.set(key, value);
  });
  try {
    await act(async () => { await api.get('/contas').catch(() => { }); });
    expect(home.queryByText('Bem-vindo, Ana')).toBeNull();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
    release.resolve(); await pending;
    expect(published).toBeUndefined();
    expect(await storage.getToken()).toBeNull();
  } finally { release.resolve(); await pending; }
});
it('HomeScreen removes A and navigates before a hung remote attempt completes', async () => {
  let remoteEntered = false;
  adapter = async () => { remoteEntered = true; return new Promise(() => { }); };
  const warning = jest.spyOn(Alert, 'alert').mockImplementation(() => { });
  render(<HomeScreen />);
  await waitFor(() => expect(screen.getByText('Bem-vindo, Ana')).toBeTruthy());
  // Only logout owns fake time; mounting and user loading are already complete.
  jest.useFakeTimers();
  try {
    fireEvent.press(screen.getByLabelText('Sair da conta'));
    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Bem-vindo, Ana')).toBeNull();
    await waitFor(() => expect(remoteEntered).toBe(true));
    expect(warning).not.toHaveBeenCalled();
    await act(async () => { await jest.advanceTimersByTimeAsync(5000); });
    expect(warning).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
    warning.mockRestore();
  }
});
it('RootLayout reacts before a pending old storage read completes', async () => { const entered = deferred(), release = deferred(); (SecureStore.getItemAsync as jest.Mock).mockImplementationOnce(async () => { entered.resolve(); await release.promise; return null; }); adapter = async () => { throw new Error('offline'); }; render(<RootLayout />); await entered.promise; let operation!: ReturnType<typeof logout>; act(() => { operation = logout(() => { }); }); await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login')); release.resolve(); await act(async () => { await operation.completion; }); expect(mockReplace).not.toHaveBeenCalledWith('/dashboard'); });
it('dashboard clears all published state and ignores a load finishing after logout', async () => { const entered = deferred(), release = deferred<any>(); jest.mocked(getDashboard).mockImplementation(async () => { entered.resolve(); return release.promise; }); adapter = async () => { throw new Error('offline'); }; const warning = jest.spyOn(Alert, 'alert').mockImplementation(() => { }); const hook = renderHook(() => useDashboardData()); await entered.promise; let done!: Promise<void>; act(() => { done = hook.result.current.handleLogout(); }); expect(mockReplace).toHaveBeenCalledWith('/login'); expect(hook.result.current.dashboard).toBeNull(); expect(hook.result.current.usuario).toBeNull(); await act(async () => { release.resolve({ mesReferencia: '2026-10', privateA: true }); await done; }); expect(hook.result.current.dashboard).toBeNull(); expect(hook.result.current.metaDestaque).toBeNull(); expect(hook.result.current.orcamentoMes).toBeNull(); expect(hook.result.current.message).toBe(''); warning.mockRestore(); });
