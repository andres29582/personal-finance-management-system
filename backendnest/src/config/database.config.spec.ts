import { resolveDatabaseConfig } from './database.config';

const validPem = [
  '-----BEGIN CERTIFICATE-----',
  'synthetic-test-certificate',
  '-----END CERTIFICATE-----',
].join('\n');

function config(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    NODE_ENV: 'development',
    DB_HOST: ' localhost ',
    DB_USERNAME: ' postgres ',
    DB_PASSWORD: 'postgres',
    DB_NAME: ' gestao_financeira ',
    DB_SSL_MODE: 'disable',
    ...overrides,
  };

  return {
    get: <T>(key: string): T | undefined => values[key] as T | undefined,
  };
}

describe('resolveDatabaseConfig', () => {
  it.each(['development', 'test'])(
    '%s accepts a local configuration with TLS disabled',
    (environment) => {
      expect(resolveDatabaseConfig(config({ NODE_ENV: environment })).ssl).toBe(
        false,
      );
    },
  );

  it('uses port 5432 when DB_PORT is absent', () => {
    expect(resolveDatabaseConfig(config({ DB_PORT: undefined })).port).toBe(
      5432,
    );
  });

  it('respects a configured valid port', () => {
    expect(resolveDatabaseConfig(config({ DB_PORT: ' 6543 ' })).port).toBe(
      6543,
    );
  });

  it.each(['abc', '1.5', '0', '65536'])('rejects invalid port %s', (port) => {
    expect(() => resolveDatabaseConfig(config({ DB_PORT: port }))).toThrow(
      'DB_PORT',
    );
  });

  it.each(['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME'])(
    'rejects missing or blank %s',
    (key) => {
      expect(() => resolveDatabaseConfig(config({ [key]: '   ' }))).toThrow(
        key,
      );
    },
  );

  it('rejects an unknown SSL mode', () => {
    expect(() =>
      resolveDatabaseConfig(config({ DB_SSL_MODE: 'require' })),
    ).toThrow('DB_SSL_MODE');
  });

  it('allows verify-full in development', () => {
    expect(
      resolveDatabaseConfig(config({ DB_SSL_MODE: ' verify-full ' })).ssl,
    ).toEqual({ rejectUnauthorized: true });
  });

  it.each(['production', 'demo', 'staging', ''])(
    '%s rejects disabled TLS',
    (environment) => {
      expect(() =>
        resolveDatabaseConfig(
          config({
            NODE_ENV: environment,
            DB_PASSWORD: 'a-secure-password',
          }),
        ),
      ).toThrow('verify-full');
    },
  );

  it('accepts verify-full in production and verifies certificates', () => {
    const resolved = resolveDatabaseConfig(
      config({
        NODE_ENV: ' ProDucTion ',
        DB_SSL_MODE: 'verify-full',
        DB_PASSWORD: 'a-secure-password',
      }),
    );

    expect(resolved.ssl).toEqual({ rejectUnauthorized: true });
    expect(JSON.stringify(resolved.ssl)).not.toContain('false');
  });

  it('uses the default trust store when the CA is absent', () => {
    expect(
      resolveDatabaseConfig(config({ DB_SSL_MODE: 'verify-full' })).ssl,
    ).toEqual({ rejectUnauthorized: true });
  });

  it('decodes a valid Base64 PEM CA', () => {
    expect(
      resolveDatabaseConfig(
        config({
          DB_SSL_MODE: 'verify-full',
          DB_SSL_CA_BASE64: Buffer.from(validPem).toString('base64'),
        }),
      ).ssl,
    ).toEqual({ rejectUnauthorized: true, ca: validPem });
  });

  it.each([
    ['invalid Base64', 'not-base64!'],
    [
      'PEM without delimiters',
      Buffer.from('not a certificate').toString('base64'),
    ],
  ])('rejects %s without exposing its value', (_label, caValue) => {
    expect(() =>
      resolveDatabaseConfig(
        config({ DB_SSL_MODE: 'verify-full', DB_SSL_CA_BASE64: caValue }),
      ),
    ).toThrow();

    try {
      resolveDatabaseConfig(
        config({ DB_SSL_MODE: 'verify-full', DB_SSL_CA_BASE64: caValue }),
      );
    } catch (error) {
      expect((error as Error).message).not.toContain(caValue);
    }
  });

  it('rejects a configured CA when TLS is disabled', () => {
    expect(() =>
      resolveDatabaseConfig(
        config({ DB_SSL_CA_BASE64: Buffer.from(validPem).toString('base64') }),
      ),
    ).toThrow('DB_SSL_CA_BASE64');
  });

  it('rejects a short production password without exposing it', () => {
    const password = 'short-pass';
    try {
      resolveDatabaseConfig(
        config({
          NODE_ENV: 'production',
          DB_SSL_MODE: 'verify-full',
          DB_PASSWORD: password,
        }),
      );
      throw new Error('Expected configuration to be rejected');
    } catch (error) {
      expect((error as Error).message).toContain('12 characters');
      expect((error as Error).message).not.toContain(password);
    }
  });

  it.each([
    'postgres',
    'password',
    '1234',
    'admin',
    'troque_agora_123',
    'change_me_now',
    'replace_me_now',
  ])('rejects predictable production password %s', (password) => {
    expect(() =>
      resolveDatabaseConfig(
        config({
          NODE_ENV: 'production',
          DB_SSL_MODE: 'verify-full',
          DB_PASSWORD: password,
        }),
      ),
    ).toThrow('DB_PASSWORD');
  });

  it('allows a simple local credential', () => {
    expect(resolveDatabaseConfig(config()).password).toBe('postgres');
  });

  it.each(['postgres', 'template0', 'template1'])(
    'rejects production administrative database %s',
    (database) => {
      expect(() =>
        resolveDatabaseConfig(
          config({
            NODE_ENV: 'production',
            DB_SSL_MODE: 'verify-full',
            DB_PASSWORD: 'a-secure-password',
            DB_NAME: database,
          }),
        ),
      ).toThrow('DB_NAME');
    },
  );

  it('preserves a valid password without trimming it', () => {
    const password = ' valid password with spaces ';
    expect(
      resolveDatabaseConfig(config({ DB_PASSWORD: password })).password,
    ).toBe(password);
  });
});
