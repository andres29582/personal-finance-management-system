import { ConfigService } from '@nestjs/config';
import { resolveAuthTokenConfig } from './auth-token.config';

describe('resolveAuthTokenConfig', () => {
  const strongAccessSecret = 'access-secret-with-at-least-32-chars';
  const strongRefreshSecret = 'refresh-secret-with-at-least-32-chars';

  function config(values: Record<string, string | undefined>) {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }

  it('accepts strong and distinct secrets in production', () => {
    const result = resolveAuthTokenConfig(
      config({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: strongAccessSecret,
        JWT_REFRESH_SECRET: strongRefreshSecret,
      }),
    );

    expect(result).toEqual({
      accessSecret: strongAccessSecret,
      refreshSecret: strongRefreshSecret,
      accessExpiresIn: '15m',
      refreshExpiresIn: '30d',
    });
  });

  it('applies production rules in demo', () => {
    const result = resolveAuthTokenConfig(
      config({
        NODE_ENV: ' demo ',
        JWT_ACCESS_SECRET: strongAccessSecret,
        JWT_REFRESH_SECRET: strongRefreshSecret,
      }),
    );

    expect(result.accessSecret).toBe(strongAccessSecret);
    expect(result.refreshSecret).toBe(strongRefreshSecret);
  });

  it('rejects missing access secret in production', () => {
    expect(() =>
      resolveAuthTokenConfig(
        config({
          NODE_ENV: 'production',
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      ),
    ).toThrow('JWT_ACCESS_SECRET is required');
  });

  it('rejects missing refresh secret in production', () => {
    expect(() =>
      resolveAuthTokenConfig(
        config({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: strongAccessSecret,
        }),
      ),
    ).toThrow('JWT_REFRESH_SECRET is required');
  });

  it('rejects short secrets in production', () => {
    expect(() =>
      resolveAuthTokenConfig(
        config({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'short-secret',
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      ),
    ).toThrow('JWT_ACCESS_SECRET must have at least 32 characters');
  });

  it('rejects equal explicit secrets', () => {
    expect(() =>
      resolveAuthTokenConfig(
        config({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongAccessSecret,
        }),
      ),
    ).toThrow('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  });

  it('rejects predictable placeholders in production', () => {
    expect(() =>
      resolveAuthTokenConfig(
        config({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'troque_esta_chave_com_mais_de_32_chars',
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      ),
    ).toThrow('JWT_ACCESS_SECRET must not use a predictable placeholder value');
  });

  it('does not accept only the legacy secret in production', () => {
    expect(() =>
      resolveAuthTokenConfig(
        config({
          NODE_ENV: 'production',
          JWT_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      ),
    ).toThrow('JWT_ACCESS_SECRET is required');
  });

  it('prefers JWT_ACCESS_SECRET in development', () => {
    const result = resolveAuthTokenConfig(
      config({
        NODE_ENV: 'development',
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_SECRET: 'legacy-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
      }),
    );

    expect(result.accessSecret).toBe('access-secret');
  });

  it('accepts JWT_SECRET as a legacy fallback in development', () => {
    const result = resolveAuthTokenConfig(
      config({
        NODE_ENV: 'development',
        JWT_SECRET: 'legacy-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
      }),
    );

    expect(result.accessSecret).toBe('legacy-secret');
  });

  it('fails in development when no access secret exists', () => {
    expect(() =>
      resolveAuthTokenConfig(
        config({
          NODE_ENV: 'development',
          JWT_REFRESH_SECRET: 'refresh-secret',
        }),
      ),
    ).toThrow('JWT_ACCESS_SECRET is required');
  });

  it('prefers an explicit refresh secret in development', () => {
    const result = resolveAuthTokenConfig(
      config({
        NODE_ENV: 'development',
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
      }),
    );

    expect(result.refreshSecret).toBe('refresh-secret');
  });

  it('keeps derived refresh secret compatibility in test', () => {
    const result = resolveAuthTokenConfig(
      config({
        NODE_ENV: 'test',
        JWT_ACCESS_SECRET: 'access-secret',
      }),
    );

    expect(result.refreshSecret).toBe('access-secret_refresh');
  });

  it('does not include received secrets in error messages', () => {
    const secret = 'troque_super_sensitive_secret_value_32_chars';

    try {
      resolveAuthTokenConfig(
        config({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: secret,
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      );
      throw new Error('Expected config resolution to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it('uses expiration values from environment variables', () => {
    const result = resolveAuthTokenConfig(
      config({
        NODE_ENV: 'development',
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
        JWT_ACCESS_EXPIRES_IN: '5m',
        JWT_REFRESH_EXPIRES_IN: '7d',
      }),
    );

    expect(result.accessExpiresIn).toBe('5m');
    expect(result.refreshExpiresIn).toBe('7d');
  });

  it('keeps default expirations when variables are absent', () => {
    const result = resolveAuthTokenConfig(
      config({
        NODE_ENV: 'development',
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
      }),
    );

    expect(result.accessExpiresIn).toBe('15m');
    expect(result.refreshExpiresIn).toBe('30d');
  });
});
