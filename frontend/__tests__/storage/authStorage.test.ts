import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Platform } from 'react-native';
import {
  clearSession,
  getRefreshToken,
  getToken,
  getUser,
  removeToken,
  saveRefreshToken,
  saveToken,
  saveUser,
  subscribeAuthState,
} from '../../storage/authStorage';
import { UsuarioLogado } from '../../types/auth';

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const originalPlatformOS = Platform.OS;
const originalLocalStorage = 'localStorage' in globalThis
  ? globalThis.localStorage
  : undefined;

function createMemoryLocalStorage(): Storage {
  const store = new Map<string, string>();

  return {
    clear: jest.fn(() => {
      store.clear();
    }),
    getItem: jest.fn((key: string) => store.get(key) ?? null),
    key: jest.fn((index: number) => Array.from(store.keys())[index] ?? null),
    get length() {
      return store.size;
    },
    removeItem: jest.fn((key: string) => {
      store.delete(key);
    }),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

const memoryLocalStorage = createMemoryLocalStorage();

beforeAll(() => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'web',
  });

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: memoryLocalStorage,
  });
});

afterAll(() => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatformOS,
  });

  if (originalLocalStorage) {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  } else {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe('authStorage', () => {
  it('salva, busca e remove o token de acesso no armazenamento web', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeAuthState(listener);

    await saveToken('access-token-teste');

    expect(await getToken()).toBe('access-token-teste');
    expect(listener).toHaveBeenCalledTimes(1);

    await removeToken();

    expect(await getToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('limpa token, refresh token e usuario da sessao', async () => {
    const usuario: UsuarioLogado = {
      email: 'andre@exemplo.com',
      id: 'usuario-1',
      nome: 'Andre',
    };

    await saveToken('access-token-teste');
    await saveRefreshToken('refresh-token-teste');
    await saveUser(usuario);

    await clearSession();

    expect(await getToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
    expect(await getUser()).toBeNull();
  });

  it('descarta usuario salvo quando o JSON esta invalido', async () => {
    localStorage.setItem('usuario_logado', '{usuario-invalido');

    expect(await getUser()).toBeNull();
    expect(localStorage.getItem('usuario_logado')).toBeNull();
  });
});
