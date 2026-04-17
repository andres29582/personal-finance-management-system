import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { CategoriasService } from '../categorias/categorias.service';
import {
  isValidCep,
  isValidCpf,
  normalizeDigits,
} from '../common/br-documents.util';
import { LogsService } from '../logs/logs.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthSessionsService } from './auth-sessions.service';
import { RegisterDto } from './dto/register.dto';

type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

type JwtExpirationPayload = {
  exp: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly categoriasService: CategoriasService,
    private readonly authSessionsService: AuthSessionsService,
    private readonly configService: ConfigService,
    private readonly logsService: LogsService,
  ) {}

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedCpf = normalizeDigits(dto.cpf);
    const normalizedCep = normalizeDigits(dto.cep);
    const nome = dto.nome.trim();
    const email = normalizedEmail;
    const senha = dto.senha;

    if (!isValidCpf(normalizedCpf)) {
      throw new BadRequestException('CPF deve ter 11 digitos.');
    }

    if (!isValidCep(normalizedCep)) {
      throw new BadRequestException('CEP invalido.');
    }

    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('E-mail ja cadastrado');
    }

    const existingByCpf = await this.usersService.findByCpf(normalizedCpf);
    if (existingByCpf) {
      throw new ConflictException('CPF ja cadastrado');
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const user = await this.usersService.create({
      id: randomUUID(),
      nome,
      email,
      cpf: normalizedCpf,
      cep: normalizedCep,
      endereco: dto.endereco.trim(),
      numero: dto.numero.trim(),
      cidade: dto.cidade.trim(),
      senhaHash,
    });

    await this.categoriasService.seedDefaultCategories(user.id);

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
      throw new UnauthorizedException('E-mail ou senha invalidos');
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
      throw new UnauthorizedException('E-mail ou senha invalidos');
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
    const session = await this.authSessionsService.findActiveById(payload.sid);

    if (
      !session ||
      session.userId !== payload.sub ||
      session.expiresAt.getTime() <= Date.now() ||
      !this.authSessionsService.hasMatchingRefreshToken(session, refreshToken)
    ) {
      if (session) {
        await this.authSessionsService.revoke(session.id, session.userId);
      }

      throw new UnauthorizedException('Refresh token invalido');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Sessao invalida');
    }

    const nextRefreshToken = await this.buildRefreshToken(user, session.id);
    await this.authSessionsService.rotate(
      session.id,
      nextRefreshToken,
      this.getTokenExpiration(nextRefreshToken),
    );

    return {
      access_token: await this.buildAccessToken(user, session.id),
      refresh_token: nextRefreshToken,
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

  async resetPassword(userId: string, novaSenha: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    const newPasswordHash = await bcrypt.hash(novaSenha, 10);

    await this.usersService.updatePassword(user.id, newPasswordHash);
    await this.authSessionsService.revokeAllByUser(user.id);
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

  private async createTokensForUser(user: User): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const refreshToken = await this.buildRefreshToken(user, sessionId);

    await this.authSessionsService.create({
      id: sessionId,
      userId: user.id,
      refreshToken,
      expiresAt: this.getTokenExpiration(refreshToken),
    });

    return {
      access_token: await this.buildAccessToken(user, sessionId),
      refresh_token: refreshToken,
    };
  }

  private async buildAccessToken(user: User, sessionId: string) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        nome: user.nome,
        sid: sessionId,
      },
      {
        secret: this.getAccessTokenSecret(),
        expiresIn: this.getAccessTokenExpiresIn() as never,
      },
    );
  }

  private async buildRefreshToken(user: User, sessionId: string) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        sid: sessionId,
      },
      {
        secret: this.getRefreshTokenSecret(),
        expiresIn: this.getRefreshTokenExpiresIn() as never,
      },
    );
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      return await this.jwtService.verifyAsync<{
        sid: string;
        sub: string;
      }>(refreshToken, {
        secret: this.getRefreshTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalido');
    }
  }

  private getTokenExpiration(token: string) {
    const decoded: unknown = this.jwtService.decode(token);

    if (!this.hasExpiration(decoded)) {
      throw new UnauthorizedException('Token invalido');
    }

    return new Date(decoded.exp * 1000);
  }

  private getAccessTokenSecret() {
    return (
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      'troque_esta_chave_de_acesso'
    );
  }

  private getAccessTokenExpiresIn() {
    return this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
  }

  private getRefreshTokenSecret() {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      `${this.getAccessTokenSecret()}_refresh`
    );
  }

  private getRefreshTokenExpiresIn() {
    return this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';
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
