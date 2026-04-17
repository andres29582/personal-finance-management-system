import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { RequestContextService } from '../../logs/request-context.service';
import { AuthSessionsService } from '../auth-sessions.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authSessionsService: AuthSessionsService,
    private readonly requestContextService: RequestContextService,
  ) {
    super({
      passReqToCallback: true,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_ACCESS_SECRET') ??
        configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(
    _req: Request,
    payload: {
      sub: string;
      email: string;
      nome: string;
      sid?: string;
    },
  ) {
    if (!payload.sid) {
      throw new UnauthorizedException('Sessao invalida');
    }

    const session = await this.authSessionsService.findActiveById(payload.sid);

    if (
      !session ||
      session.userId !== payload.sub ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Sessao invalida');
    }

    this.requestContextService.setUserId(payload.sub);

    return {
      id: payload.sub,
      email: payload.email,
      nome: payload.nome,
      sid: payload.sid,
    };
  }
}
