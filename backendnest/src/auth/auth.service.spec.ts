import {
  AppConflictException,
  AppUnauthorizedException,
  ValidationAppException,
} from '../common/exceptions';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthSessionsService } from './auth-sessions.service';
import { PasswordResetDeliveryService } from './password-reset-delivery.service';
import { AuthService } from './auth.service';
import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
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
      | 'revoke'
      | 'revokeAllByUser'
      | 'rotateIfActiveWithMatchingToken'
    >
  >;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let configValues: Record<string, string | undefined>;
  let logsService: jest.Mocked<Pick<LogsService, 'logAuthEvent'>>;
  let passwordResetTokenRepository: jest.Mocked<
    Pick<
      PasswordResetTokenRepository,
      'consumeAndResetPassword' | 'createToken'
    >
  >;
  let passwordResetDeliveryService: jest.Mocked<
    Pick<PasswordResetDeliveryService, 'deliver'>
  >;

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
      revoke: jest.fn(),
      revokeAllByUser: jest.fn(),
      rotateIfActiveWithMatchingToken: jest.fn(),
    };
    configValues = {
      AUTH_RETURN_RESET_TOKEN: 'false',
      JWT_ACCESS_SECRET: 'access-secret',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_SECRET: 'refresh-secret',
      JWT_REFRESH_EXPIRES_IN: '30d',
      JWT_SECRET: 'legacy-secret',
      NODE_ENV: 'test',
      PASSWORD_RESET_TTL_MINUTES: '60',
    };
    configService = {
      get: jest.fn((key: string) => configValues[key]),
    } as never;
    logsService = {
      logAuthEvent: jest.fn(),
    };
    passwordResetTokenRepository = {
      consumeAndResetPassword: jest.fn(),
      createToken: jest.fn(),
    };
    passwordResetDeliveryService = {
      deliver: jest.fn(),
    };

    service = createService();
  });

  function createService(): AuthService {
    return new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      categoriasService as unknown as CategoriasService,
      authSessionsService as unknown as AuthSessionsService,
      configService as unknown as ConfigService,
      logsService as unknown as LogsService,
      passwordResetTokenRepository as unknown as PasswordResetTokenRepository,
      passwordResetDeliveryService as unknown as PasswordResetDeliveryService,
    );
  }

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
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
      aceitoPoliticaPrivacidade: true,
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
        lgpdConsentimentoEm: expect.any(Date) as Date,
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

  it('hashes the registration password exactly as received', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    usersService.findByCpf.mockResolvedValue(null);
    usersService.create.mockResolvedValue({
      id: 'user-1',
      email: 'ana@example.com',
      nome: 'Ana',
    } as never);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    const password = ' senha com espacos ';

    await service.register({
      aceitoPoliticaPrivacidade: true,
      cep: '01001000',
      cidade: 'Sao Paulo',
      cpf: '52998224725',
      email: 'ana@example.com',
      endereco: 'Rua A',
      nome: 'Ana',
      numero: '1',
      senha: password,
    });

    expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
  });

  it('rejects registration with an invalid cpf', async () => {
    const promise = service.register({
      aceitoPoliticaPrivacidade: true,
      cep: '01001-000',
      cidade: 'Sao Paulo',
      cpf: '123',
      email: 'ana@example.com',
      endereco: 'Rua das Flores',
      nome: 'Ana',
      numero: '123',
      senha: 'segredo123',
    });

    await expect(promise).rejects.toBeInstanceOf(ValidationAppException);
    await expect(promise).rejects.toMatchObject({
      code: 'AUTH_INVALID_CPF',
      field: 'cpf',
      message: 'CPF deve ter 11 digitos.',
      statusCode: 422,
    });
    expect(usersService.findByEmail).not.toHaveBeenCalled();
  });

  it('rejects registration with an invalid cep', async () => {
    const promise = service.register({
      aceitoPoliticaPrivacidade: true,
      cep: '123',
      cidade: 'Sao Paulo',
      cpf: '529.982.247-25',
      email: 'ana@example.com',
      endereco: 'Rua das Flores',
      nome: 'Ana',
      numero: '123',
      senha: 'segredo123',
    });

    await expect(promise).rejects.toBeInstanceOf(ValidationAppException);
    await expect(promise).rejects.toMatchObject({
      code: 'AUTH_INVALID_CEP',
      field: 'cep',
      message: 'CEP invalido.',
      statusCode: 422,
    });
    expect(usersService.findByEmail).not.toHaveBeenCalled();
  });

  it('rejects registration when the email already exists', async () => {
    usersService.findByEmail.mockResolvedValue({
      email: 'ana@example.com',
      id: 'user-1',
    } as never);

    const promise = service.register({
      aceitoPoliticaPrivacidade: true,
      cep: '01001-000',
      cidade: 'Sao Paulo',
      cpf: '529.982.247-25',
      email: 'ana@example.com',
      endereco: 'Rua das Flores',
      nome: 'Ana',
      numero: '123',
      senha: 'segredo123',
    });

    await expect(promise).rejects.toBeInstanceOf(AppConflictException);
    await expect(promise).rejects.toMatchObject({
      code: 'AUTH_EMAIL_ALREADY_EXISTS',
      field: 'email',
      message: 'E-mail ja cadastrado',
      statusCode: 409,
    });
  });

  it('rejects registration when the cpf already exists', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    usersService.findByCpf.mockResolvedValue({
      cpf: '52998224725',
      id: 'user-1',
    } as never);

    const promise = service.register({
      aceitoPoliticaPrivacidade: true,
      cep: '01001-000',
      cidade: 'Sao Paulo',
      cpf: '529.982.247-25',
      email: 'ana@example.com',
      endereco: 'Rua das Flores',
      nome: 'Ana',
      numero: '123',
      senha: 'segredo123',
    });

    await expect(promise).rejects.toBeInstanceOf(AppConflictException);
    await expect(promise).rejects.toMatchObject({
      code: 'AUTH_CPF_ALREADY_EXISTS',
      field: 'cpf',
      message: 'CPF ja cadastrado',
      statusCode: 409,
    });
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
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ tokenType: 'refresh' }),
      expect.objectContaining({
        algorithm: 'HS256',
        issuer: 'meu-sistema-financeiro',
        secret: 'refresh-secret',
      }),
    );
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ tokenType: 'access' }),
      expect.objectContaining({
        algorithm: 'HS256',
        issuer: 'meu-sistema-financeiro',
        secret: 'access-secret',
      }),
    );
    expect(result.usuario.email).toBe('ana@example.com');
    expect(result.usuario).not.toHaveProperty('senha');
    expect(result.usuario).not.toHaveProperty('senhaHash');
    expect(logsService.logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'LOGIN_SUCCESS',
        userId: 'user-1',
      }),
    );
  });

  it('compares a legacy short password without applying the new policy', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'legacy@example.com',
      nome: 'Legacy',
      senhaHash: 'legacy-hash',
    } as never);
    jwtService.signAsync
      .mockResolvedValueOnce('refresh-token-1')
      .mockResolvedValueOnce('access-token-1');
    jwtService.decode.mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await service.signIn('legacy@example.com', 'old');

    expect(bcrypt.compare).toHaveBeenCalledWith('old', 'legacy-hash');
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

    const promise = service.signIn('ana@example.com', 'segredo123');

    await expect(promise).rejects.toBeInstanceOf(AppUnauthorizedException);
    await expect(promise).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'E-mail ou senha invalidos',
      statusCode: 401,
    });
    expect(logsService.logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: {
          email: 'ana@example.com',
          reason: 'invalid_credentials',
        },
        event: 'LOGIN_FAILED',
        success: false,
        userId: 'user-1',
      }),
    );
    expect(
      JSON.stringify(logsService.logAuthEvent.mock.calls[0][0]),
    ).not.toContain('segredo123');
  });

  it('rejects login for unknown emails without revealing which credential failed', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    const promise = service.signIn('nao-existe@example.com', 'segredo123');

    await expect(promise).rejects.toBeInstanceOf(AppUnauthorizedException);
    await expect(promise).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'E-mail ou senha invalidos',
      statusCode: 401,
    });

    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(logsService.logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: {
          email: 'nao-existe@example.com',
          reason: 'invalid_credentials',
        },
        event: 'LOGIN_FAILED',
        success: false,
      }),
    );
    expect(
      JSON.stringify(logsService.logAuthEvent.mock.calls[0][0]),
    ).not.toContain('segredo123');
  });

  it('rejects invalid refresh tokens before touching sessions', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

    const promise = service.refreshSession('refresh-token-invalido');

    await expect(promise).rejects.toBeInstanceOf(AppUnauthorizedException);
    await expect(promise).rejects.toMatchObject({
      code: 'AUTH_INVALID_REFRESH_TOKEN',
      message: 'Refresh token invalido',
      statusCode: 401,
    });

    expect(authSessionsService.findActiveById).not.toHaveBeenCalled();
  });

  it('rotates the refresh token and returns a new access token', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sid: 'session-1',
      sub: 'user-1',
      tokenType: 'refresh',
    } as never);
    authSessionsService.findActiveById.mockResolvedValue({
      expiresAt: new Date(Date.now() + 3600_000),
      id: 'session-1',
      refreshTokenHash: 'hash',
      revokedAt: null,
      userId: 'user-1',
    } as never);
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
    authSessionsService.rotateIfActiveWithMatchingToken.mockResolvedValue(true);

    const result = await service.refreshSession('refresh-token-1');

    expect(
      authSessionsService.rotateIfActiveWithMatchingToken,
    ).toHaveBeenCalledWith(
      'session-1',
      'refresh-token-1',
      'refresh-token-2',
      expect.any(Date),
    );
    expect(result).toEqual({
      access_token: 'access-token-2',
      refresh_token: 'refresh-token-2',
    });
    expect(jwtService.verifyAsync).toHaveBeenCalledWith(
      'refresh-token-1',
      expect.objectContaining({
        algorithms: ['HS256'],
        ignoreExpiration: false,
        issuer: 'meu-sistema-financeiro',
        secret: 'refresh-secret',
      }),
    );
  });

  it('revokes a session and records refresh-token reuse', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sid: 'session-1',
      sub: 'user-1',
      tokenType: 'refresh',
    } as never);
    authSessionsService.findActiveById.mockResolvedValue({
      expiresAt: new Date(Date.now() + 3600_000),
      id: 'session-1',
      userId: 'user-1',
    } as never);
    usersService.findById.mockResolvedValue({ id: 'user-1' } as never);
    jwtService.signAsync.mockResolvedValue('next-refresh-token');
    jwtService.decode.mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    authSessionsService.rotateIfActiveWithMatchingToken.mockResolvedValue(
      false,
    );

    await expect(
      service.refreshSession('reused-refresh-token'),
    ).rejects.toMatchObject({
      code: 'AUTH_INVALID_REFRESH_TOKEN',
      statusCode: 401,
    });

    expect(authSessionsService.revoke).toHaveBeenCalledWith(
      'session-1',
      'user-1',
    );
    expect(logsService.logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'REFRESH_TOKEN_REUSE_DETECTED',
        success: false,
        userId: 'user-1',
      }),
    );
    expect(JSON.stringify(logsService.logAuthEvent.mock.calls)).not.toContain(
      'reused-refresh-token',
    );
  });

  it('rejects access tokens presented to the refresh endpoint', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sid: 'session-1',
      sub: 'user-1',
      tokenType: 'access',
    } as never);

    await expect(service.refreshSession('access-token')).rejects.toMatchObject({
      code: 'AUTH_INVALID_REFRESH_TOKEN',
      statusCode: 401,
    });
    expect(authSessionsService.findActiveById).not.toHaveBeenCalled();
  });

  it('does not expose password reset tokens by default', async () => {
    usersService.findByEmail.mockResolvedValue({
      email: 'ana@example.com',
      id: 'user-1',
    } as never);
    passwordResetTokenRepository.createToken.mockResolvedValue({} as never);

    const result = await service.requestPasswordReset('ana@example.com');

    expect(result).not.toHaveProperty('resetToken');
    expect(passwordResetTokenRepository.createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) as string,
        userId: 'user-1',
      }),
    );
    expect(logsService.logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        details: {
          email: 'ana@example.com',
        },
        event: 'PASSWORD_RESET_REQUESTED',
        userId: 'user-1',
      }),
    );
    expect(
      JSON.stringify(logsService.logAuthEvent.mock.calls[0][0]),
    ).not.toContain('resetToken');
  });

  it('exposes password reset tokens only when enabled in test or development', async () => {
    configValues.AUTH_RETURN_RESET_TOKEN = 'true';
    configValues.NODE_ENV = 'test';
    service = createService();
    usersService.findByEmail.mockResolvedValue({
      email: 'ana@example.com',
      id: 'user-1',
    } as never);
    passwordResetTokenRepository.createToken.mockResolvedValue({} as never);

    const result = await service.requestPasswordReset('ana@example.com');

    expect(result).toEqual(
      expect.objectContaining({
        message:
          'Se o e-mail estiver cadastrado, enviaremos instrucoes de recuperacao em instantes.',
        resetToken: expect.stringMatching(/^[a-f0-9]{64}$/) as string,
      }),
    );
  });

  it('never exposes a password reset token for unknown emails', async () => {
    configValues.AUTH_RETURN_RESET_TOKEN = 'true';
    configValues.NODE_ENV = 'test';
    service = createService();
    usersService.findByEmail.mockResolvedValue(null);

    const result = await service.requestPasswordReset('nao-existe@example.com');

    expect(result).toEqual({
      message:
        'Se o e-mail estiver cadastrado, enviaremos instrucoes de recuperacao em instantes.',
    });
    expect(result).not.toHaveProperty('resetToken');
    expect(passwordResetTokenRepository.createToken).not.toHaveBeenCalled();
  });

  it('stores only the password reset token hash', async () => {
    configValues.AUTH_RETURN_RESET_TOKEN = 'true';
    configValues.NODE_ENV = 'test';
    service = createService();
    usersService.findByEmail.mockResolvedValue({
      email: 'ana@example.com',
      id: 'user-1',
    } as never);
    passwordResetTokenRepository.createToken.mockResolvedValue({} as never);

    const result = await service.requestPasswordReset('ana@example.com');

    expect(result.resetToken).toEqual(expect.any(String));
    expect(passwordResetTokenRepository.createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) as string,
      }),
    );
    const storedToken =
      passwordResetTokenRepository.createToken.mock.calls[0][0].tokenHash;
    expect(storedToken).not.toBe(result.resetToken);
  });

  it('uses the configured password reset token ttl', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-11T12:00:00.000Z'));
    configValues.PASSWORD_RESET_TTL_MINUTES = '15';
    service = createService();
    usersService.findByEmail.mockResolvedValue({
      email: 'ana@example.com',
      id: 'user-1',
    } as never);
    passwordResetTokenRepository.createToken.mockResolvedValue({} as never);

    await service.requestPasswordReset('ana@example.com');

    expect(passwordResetTokenRepository.createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: new Date('2026-07-11T12:15:00.000Z'),
      }),
    );
    jest.useRealTimers();
  });

  it('fails fast when password reset token exposure is enabled outside test or development', () => {
    configValues.AUTH_RETURN_RESET_TOKEN = 'true';
    configValues.JWT_ACCESS_SECRET = 'access-secret-for-production-tests-123';
    configValues.JWT_REFRESH_SECRET = 'refresh-secret-for-production-tests-123';
    configValues.NODE_ENV = 'production';

    expect(() => createService()).toThrow(
      'AUTH_RETURN_RESET_TOKEN nao pode ser habilitado fora de development/test.',
    );
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

    const password = ' novaSenha123 ';
    const result = await service.resetPassword('user-1', password);

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
    expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
  });

  it('hashes a token-reset password exactly as received', async () => {
    const password = ' nova senha com espacos ';
    passwordResetTokenRepository.consumeAndResetPassword.mockResolvedValue(
      'user-1',
    );
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

    await service.resetPasswordWithToken('plain-token', password);

    expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
    expect(authSessionsService.revokeAllByUser).toHaveBeenCalledWith('user-1');
    expect(logsService.logAuthEvent).toHaveBeenCalledWith(
      expect.not.objectContaining({ password, senha: password }),
    );
  });

  it('does not wait for or expose password-reset delivery failures', async () => {
    usersService.findByEmail.mockResolvedValue({
      email: 'ana@example.com',
      id: 'user-1',
    } as never);
    passwordResetDeliveryService.deliver.mockRejectedValue(
      new Error('delivery failed'),
    );

    await expect(
      service.requestPasswordReset('ana@example.com'),
    ).resolves.toEqual({
      message:
        'Se o e-mail estiver cadastrado, enviaremos instrucoes de recuperacao em instantes.',
    });
    await Promise.resolve();
  });

  it('issues distinct refresh JWT IDs even in the same millisecond', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    jwtService.signAsync.mockImplementation((payload) =>
      Promise.resolve(JSON.stringify(payload)),
    );
    const refreshTokenBuilder = service as unknown as {
      buildRefreshToken(
        user: { id: string },
        sessionId: string,
      ): Promise<string>;
    };
    const user = { id: 'user-1' };

    const [first, second] = await Promise.all([
      refreshTokenBuilder.buildRefreshToken(user, 'session-1'),
      refreshTokenBuilder.buildRefreshToken(user, 'session-1'),
    ]);
    const firstPayload = JSON.parse(first) as { jti: string };
    const secondPayload = JSON.parse(second) as { jti: string };

    expect(firstPayload.jti).toEqual(expect.any(String));
    expect(secondPayload.jti).toEqual(expect.any(String));
    expect(firstPayload.jti).not.toBe(secondPayload.jti);
  });

  it('allows only one concurrent password-reset token consumption', async () => {
    passwordResetTokenRepository.consumeAndResetPassword
      .mockResolvedValueOnce('user-1')
      .mockResolvedValueOnce(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

    const results = await Promise.allSettled([
      service.resetPasswordWithToken('same-token', 'new-password'),
      service.resetPasswordWithToken('same-token', 'new-password'),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      passwordResetTokenRepository.consumeAndResetPassword,
    ).toHaveBeenCalledTimes(2);
  });

  it('allows only one concurrent refresh rotation', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sid: 'session-1',
      sub: 'user-1',
      tokenType: 'refresh',
    } as never);
    authSessionsService.findActiveById.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: 'session-1',
      userId: 'user-1',
    } as never);
    usersService.findById.mockResolvedValue({ id: 'user-1' } as never);
    jwtService.signAsync.mockImplementation((_payload, options) =>
      Promise.resolve(
        options?.secret === 'refresh-secret'
          ? 'next-refresh-token'
          : 'next-access-token',
      ),
    );
    jwtService.decode.mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    authSessionsService.rotateIfActiveWithMatchingToken
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const results = await Promise.allSettled([
      service.refreshSession('same-refresh-token'),
      service.refreshSession('same-refresh-token'),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      authSessionsService.rotateIfActiveWithMatchingToken,
    ).toHaveBeenCalledTimes(2);
    expect(authSessionsService.revoke).toHaveBeenCalledWith(
      'session-1',
      'user-1',
    );
  });
});
