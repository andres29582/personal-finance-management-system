import React, { useEffect, useState } from 'react';
import { Text, Platform } from 'react-native';
import { render, screen, waitFor, act } from '@testing-library/react-native';
import axios, { AxiosAdapter } from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as storage from '../../storage/authStorage';
import { resolveApiError } from '../../utils/api-error';
import { loginSession } from '../helpers/session-fixtures';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));

const values = new Map<string, string>();
let adapter: AxiosAdapter;
const dispatch: AxiosAdapter = (config) => adapter(config);
const originalAdapter = axios.defaults.adapter;

function ProtectedConsumer() {
  const [message, setMessage] = useState('Waiting');
  useEffect(() => {
    let active = true;
    const { api } = require('../../src/shared/services/api');
    void api.get('/contas').then(
      (response: { data: { label: string } }) => { if (active) setMessage(response.data.label); },
      async (error: unknown) => {
        const resolved = await resolveApiError(error, 'Fallback');
        if (active) setMessage(resolved.unauthorized ? 'Login required' : resolved.message);
      },
    );
    return () => { active = false; };
  }, []);
  return <Text testID="result">{message}</Text>;
}

beforeEach(async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key) => values.get(key) ?? null);
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key, value) => { values.set(key, value); });
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key) => { values.delete(key); });
  await storage.clearSession();
  await storage.installSession(loginSession(), await storage.reconcileSession());
  axios.defaults.adapter = dispatch;
  const { api } = require('../../src/shared/services/api');
  api.defaults.adapter = dispatch;
});
afterAll(() => { axios.defaults.adapter = originalAdapter; });

it('requires login after protected401 and ambiguous refresh503 without replay', async () => {
  adapter = async (config) => { throw { isAxiosError: true, config, response: { status: config.url === '/auth/refresh' ? 503 : 401 } }; };
  render(<ProtectedConsumer />);
  await waitFor(() => expect(screen.getByText('Login required')).toBeTruthy());
  expect(await storage.getToken()).toBeNull();
});

it('does not display stale A data after B installation', async () => {
  let release!: () => void;
  let entered!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { entered = resolve; });
  adapter = async (config) => { entered(); await barrier; return { config, status: 200, statusText: 'OK', headers: {}, data: { label: 'Private A' } }; };
  render(<ProtectedConsumer />);
  await started;
  await act(async () => {
    await storage.installSession(loginSession('B'), await storage.reconcileSession());
    release();
  });
  await waitFor(() => expect(screen.getByTestId('result').props.children).toBe(''));
  expect(screen.queryByText('Private A')).toBeNull();
  expect(await storage.getToken()).toBe(loginSession('B').access_token);
});
