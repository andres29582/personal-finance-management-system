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
  removeRefreshToken,
  removeToken,
  saveRefreshToken,
  saveToken,
  saveUser,
  subscribeAuthState,
} from '../../storage/authStorage';
import { UsuarioLogado } from '../../src/modules/auth/types/auth';

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

const USUARIO_VALIDO: UsuarioLogado = {
  email: 'andre@exemplo.com',
  id: '550e8400-e29b-41d4-a716-446655440000',
  nome: 'Andre Silva',
};

describe('authStorage - Token', () => {
  it('deve salvar token de acesso', async () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

    await saveToken(token);

    expect(await getToken()).toBe(token);
    expect(localStorage.setItem).toHaveBeenCalledWith('access_token', token);
  });

  it('deve retornar null se token não existe', async () => {
    const token = await getToken();
    expect(token).toBeNull();
  });

  it('deve remover token de acesso', async () => {
    await saveToken('token123');
    await removeToken();

    expect(await getToken()).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
  });

  it('deve notificar listeners ao salvar token', async () => {
    const listener = jest.fn();
    subscribeAuthState(listener);

    await saveToken('token123');

    expect(listener).toHaveBeenCalled();
  });

  it('deve notificar listeners ao remover token', async () => {
    const listener = jest.fn();
    subscribeAuthState(listener);

    await removeToken();

    expect(listener).toHaveBeenCalled();
  });
});

describe('authStorage - Refresh Token', () => {
  it('deve salvar refresh token', async () => {
    const refreshToken = 'refresh_token_value_xyz';

    await saveRefreshToken(refreshToken);

    expect(await getRefreshToken()).toBe(refreshToken);
  });

  it('deve retornar null se refresh token não existe', async () => {
    const token = await getRefreshToken();
    expect(token).toBeNull();
  });

  it('deve remover refresh token', async () => {
    await saveRefreshToken('refresh123');
    await removeRefreshToken();

    expect(await getRefreshToken()).toBeNull();
  });
});

describe('authStorage - Usuário', () => {
  it('deve salvar usuário válido', async () => {
    await saveUser(USUARIO_VALIDO);

    const retrieved = await getUser();
    expect(retrieved).toEqual(USUARIO_VALIDO);
  });

  it('deve rejeitar usuário inválido (sem id)', async () => {
    const usuarioInvalido = {
      nome: 'João',
      email: 'joao@example.com',
    };

    await expect(saveUser(usuarioInvalido as any)).rejects.toThrow(
      'Dados de usuario invalidos para salvar na sessao.'
    );
  });

  it('deve rejeitar usuário inválido (sem nome)', async () => {
    const usuarioInvalido = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'joao@example.com',
    };

    await expect(saveUser(usuarioInvalido as any)).rejects.toThrow(
      'Dados de usuario invalidos para salvar na sessao.'
    );
  });

  it('deve rejeitar usuário inválido (sem email)', async () => {
    const usuarioInvalido = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      nome: 'João',
    };

    await expect(saveUser(usuarioInvalido as any)).rejects.toThrow(
      'Dados de usuario invalidos para salvar na sessao.'
    );
  });

  it('deve retornar null se usuário não existe', async () => {
    const user = await getUser();
    expect(user).toBeNull();
  });

  it('deve descartar usuário com JSON inválido', async () => {
    localStorage.setItem('usuario_logado', '{usuario-invalido');

    const user = await getUser();

    expect(user).toBeNull();
    expect(localStorage.getItem('usuario_logado')).toBeNull();
  });

  it('deve descartar usuário com estrutura inválida (objeto sem campos obrigatórios)', async () => {
    const usuarioMalformado = { nome: 'João', numero: 123 };
    localStorage.setItem('usuario_logado', JSON.stringify(usuarioMalformado));

    const user = await getUser();

    expect(user).toBeNull();
    expect(localStorage.getItem('usuario_logado')).toBeNull();
  });

  it('deve descartar string "undefined"', async () => {
    localStorage.setItem('usuario_logado', 'undefined');

    const user = await getUser();

    expect(user).toBeNull();
  });

  it('deve descartar string "null"', async () => {
    localStorage.setItem('usuario_logado', 'null');

    const user = await getUser();

    expect(user).toBeNull();
  });
});

describe('authStorage - clearSession', () => {
  it('deve limpar token, refresh token e usuário', async () => {
    await saveToken('token123');
    await saveRefreshToken('refresh123');
    await saveUser(USUARIO_VALIDO);

    await clearSession();

    expect(await getToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
    expect(await getUser()).toBeNull();
  });

  it('deve ser seguro chamar clearSession mesmo sem dados salvos', async () => {
    await expect(clearSession()).resolves.not.toThrow();
  });
});

describe('authStorage - subscribeAuthState', () => {
  it('deve notificar múltiplos listeners ao salvar token', async () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();

    subscribeAuthState(listener1);
    subscribeAuthState(listener2);

    await saveToken('token123');

    expect(listener1).toHaveBeenCalled();
    expect(listener2).toHaveBeenCalled();
  });

  it('deve permitir unsubscribe de listener', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeAuthState(listener);

    await saveToken('token123');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await saveToken('token456');

    expect(listener).toHaveBeenCalledTimes(1); // Não foi chamado novamente
  });
});

describe('authStorage - Integration', () => {
  it('deve manter sessão completa (token + refresh + user) e limpar', async () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
    const refreshToken = 'refresh_xyz_123';

    // Salvar tudo
    await saveToken(token);
    await saveRefreshToken(refreshToken);
    await saveUser(USUARIO_VALIDO);

    // Verificar tudo está lá
    expect(await getToken()).toBe(token);
    expect(await getRefreshToken()).toBe(refreshToken);
    expect(await getUser()).toEqual(USUARIO_VALIDO);

    // Limpar
    await clearSession();

    // Verificar tudo foi removido
    expect(await getToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
    expect(await getUser()).toBeNull();
  });
});
