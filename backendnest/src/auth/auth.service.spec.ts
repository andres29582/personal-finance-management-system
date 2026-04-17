import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthSessionsService } from './auth-sessions.service';
import { AuthService } from './auth.service';
import { CategoriasService } from '../categorias/categorias.service';
import { LogsService } from '../logs/logs.service';
import { UsersService } from '../users/users.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<
    Pick<
      UsersService,
      'create' | 'findByCpf' | 'findByEmail' | 'findById' | 'updatePassword'
    >
  >;
  let jwtService: jest.Mocked<
    Pick<JwtService, 'decode' | 'signAsync' | 'verifyAsync'>
  >;
  let categoriasService: jest.Mocked<
    Pick<CategoriasService, 'seedDefaultCategories'>
  >;
  let authSessionsService: jest.Mocked<
    Pick<
      AuthSessionsService,
      | 'create'
      | 'findActiveById'
      | 'hasMatchingRefreshToken'
      | 'revoke'
      | 'revokeAllByUser'
      | 'rotate'
    >
  >;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let logsService: jest.Mocked<Pick<LogsService, 'logAuthEvent'>>;

  beforeEach(() => {
    usersService = {
      create: jest.fn(),
      findByCpf: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updatePassword: jest.fn(),
    };
    jwtService = {
      decode: jest.fn(),
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };
    categoriasService = {
      seedDefaultCategories: jest.fn(),
    };
    authSessionsService = {
      create: jest.fn(),
      findActiveById: jest.fn(),
      hasMatchingRefreshToken: jest.fn(),
      revoke: jest.fn(),
      revokeAllByUser: jest.fn(),
      rotate: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: 'access-secret',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_REFRESH_EXPIRES_IN: '30d',
          JWT_SECRET: 'legacy-secret',
        };

        return values[key];
      }),
    } as never;
    logsService = {
      logAuthEvent: jest.fn(),
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      categoriasService as unknown as CategoriasService,
      authSessionsService as unknown as AuthSessionsService,
      configService as unknown as ConfigService,
      logsService as unknown as LogsService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers a new user and seeds default categories', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    usersService.findByCpf.mockResolvedValue(null);
    usersService.create.mockResolvedValue({
      cep: '01001000',
      cidade: 'Sao Paulo',
      cpf: '52998224725',
      email: 'ana@example.com',
      endereco: 'Rua das Flores',
      id: 'user-1',
      nome: 'Ana',
      numero: '123',
      moedaPadrao: 'BRL',
      senhaHash: 'hashed-password',
    } as never);
    categoriasService.seedDefaultCategories.mockResolvedValue([] as never);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    const result = await service.register({
      cep: '01001-000',
      cidade: 'Sao Paulo',
      cpf: '529.982.247-25',
      email: 'ana@example.com',
      endereco: 'Rua das Flores',
      nome: 'Ana',
      numero: '123',
      senha: 'segredo123',
    });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cep: '01001000',
        cidade: 'Sao Paulo',
        cpf: '52998224725',
        email: 'ana@example.com',
        endereco: 'Rua das Flores',
        nome: 'Ana',
        numero: '123',
        senhaHash: 'hashed-password',
      }),
    );
    expect(categoriasService.seedDefaultCategories).toHaveBeenCalledWith(
      'user-1',
    );
    expect(result).toEqual({
      usuario: {
        email: 'ana@example.com',
        id: 'user-1',
        nome: 'Ana',
        cep: '01001000',
        cidade: 'Sao Paulo',
        cpf: '52998224725',
        endereco: 'Rua das Flores',
        numero: '123',
        moedaPadrao: 'BRL',
      },
    });
  });

  it('rejects registration when the email already exists', async () => {
    usersService.findByEmail.mockResolvedValue({
      email: 'ana@example.com',
      id: 'user-1',
    } as never);

    await expect(
      service.register({
        cep: '01001-000',
        cidade: 'Sao Paulo',
        cpf: '529.982.247-25',
        email: 'ana@example.com',
        endereco: 'Rua das Flores',
        nome: 'Ana',
        numero: '123',
        senha: 'segredo123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects registration when the cpf already exists', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    usersService.findByCpf.mockResolvedValue({
      cpf: '52998224725',
      id: 'user-1',
    } as never);

    await expect(
      service.register({
        cep: '01001-000',
        cidade: 'Sao Paulo',
        cpf: '529.982.247-25',
        email: 'ana@example.com',
        endereco: 'Rua das Flores',
        nome: 'Ana',
        numero: '123',
        senha: 'segredo123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns access and refresh tokens on valid sign in', async () => {
    usersService.findByEmail.mockResolvedValue({
      cep: '01001000',
      cidade: 'Sao Paulo',
      cpf: '52998224725',
      email: 'ana@example.com',
      endereco: 'Rua das Flores',
      id: 'user-1',
      nome: 'Ana',
      numero: '123',
      moedaPadrao: 'BRL',
      senhaHash: 'hashed-password',
    } as never);
    jwtService.signAsync
      .mockResolvedValueOnce('refresh-token-1')
      .mockResolvedValueOnce('access-token-1');
    jwtService.decode.mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.signIn('ana@example.com', 'segredo123');

    expect(authSessionsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshToken: 'refresh-token-1',
        userId: 'user-1',
      }),
    );
    expect(result.access_token).toBe('access-token-1');
    expect(result.refresh_token).toBe('refresh-token-1');
    expect(result.usuario.email).toBe('ana@example.com');
    expect(logsService.logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'LOGIN_SUCCESS',
        userId: 'user-1',
      }),
    );
  });

  it('rejects invalid passwords on sign in', async () => {
    usersService.findByEmail.mockResolvedValue({
      cep: '01001000',
      cidade: 'Sao Paulo',
      cpf: '52998224725',
      email: 'ana@example.com',
      endereco: 'Rua das Flores',
      id: 'user-1',
      nome: 'Ana',
      numero: '123',
      senhaHash: 'hashed-password',
    } as never);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.signIn('ana@example.com', 'segredo123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(logsService.logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'LOGIN_FAILED',
        success: false,
        userId: 'user-1',
      }),
    );
  });

  it('rotates the refresh token and returns a new access token', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sid: 'session-1',
      sub: 'user-1',
    } as never);
    authSessionsService.findActiveById.mockResolvedValue({
      expiresAt: new Date(Date.now() + 3600_000),
      id: 'session-1',
      refreshTokenHash: 'hash',
      revokedAt: null,
      userId: 'user-1',
    } as never);
    authSessionsService.hasMatchingRefreshToken.mockReturnValue(true);
    usersService.findById.mockResolvedValue({
      cep: '01001000',
      cidade: 'Sao Paulo',
      cpf: '52998224725',
      email: 'ana@example.com',
      endereco: 'Rua das Flores',
      id: 'user-1',
      nome: 'Ana',
      numero: '123',
      moedaPadrao: 'BRL',
      senhaHash: 'hashed-password',
    } as never);
    jwtService.signAsync
      .mockResolvedValueOnce('refresh-token-2')
      .mockResolvedValueOnce('access-token-2');
    jwtService.decode.mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const result = await service.refreshSession('refresh-token-1');

    expect(authSessionsService.rotate).toHaveBeenCalledWith(
      'session-1',
      'refresh-token-2',
      expect.any(Date),
    );
    expect(result).toEqual({
      access_token: 'access-token-2',
      refresh_token: 'refresh-token-2',
    });
  });

  it('revokes the current session on logout', async () => {
    const result = await service.logout('user-1', 'session-1');

    expect(authSessionsService.revoke).toHaveBeenCalledWith(
      'session-1',
      'user-1',
    );
    expect(result.message).toContain('Sessao encerrada');
    expect(logsService.logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'LOGOUT_SUCCESS',
        userId: 'user-1',
      }),
    );
  });

  it('updates the password hash and revokes active sessions on resetPassword', async () => {
    usersService.findById.mockResolvedValue({
      cep: '01001000',
      cidade: 'Sao Paulo',
      cpf: '52998224725',
      email: 'ana@example.com',
      endereco: 'Rua das Flores',
      id: 'user-1',
      nome: 'Ana',
      numero: '123',
      senhaHash: 'hashed-password',
    } as never);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

    const result = await service.resetPassword('user-1', 'novaSenha123');

    expect(usersService.updatePassword).toHaveBeenCalledWith(
      'user-1',
      'new-hash',
    );
    expect(authSessionsService.revokeAllByUser).toHaveBeenCalledWith('user-1');
    expect(result.message).toContain('Senha atualizada');
    expect(logsService.logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reset_password',
        event: 'PASSWORD_RESET_SUCCESS',
        userId: 'user-1',
      }),
    );
  });
});
