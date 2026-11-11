import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppUnauthorizedException } from '../../common/exceptions';
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    error: unknown,
    user: TUser,
    info: { name?: string },
  ): TUser {
    if (error) throw error;
    if (!user) {
      if (info?.name === 'TokenExpiredError')
        throw new AppUnauthorizedException(
          'AUTH_ACCESS_TOKEN_EXPIRED',
          'Token de acesso expirado.',
        );
      throw new UnauthorizedException();
    }
    return user;
  }
}
