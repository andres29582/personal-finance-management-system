import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transpileModule } from 'typescript';
import { ConfigService } from '@nestjs/config';
import { resolveDatabaseConfig } from './database.config';
import { resolveHttpRuntimeConfig } from './http-runtime.config';
import { resolveAuthTokenConfig } from '../auth/config/auth-token.config';
import { resolvePasswordResetConfig } from '../auth/config/password-reset.config';

const backend = join(__dirname, '../..');
function template(name: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(join(backend, name), 'utf8')
      .split(/\r?\n/)
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => [
        line.slice(0, line.indexOf('=')),
        line.slice(line.indexOf('=') + 1),
      ]),
  );
}
function config(values: Record<string, string>) {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('U6 separate preparation profiles, no private dotenv or connection', () => {
  it('exposed template is deliberately unusable until private provisioning', () => {
    const values = template('.env.production.example');
    expect(values.NODE_ENV).toBe('production');
    expect(values.DB_SSL_MODE).toBe('verify-full');
    expect(values.AUTH_RETURN_RESET_TOKEN).toBe('false');
    expect(() => resolveDatabaseConfig(config(values))).toThrow();
    expect(() => resolveHttpRuntimeConfig(config(values))).toThrow();
    expect(() => resolveAuthTokenConfig(config(values))).toThrow();
    expect(() => resolvePasswordResetConfig(config(values))).toThrow();
  });

  it('synthetically provisioned profile passes existing config resolvers without starting services', () => {
    const values = {
      ...template('.env.production.example'),
      CORS_ORIGINS: 'https://app.example.invalid',
      DB_HOST: 'db.example.invalid',
      DB_USERNAME: 'synthetic_owner',
      DB_NAME: 'synthetic_finance',
      DB_PASSWORD: 'synthetic-db-password-not-for-use',
      JWT_ACCESS_SECRET: 'synthetic-access-secret-not-for-use-32',
      JWT_REFRESH_SECRET: 'synthetic-refresh-secret-not-for-use-32',
      PASSWORD_RESET_DELIVERY_URL: 'https://reset.example.invalid/delivery',
      PASSWORD_RESET_DELIVERY_API_KEY:
        'synthetic-delivery-secret-not-for-use-32',
    };
    expect(resolveDatabaseConfig(config(values)).ssl).toEqual({
      rejectUnauthorized: true,
    });
    expect(resolveHttpRuntimeConfig(config(values)).allowedOrigins).toEqual([
      'https://app.example.invalid',
    ]);
    expect(resolveAuthTokenConfig(config(values)).maxActiveSessions).toBe(5);
    expect(resolvePasswordResetConfig(config(values)).returnResetToken).toBe(
      false,
    );
  });

  function e2eResolver(values: Record<string, string>) {
    const source = readFileSync(join(backend, 'test/e2e-database.ts'), 'utf8');
    const resolver = source.slice(
      source.indexOf('function resolveE2eDatabaseConfig('),
      source.indexOf('\nasync function recreatePublicSchema('),
    );
    const guard = source.slice(
      source.indexOf('function assertSafeTestDatabaseName('),
    );
    // Exercise only the actual pure resolver, with an isolated synthetic process.
    const compiled = transpileModule(resolver + '\n' + guard, {}).outputText;
    const result: unknown = runInNewContext(
      compiled + '\nresolveE2eDatabaseConfig();',
      { process: { env: values } },
      { timeout: 1000 },
    );
    if (
      !result ||
      typeof result !== 'object' ||
      !('database' in result) ||
      typeof result.database !== 'string'
    )
      throw new Error('Invalid E2E resolver result');
    return result;
  }

  it('E2E template has no password or admin fallback and fails closed before DB access', () => {
    const values = template('.env.example');
    expect(values.E2E_DB_NAME).toBe('finance_e2e_local');
    expect(values.E2E_DB_USERNAME).toBe('finance_e2e_local_owner');
    expect(values.E2E_DB_PASSWORD).toBe('');
    expect(values.E2E_DB_RESET_CONFIRM).toBe(values.E2E_DB_NAME);
    expect(values.E2E_DB_PORT).not.toBe('5432');
    expect(values.E2E_DB_ADMIN_DATABASE).toBeUndefined();
    expect(() => e2eResolver(values)).toThrow('E2E_DB_PASSWORD');
  });

  it('actual E2E resolver accepts synthetic explicit input but rejects wrong reset and owner', () => {
    const values = {
      ...template('.env.example'),
      E2E_DB_PASSWORD: 'synthetic-private-test-only',
    };
    expect(e2eResolver(values).database).toBe('finance_e2e_local');
    expect(() =>
      e2eResolver({ ...values, E2E_DB_RESET_CONFIRM: 'wrong' }),
    ).toThrow('confirmation');
    expect(() =>
      e2eResolver({ ...values, E2E_DB_USERNAME: 'postgres' }),
    ).toThrow('Dedicated E2E role');
  });
});
