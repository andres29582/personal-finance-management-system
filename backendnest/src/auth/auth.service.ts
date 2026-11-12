import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { AuthRegistrationRepository } from './repositories/auth-registration.repository';
import {
  isValidCep,
  isValidCpf,
  normalizeDigits,
} from '../common/br-documents.util';
import {
  AppConflictException,
  AppUnauthorizedException,
  BusinessRuleException,
  ValidationAppException,
} from '../common/exceptions';
import { LogsService } from '../logs/logs.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthSessionsService } from './auth-sessions.service';
import { PasswordResetDeliveryService } from './password-reset-delivery.service';
import {
  AuthTokenConfig,
  resolveAuthTokenConfig,
} from './config/auth-token.config';
import {
  PasswordResetConfig,
  resolvePasswordResetConfig,
} from './config/password-reset.config';
import {
  resolveSessionPolicy,
  SessionPolicy,
  cappedExpiration,
  rejectSession,
} from './session-policy';
import { RegisterDto } from './dto/register.dto';
import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
import {
  SessionListQueryDto,
  decodeSessionCursor,
} from './dto/session-management.dto';

type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

type JwtExpirationPayload = {
  exp: number;
};

@Injectable()
export class AuthService {
  private readonly tokenConfig: AuthTokenConfig;
  private readonly sessionPolicy: SessionPolicy;
  private readonly passwordResetConfig: PasswordResetConfig;

