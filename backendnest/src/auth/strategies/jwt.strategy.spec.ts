import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthSessionsService } from '../auth-sessions.service';
import { JwtStrategy } from './jwt.strategy';
import { RequestContextService } from '../../logs/request-context.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authSessionsService: jest.Mocked<
    Pick<AuthSessionsService, 'findActiveById'>
  >;
  let requestContextService: jest.Mocked<
    Pick<RequestContextService, 'setUserId'>
  >;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string) =>
        key === 'JWT_ACCESS_SECRET' ? 'access-secret' : undefined,
      ),
      getOrThrow: jest.fn(() => 'legacy-secret'),
    };
    authSessionsService = {
      findActiveById: jest.fn(),
    };
    requestContextService = {
      setUserId: jest.fn(),
    };

    strategy = new JwtStrategy(
      configService as unknown as ConfigService,
      authSessionsService as unknown as AuthSessionsService,
      requestContextService as unknown as RequestContextService,
    );
  });

  it('rejects payloads without a session id', async () => {
    await expect(
      strategy.validate({} as never, {
        email: 'ana@example.com',
        nome: 'Ana',
        sub: 'user-1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(authSessionsService.findActiveById).not.toHaveBeenCalled();
  });

  it('rejects tokens whose session is missing', async () => {
    authSessionsService.findActiveById.mockResolvedValue(null);

    await expect(
      strategy.validate({} as never, {
        email: 'ana@example.com',
        nome: 'Ana',
        sid: 'session-1',
        sub: 'user-1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tokens whose session belongs to another user', async () => {
    authSessionsService.findActiveById.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: 'session-1',
      userId: 'user-2',
    } as never);

    await expect(
      strategy.validate({} as never, {
        email: 'ana@example.com',
        nome: 'Ana',
        sid: 'session-1',
        sub: 'user-1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tokens whose session is expired', async () => {
    authSessionsService.findActiveById.mockResolvedValue({
      expiresAt: new Date(Date.now() - 60_000),
      id: 'session-1',
      userId: 'user-1',
    } as never);

    await expect(
      strategy.validate({} as never, {
        email: 'ana@example.com',
        nome: 'Ana',
        sid: 'session-1',
        sub: 'user-1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a valid token and stores the user id in request context', async () => {
    authSessionsService.findActiveById.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: 'session-1',
      userId: 'user-1',
    } as never);

    const result = await strategy.validate({} as never, {
      email: 'ana@example.com',
      nome: 'Ana',
      sid: 'session-1',
      sub: 'user-1',
    });

    expect(result).toEqual({
      email: 'ana@example.com',
      id: 'user-1',
      nome: 'Ana',
      sid: 'session-1',
    });
    expect(requestContextService.setUserId).toHaveBeenCalledWith('user-1');
  });
});
