import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSessionsService } from './auth-sessions.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RequestContextService } from '../logs/request-context.service';
import { GlobalExceptionFilter } from '../logs/global-exception.filter';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { AppUnauthorizedException } from '../common/exceptions';
describe('session HTTP through real Passport guard', () => {
  let app: INestApplication;
  const sessions = { authorize: jest.fn() };
  const jwt = new JwtService();
  const state = {
    serverNow: '2026-10-10T00:00:00.000Z',
    idleExpiresAt: '2026-10-10T00:15:00.000Z',
    absoluteExpiresAt: '2026-10-10T12:00:00.000Z',
    policyVersion: 1,
  };
  const originalHandler = AuthController.prototype.currentSession;
  const handler = jest.spyOn(AuthController.prototype, 'currentSession');
  for (const key of Reflect.getMetadataKeys(originalHandler))
    Reflect.defineMetadata(
      key,
      Reflect.getMetadata(key, originalHandler),
      handler,
    );
  const token = (expiresIn: number, secret = 'test-access-secret') =>
    jwt.sign(
      { sub: 'owner', sid: 'session', tokenType: 'access' },
      { secret, issuer: 'meu-sistema-financeiro', expiresIn },
    );
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [AuthController],
      providers: [
        JwtStrategy,
        JwtAuthGuard,
        { provide: AuthService, useValue: {} },
        { provide: AuthSessionsService, useValue: sessions },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'JWT_ACCESS_SECRET' ? 'test-access-secret' : undefined,
          },
        },
        { provide: RequestContextService, useValue: { setUserId: jest.fn() } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(
      new GlobalExceptionFilter({
        logAccessDenied: jest.fn(),
        logInternalError: jest.fn(),
      } as never),
    );
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    sessions.authorize.mockResolvedValue(state);
  });
  afterAll(async () => {
    await app.close();
    handler.mockRestore();
  });
  it('returns no-touch current authority, owner from JWT and no-store metadata', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/session?userId=other')
      .set('Authorization', `Bearer ${token(60)}`)
      .expect(200);
    expect(sessions.authorize).toHaveBeenCalledWith('session', 'owner', false);
    expect(response.body.data).toEqual(state);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(JSON.parse(response.headers['x-session-state'])).toEqual(state);
  });
  it('identifies expired access before strategy lookup and before handler', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/session')
      .set('Authorization', `Bearer ${token(-1)}`)
      .expect(401);
    expect(response.body.error.code).toBe('AUTH_ACCESS_TOKEN_EXPIRED');
    expect(handler).not.toHaveBeenCalled();
    expect(sessions.authorize).not.toHaveBeenCalled();
  });
  it('invalid signatures remain ordinary 401 without handler effects', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/session')
      .set('Authorization', `Bearer ${token(60, 'wrong-key')}`)
      .expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(handler).not.toHaveBeenCalled();
  });
  it('preserves terminal idle and transient authority failures without handler effects', async () => {
    sessions.authorize.mockRejectedValueOnce(
      new AppUnauthorizedException(
        'AUTH_SESSION_IDLE_EXPIRED',
        'Sessao encerrada.',
      ),
    );
    const expired = await request(app.getHttpServer())
      .get('/auth/session')
      .set('Authorization', `Bearer ${token(60)}`)
      .expect(401);
    expect(expired.body.error.code).toBe('AUTH_SESSION_IDLE_EXPIRED');
    sessions.authorize.mockRejectedValueOnce(
      new Error('private database details'),
    );
    const unavailable = await request(app.getHttpServer())
      .get('/auth/session')
      .set('Authorization', `Bearer ${token(60)}`)
      .expect(500);
    expect(unavailable.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(JSON.stringify(unavailable.body)).not.toContain('private');
    expect(handler).not.toHaveBeenCalled();
  });
});
