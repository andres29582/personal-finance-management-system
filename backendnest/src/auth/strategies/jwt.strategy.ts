import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AppUnauthorizedException } from '../../common/exceptions';
import { RequestContextService } from '../../logs/request-context.service';
import { AuthSessionsService } from '../auth-sessions.service';
import { resolveAuthTokenConfig } from '../config/auth-token.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authSessionsService: AuthSessionsService,
    private readonly requestContextService: RequestContextService,
  ) {
    const tokenConfig = resolveAuthTokenConfig(configService);

    super({
      passReqToCallback: true,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: [tokenConfig.algorithm],
      issuer: tokenConfig.issuer,
      secretOrKey: tokenConfig.accessSecret,
    });
  }

  async validate(
    _req: Request,
    payload: {
      sub: string;
      email: string;
      nome: string;
      sid?: string;
      tokenType?: string;
    },
  ) {
    if (!payload.sid || payload.tokenType !== 'access') {
      throw new AppUnauthorizedException(
        'AUTH_INVALID_SESSION',
        'Sessao invalida',
      );
    }

    const session = await this.authSessionsService.findActiveById(payload.sid);

    if (
      !session ||
      session.userId !== payload.sub ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new AppUnauthorizedException(
        'AUTH_INVALID_SESSION',
        'Sessao invalida',
      );
    }

    await this.authSessionsService.touchIfActive(session.id);
    this.requestContextService.setUserId(payload.sub);

    return {
      id: payload.sub,
      email: payload.email,
      nome: payload.nome,
      sid: payload.sid,
    };
  }
}
