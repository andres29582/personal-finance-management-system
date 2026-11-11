import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { configureCors } from '../config/http-runtime.config';
describe('JWT deadline cap with real signing', () => {
  const jwt = new JwtService({
    secret: 'local-access-key',
    signOptions: { algorithm: 'HS256', expiresIn: '15m' },
  });
  const config = {
    get: (key: string) =>
      (
        ({
          NODE_ENV: 'test',
          JWT_ACCESS_SECRET: 'local-access-key',
          JWT_REFRESH_SECRET: 'local-refresh-key',
        }) as Record<string, string>
      )[key],
  };
  const auth = new AuthService(
    {} as never,
    jwt,
    {} as never,
    {} as never,
    config as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const builders = auth as unknown as {
    buildAccessToken: (
      user: any,
      sid: string,
      now: Date,
      absolute: Date,
    ) => Promise<string>;
    buildRefreshToken: (
      user: any,
      sid: string,
      now: Date,
      absolute: Date,
    ) => Promise<string>;
  };
  const now = new Date('2026-10-10T12:00:00.123Z');
  const deadline = new Date('2026-10-10T12:01:00.999Z');
  it.each(['buildAccessToken', 'buildRefreshToken'] as const)(
    'caps %s to server absolute with conservative second rounding',
    async (builder) => {
      const token = await builders[builder](
        { id: 'user', email: 'a@example.com', nome: 'A' },
        'sid',
        now,
        deadline,
      );
      const payload = jwt.decode(token) as {
        exp: number;
        iat: number;
        sub: string;
        sid: string;
        tokenType: string;
      };
      expect(payload.exp).toBe(Math.floor(deadline.getTime() / 1000));
      expect(payload.exp * 1000).toBeLessThanOrEqual(deadline.getTime());
      expect(payload.iat).toBe(Math.floor(now.getTime() / 1000));
      expect(payload).toMatchObject({
        sub: 'user',
        sid: 'sid',
        tokenType: builder === 'buildAccessToken' ? 'access' : 'refresh',
      });
      await expect(
        jwt.verifyAsync(token, {
          secret:
            builder === 'buildAccessToken'
              ? 'local-access-key'
              : 'local-refresh-key',
          algorithms: ['HS256'],
          clockTimestamp: Math.floor(now.getTime() / 1000),
        }),
      ).resolves.toMatchObject(payload);
    },
  );
  it('caps the configured 30-day refresh TTL to the 12-hour absolute deadline', async () => {
    const absolute = new Date(now.getTime() + 43200000);
    const token = await builders.buildRefreshToken(
      { id: 'user' },
      'sid',
      now,
      absolute,
    );
    const payload = jwt.decode(token) as { exp: number; iat: number };
    expect(payload.iat).toBe(Math.floor(now.getTime() / 1000));
    expect(payload.exp).toBe(Math.floor(absolute.getTime() / 1000));
    expect(payload.exp - payload.iat).toBe(43200);
    expect(payload.exp * 1000).toBeLessThanOrEqual(absolute.getTime());
  });
  it.each(['buildAccessToken', 'buildRefreshToken'] as const)(
    'rejects %s at equality and past deadlines',
    async (builder) => {
      for (const absolute of [now, new Date(now.getTime() - 1000)]) {
        await expect(
          builders[builder]({ id: 'user' }, 'sid', now, absolute),
        ).rejects.toMatchObject({ code: 'AUTH_INVALID_SESSION' });
      }
    },
  );
  it('keeps a shorter configured access TTL and refuses a rounded-away lifetime', async () => {
    const token = await builders.buildAccessToken(
      { id: 'user' },
      'sid',
      now,
      new Date(now.getTime() + 43200000),
    );
    expect((jwt.decode(token) as { exp: number }).exp).toBe(
      Math.floor(now.getTime() / 1000) + 900,
    );
    await expect(
      builders.buildAccessToken(
        { id: 'user' },
        'sid',
        now,
        new Date(now.getTime() + 1),
      ),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID_SESSION' });
  });
  it('exposes only non-secret session metadata without widening CORS origins', () => {
    const app = { enableCors: jest.fn((_value: any) => {}) };
    configureCors(
      app as never,
      { allowedOrigins: ['https://allowed.example'] } as never,
    );
    const cors = app.enableCors.mock.calls[0][0];
    expect(cors.exposedHeaders).toEqual(['X-Session-State']);
    const result = jest.fn();
    cors.origin('https://other.example', result);
    expect(result).toHaveBeenCalledWith(null, false);
  });
});
