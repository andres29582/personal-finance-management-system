import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
} from '../services/userService';
import { UpdateUserProfileRequestDto, UserProfile } from '../types/user';
import { api } from '../../../shared/services/api';

jest.mock('../../../shared/services/api', () => ({
  api: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function makeUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    cep: '01001-000',
    cidade: 'Sao Paulo',
    cpf: '12345678901',
    dataRegistro: '2026-01-01',
    email: 'user@example.com',
    endereco: 'Rua Teste',
    id: 'usuario-1',
    moedaPadrao: 'BRL',
    nome: 'Usuario Teste',
    numero: '123',
    ...overrides,
  };
}

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('busca perfil do usuario atual', async () => {
    const profile = makeUserProfile();
    mockedApi.get.mockResolvedValueOnce({ data: profile });

    const result = await getCurrentUserProfile();

    expect(mockedApi.get).toHaveBeenCalledWith('/users/me');
    expect(result).toEqual(profile);
  });

  it('atualiza perfil do usuario atual', async () => {
    const payload: UpdateUserProfileRequestDto = {
      cep: '01001-000',
      cidade: 'Sao Paulo',
      cpf: '12345678901',
      email: 'novo@example.com',
      endereco: 'Rua Nova',
      nome: 'Usuario Novo',
      numero: '456',
    };
    const profile = makeUserProfile(payload);
    mockedApi.patch.mockResolvedValueOnce({ data: profile });

    const result = await updateCurrentUserProfile(payload);

    expect(mockedApi.patch).toHaveBeenCalledWith('/users/me', payload);
    expect(result).toEqual(profile);
  });
});
