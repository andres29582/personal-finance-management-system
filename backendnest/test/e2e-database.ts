import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { configureEnvironment, withGuardedDatabase } from './e2e-runtime.cjs';

type E2eDatabaseConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
};

export function configureE2eEnvironment(): E2eDatabaseConfig {
  const config = resolveE2eDatabaseConfig();
  assertSafeTestDatabaseName(config.database);
  configureEnvironment(config);

  process.env.DB_HOST = config.host;
  process.env.DB_PORT = String(config.port);
  process.env.DB_USERNAME = config.username;
  process.env.DB_PASSWORD = config.password;
  process.env.DB_NAME = config.database;
  process.env.DB_SSL_MODE = 'disable';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'e2e_jwt_secret';
  process.env.JWT_ACCESS_SECRET = 'e2e_access_secret';
  process.env.JWT_REFRESH_SECRET = 'e2e_refresh_secret';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '30d';
  process.env.JWT_ISSUER = 'meu-sistema-financeiro';
  process.env.AUTH_MAX_ACTIVE_SESSIONS = '5';
  process.env.THROTTLE_LIMIT = '1000';
  process.env.THROTTLE_TTL_MS = '60000';
  process.env.AUTH_RETURN_RESET_TOKEN = 'true';
  process.env.PASSWORD_RESET_DELIVERY_URL = '';
  process.env.PASSWORD_RESET_DELIVERY_API_KEY = '';

  return config;
}

export async function prepareE2eDatabase(
  config: E2eDatabaseConfig,
): Promise<void> {
  assertSafeTestDatabaseName(config.database);
  const expected = resolveE2eDatabaseConfig();
  if (
    Object.keys(expected).some(
      (key) =>
        expected[key as keyof E2eDatabaseConfig] !==
        config[key as keyof E2eDatabaseConfig],
    )
  ) {
    throw new Error(
      'E2E destination does not match the explicit confirmed configuration.',
    );
  }
  await recreatePublicSchema(config);
  await runSqlMigrations(config);
}

function resolveE2eDatabaseConfig(): E2eDatabaseConfig {
  const required = (key: string): string => {
    const value = process.env[key];
    if (!value)
      throw new Error(
        'Explicit disposable E2E configuration is required: ' + key,
      );
    return value;
  };
  const database = required('E2E_DB_NAME');
  assertSafeTestDatabaseName(database);
  if (required('E2E_DB_RESET_CONFIRM') !== database)
    throw new Error('E2E reset confirmation does not match.');
  const username = required('E2E_DB_USERNAME');
  if (!/^finance_e2e_[a-z0-9_]+$/.test(username))
    throw new Error('Dedicated E2E role is required.');
  const port = Number(required('E2E_DB_PORT'));
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid E2E port.');
  return {
    host: required('E2E_DB_HOST'),
    port,
    username,
    password: required('E2E_DB_PASSWORD'),
    database,
  };
}

async function recreatePublicSchema(config: E2eDatabaseConfig): Promise<void> {
  await withDataSource(config, async (dataSource) => {
    await dataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
    await dataSource.query('CREATE SCHEMA public');
  });
}

async function runSqlMigrations(config: E2eDatabaseConfig): Promise<void> {
  const migrationsDir = join(__dirname, '..', 'migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  await withDataSource(config, async (dataSource) => {
    for (const migrationFile of migrationFiles) {
      const sql = readFileSync(join(migrationsDir, migrationFile), 'utf8');
      await dataSource.query(sql);
    }
  });
}

async function withDataSource(
  config: E2eDatabaseConfig,
  callback: (connection: {
    query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T>;
  }) => Promise<void>,
): Promise<void> {
  await withGuardedDatabase(config, process.env, async (client) => {
    await callback({
      query: async <T>(sql: string, parameters?: unknown[]): Promise<T> =>
        (await client.query(sql, parameters)).rows as T,
    });
  });
}

function assertSafeTestDatabaseName(database: string): void {
  if (!/^finance_e2e_[a-z0-9_]+$/.test(database)) {
    throw new Error(
      'E2E database must have the exact finance_e2e_ disposable prefix.',
    );
  }
}