  async listOwnSessions(
    userId: string,
    callerId: string,
    query: SessionListQueryDto,
  ) {
    return this.authSessionsService.listOwnSessions(userId, callerId, {
      limit: query.limit,
      cursor: decodeSessionCursor(query.cursor),
    });
  }
  async revokeOwnSessions(
    userId: string,
    callerId: string,
    senhaAtual: string,
    targetId?: string,
  ): Promise<void> {
    const expectedHash =
      await this.authSessionsService.reserveSessionReauthentication(
        userId,
        callerId,
      );
    if (!(await bcrypt.compare(senhaAtual, expectedHash)))
      throw new BusinessRuleException(
        'AUTH_CURRENT_PASSWORD_INVALID',
        'Senha atual incorreta.',
        { field: 'senhaAtual' },
      );
    await this.authSessionsService.revokeOwnSessions(
      userId,
      callerId,
      expectedHash,
      targetId,
    );
  }

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly registrationRepository: AuthRegistrationRepository,
    private readonly authSessionsService: AuthSessionsService,
    private readonly configService: ConfigService,
    private readonly logsService: LogsService,
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    private readonly passwordResetDeliveryService: PasswordResetDeliveryService,
  ) {
    this.tokenConfig = resolveAuthTokenConfig(configService);
    this.sessionPolicy = resolveSessionPolicy(configService);
    this.passwordResetConfig = resolvePasswordResetConfig(configService);
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedCpf = normalizeDigits(dto.cpf);
    const normalizedCep = normalizeDigits(dto.cep);
    const nome = dto.nome.trim();
    const email = normalizedEmail;
    const senha = dto.senha;

    if (!isValidCpf(normalizedCpf)) {
      throw new ValidationAppException(
        'AUTH_INVALID_CPF',
        'CPF deve ter 11 digitos.',
        { field: 'cpf' },
      );
    }

    if (!isValidCep(normalizedCep)) {
      throw new ValidationAppException('AUTH_INVALID_CEP', 'CEP invalido.', {
        field: 'cep',
      });
    }

    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new AppConflictException(
        'AUTH_EMAIL_ALREADY_EXISTS',
        'E-mail ja cadastrado',
        { field: 'email' },
      );
    }

    const existingByCpf = await this.usersService.findByCpf(normalizedCpf);
    if (existingByCpf) {
      throw new AppConflictException(
        'AUTH_CPF_ALREADY_EXISTS',
        'CPF ja cadastrado',
        { field: 'cpf' },
      );
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const consentimentoEm = new Date();
    const user = await this.registrationRepository.createWithDefaultCategories({
      id: randomUUID(),
      nome,
      email,
      cpf: normalizedCpf,
      cep: normalizedCep,
      endereco: dto.endereco.trim(),
      numero: dto.numero.trim(),
      cidade: dto.cidade.trim(),
      senhaHash,
      lgpdConsentimentoEm: consentimentoEm,
    });

    return {
      usuario: this.toPublicUser(user),
    };
  }

  async signIn(email: string, senha: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      await this.logsService.logAuthEvent({
        event: 'LOGIN_FAILED',
        level: 'warn',
        success: false,
        message: 'Falha ao autenticar usuario.',
        details: {
          email: normalizedEmail,
          reason: 'invalid_credentials',
        },
      });
      throw new AppUnauthorizedException(
        'AUTH_INVALID_CREDENTIALS',
        'E-mail ou senha invalidos',
      );
    }

    const senhaCorreta = await bcrypt.compare(senha, user.senhaHash);

    if (!senhaCorreta) {
      await this.logsService.logAuthEvent({
        event: 'LOGIN_FAILED',
        level: 'warn',
        success: false,
        userId: user.id,
        message: 'Falha ao autenticar usuario.',
        details: {
          email: normalizedEmail,
          reason: 'invalid_credentials',
        },
      });
      throw new AppUnauthorizedException(
        'AUTH_INVALID_CREDENTIALS',
        'E-mail ou senha invalidos',
      );
    }

    const tokens = await this.createTokensForUser(user);

    await this.logsService.logAuthEvent({
      event: 'LOGIN_SUCCESS',
      level: 'info',
      userId: user.id,
      message: 'Login realizado com sucesso.',
      details: {
        email: user.email,
      },
    });

    return {
      ...tokens,
      usuario: this.toPublicUser(user),
    };
  }

  async refreshSession(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.usersService.findById(payload.sub);
    if (!user) rejectSession('AUTH_INVALID_SESSION');
    const result =
      await this.authSessionsService.rotateIfActiveWithMatchingToken(
        payload.sid,
        payload.sub,
        refreshToken,
        (now, absolute) =>
          this.issueSessionTokens(user, payload.sid, now, absolute),
      );
    if ('failure' in result) {
      if (result.reuse)
        await this.logsService.logAuthEvent({
          event: 'REFRESH_TOKEN_REUSE_DETECTED',
          level: 'warn',
          success: false,
          userId: user.id,
          message: 'Reutilizacao de refresh token detectada; sessao revogada.',
          details: { sessionId: payload.sid },
        });
      if (result.failure === 'AUTH_INVALID_REFRESH_TOKEN')
        throw new AppUnauthorizedException(
          result.failure,
          'Refresh token invalido',
        );
      rejectSession(result.failure);
    }
    return {
      access_token: result.tokens.access_token,
      refresh_token: result.tokens.refresh_token,
    };
  }

  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      await this.authSessionsService.revoke(sessionId, userId);
    }

    await this.logsService.logAuthEvent({
      event: 'LOGOUT_SUCCESS',
      level: 'info',
      userId,
      message: 'Sessao encerrada com sucesso.',
      details: {
        sessionId: sessionId ?? null,
      },
    });

    return {
      message: 'Sessao encerrada com sucesso',
    };
  }

  async resetPassword(
    userId: string,
    novaSenha: string,
    senhaAtual: string,
    sessionId: string,
  ) {
    const user = await this.usersService.findById(userId);

    if (!user || !sessionId) {
      throw new AppUnauthorizedException(
        'AUTH_INVALID_SESSION',
        'Sessao invalida',
      );
    }

    if (!senhaAtual || !(await bcrypt.compare(senhaAtual, user.senhaHash))) {
      throw new BusinessRuleException(
        'AUTH_CURRENT_PASSWORD_INVALID',
        'Senha atual incorreta.',
        { field: 'senhaAtual' },
      );
    }
    const newPasswordHash = await bcrypt.hash(novaSenha, 10);
    await this.passwordResetTokenRepository.changeAuthenticatedPassword(
      user.id,
      sessionId,
      user.senhaHash,
      newPasswordHash,
    );
    await this.logsService.logAuthEvent({
      event: 'PASSWORD_RESET_SUCCESS',
      level: 'info',
      action: 'reset_password',
      userId: user.id,
      message: 'Senha atualizada com sucesso.',
    });

    return {
      message: 'Senha atualizada com sucesso',
    };
  }

  /**
   * Fluxo público de recuperação: gera token de uso único (hash persistido).
   * Com AUTH_RETURN_RESET_TOKEN=true o token plano é devolvido no JSON (apenas desenvolvimento).
   */
  async requestPasswordReset(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);
    const genericMessage =
      'Se o e-mail estiver cadastrado, enviaremos instrucoes de recuperacao em instantes.';

    if (!user) {
      await this.logsService.logAuthEvent({
        event: 'PASSWORD_RESET_REQUEST_UNKNOWN_EMAIL',
        level: 'info',
        success: true,
        message: 'Pedido de recuperacao para e-mail nao cadastrado.',
        details: { email: normalizedEmail },
      });

      return { message: genericMessage };
    }

    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');
    const createdToken = await this.passwordResetTokenRepository.createToken(
      {
        id: randomUUID(),
        userId: user.id,
        tokenHash,
        usedAt: null,
      },
      user.senhaHash,
      this.passwordResetConfig.ttlMinutes,
    );
    if (!createdToken) return { message: genericMessage };
    void Promise.resolve()
      .then(() =>
        this.passwordResetDeliveryService.deliver({
          email: user.email,
          expiresAt: createdToken.expiresAt,
          resetToken: plainToken,
        }),
      )
      .catch(() => undefined);
    await this.logsService.logAuthEvent({
      event: 'PASSWORD_RESET_REQUESTED',
      level: 'info',
      userId: user.id,
      message: 'Token de recuperacao de senha emitido.',
      details: { email: user.email },
    });

    return {
      message: genericMessage,
      ...(this.passwordResetConfig.returnResetToken
        ? { resetToken: plainToken }
        : {}),
    };
  }
  async resetPasswordWithToken(plainToken: string, novaSenha: string) {
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');
    const newPasswordHash = await bcrypt.hash(novaSenha, 10);
    const userId =
      await this.passwordResetTokenRepository.consumeAndResetPassword(
        tokenHash,
        newPasswordHash,
        new Date(),
      );

    if (!userId) {
      await this.logsService.logAuthEvent({
        event: 'PASSWORD_RESET_TOKEN_INVALID',
        level: 'warn',
        success: false,
        message: 'Token de recuperacao invalido ou expirado.',
      });
      throw new BusinessRuleException(
        'AUTH_PASSWORD_RESET_TOKEN_INVALID',
        'Token invalido ou expirado.',
      );
    }

    await this.logsService.logAuthEvent({
      event: 'PASSWORD_RESET_TOKEN_SUCCESS',
      level: 'info',
      action: 'reset_password',
      userId,
      message: 'Senha redefinida via token de recuperacao.',
    });

    return {
      message: 'Senha atualizada com sucesso. Faca login com a nova senha.',
    };
  }
  private async createTokensForUser(user: User): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const issued = await this.authSessionsService.create({
      id: sessionId,
      userId: user.id,
      expectedPasswordHash: user.senhaHash,
      maxActiveSessions: this.tokenConfig.maxActiveSessions,
      policy: this.sessionPolicy,
      issue: (now, absolute) =>
        this.issueSessionTokens(user, sessionId, now, absolute),
    });
    return {
      access_token: issued.access_token,
      refresh_token: issued.refresh_token,
    };
  }

  private async issueSessionTokens(
    user: User,
    sessionId: string,
    now: Date,
    absolute: Date,
  ) {
    const refreshToken = await this.buildRefreshToken(
      user,
      sessionId,
      now,
      absolute,
    );
    const accessToken = await this.buildAccessToken(
      user,
      sessionId,
      now,
      absolute,
    );
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      refreshTokenHash: createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt: this.getTokenExpiration(refreshToken),
    };
  }

  private async buildAccessToken(
    user: User,
    sessionId: string,
    now?: Date,
    absolute?: Date,
  ) {
    return this.signCappedToken(
      {
        sub: user.id,
        email: user.email,
        nome: user.nome,
        sid: sessionId,
        tokenType: 'access',
        ...(now ? { iat: Math.floor(now.getTime() / 1000) } : {}),
      },
      {
        algorithm: this.tokenConfig.algorithm,
        secret: this.tokenConfig.accessSecret,
        expiresIn: this.tokenConfig.accessExpiresIn as never,
        issuer: this.tokenConfig.issuer,
      },
      absolute,
      now,
    );
  }

  private async buildRefreshToken(
    user: User,
    sessionId: string,
    now?: Date,
    absolute?: Date,
  ) {
    return this.signCappedToken(
      {
        sub: user.id,
        sid: sessionId,
        jti: randomUUID(),
        tokenType: 'refresh',
        ...(now ? { iat: Math.floor(now.getTime() / 1000) } : {}),
      },
      {
        algorithm: this.tokenConfig.algorithm,
        secret: this.tokenConfig.refreshSecret,
        expiresIn: this.tokenConfig.refreshExpiresIn as never,
        issuer: this.tokenConfig.issuer,
      },
      absolute,
      now,
    );
  }

  private async signCappedToken(
    payload: Record<string, unknown>,
    options: Parameters<JwtService['signAsync']>[1],
    absolute?: Date,
    now?: Date,
  ) {
    const token = await this.jwtService.signAsync(payload, options);
    if (!absolute || !now) return token;
    const expiration = this.getTokenExpiration(token).getTime() / 1000;
    const exp = cappedExpiration(expiration, absolute);
    if (exp * 1000 <= now.getTime()) rejectSession('AUTH_INVALID_SESSION');
    if (exp === expiration) return token;
    return this.jwtService.signAsync(payload, {
      ...options,
      expiresIn: exp - Math.floor(now.getTime() / 1000),
    });
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sid: string;
        sub: string;
        tokenType?: string;
      }>(refreshToken, {
        algorithms: [this.tokenConfig.algorithm],
        ignoreExpiration: false,
        issuer: this.tokenConfig.issuer,
        secret: this.tokenConfig.refreshSecret,
      });

      if (!payload.sid || !payload.sub || payload.tokenType !== 'refresh') {
        throw new Error('Invalid refresh token payload.');
      }

      return payload;
    } catch {
      throw new AppUnauthorizedException(
        'AUTH_INVALID_REFRESH_TOKEN',
        'Refresh token invalido',
      );
    }
  }

  private getTokenExpiration(token: string) {
    const decoded: unknown = this.jwtService.decode(token);

    if (!this.hasExpiration(decoded)) {
      throw new AppUnauthorizedException(
        'AUTH_TOKEN_INVALID',
        'Token invalido',
      );
    }

    return new Date(decoded.exp * 1000);
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      cpf: user.cpf,
      cep: user.cep,
      endereco: user.endereco,
      numero: user.numero,
      cidade: user.cidade,
      moedaPadrao: user.moedaPadrao,
    };
  }

  private hasExpiration(value: unknown): value is JwtExpirationPayload {
    return (
      typeof value === 'object' &&
      value !== null &&
      'exp' in value &&
      typeof value.exp === 'number'
    );
  }
}
