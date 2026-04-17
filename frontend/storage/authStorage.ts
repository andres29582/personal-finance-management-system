import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { UsuarioLogado } from '../types/auth';

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'usuario_logado';
const authStateListeners = new Set<() => void>();

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }

  return await SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

function notifyAuthStateListeners() {
  authStateListeners.forEach((listener) => listener());
}

function isUsuarioLogado(value: unknown): value is UsuarioLogado {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.nome === 'string' &&
    typeof candidate.email === 'string'
  );
}

export async function saveToken(token: string): Promise<void> {
  await setItem(TOKEN_KEY, token);
  notifyAuthStateListeners();
}

export async function getToken(): Promise<string | null> {
  return await getItem(TOKEN_KEY);
}

export async function saveRefreshToken(refreshToken: string): Promise<void> {
  await setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function getRefreshToken(): Promise<string | null> {
  return await getItem(REFRESH_TOKEN_KEY);
}

export async function removeRefreshToken(): Promise<void> {
  await removeItem(REFRESH_TOKEN_KEY);
}

export async function removeToken(): Promise<void> {
  await removeItem(TOKEN_KEY);
  notifyAuthStateListeners();
}

export async function saveUser(user: UsuarioLogado): Promise<void> {
  if (!isUsuarioLogado(user)) {
    throw new Error('Dados de usuario invalidos para salvar na sessao.');
  }

  await setItem(USER_KEY, JSON.stringify(user));
}

export async function getUser(): Promise<UsuarioLogado | null> {
  const user = await getItem(USER_KEY);

  if (!user || user === 'undefined' || user === 'null') {
    await removeUser();
    return null;
  }

  try {
    const parsedUser: unknown = JSON.parse(user);

    if (!isUsuarioLogado(parsedUser)) {
      await removeUser();
      return null;
    }

    return parsedUser;
  } catch {
    await removeUser();
    return null;
  }
}

export async function removeUser(): Promise<void> {
  await removeItem(USER_KEY);
}

export async function clearSession(): Promise<void> {
  await removeToken();
  await removeRefreshToken();
  await removeUser();
}

export function subscribeAuthState(listener: () => void) {
  authStateListeners.add(listener);

  return () => {
    authStateListeners.delete(listener);
  };
}
