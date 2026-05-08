import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';

type E2eDatabaseConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  adminDatabase: string;
};

export function configureE2eEnvironment(): E2eDatabaseConfig {
  const config = resolveE2eDatabaseConfig();
  assertSafeTestDatabaseName(config.database);

  process.env.DB_HOST = config.host;
  process.env.DB_PORT = String(config.port);
  process.env.DB_USERNAME = config.username;
  process.env.DB_PASSWORD = config.password;
  process.env.DB_NAME = config.database;
  process.env.JWT_SECRET = 'e2e_jwt_secret';
  process.env.JWT_ACCESS_SECRET = 'e2e_access_secret';
  process.env.JWT_REFRESH_SECRET = 'e2e_refresh_secret';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '30d';
  process.env.THROTTLE_LIMIT = '1000';
  process.env.THROTTLE_TTL_MS = '60000';
  process.env.AUTH_RETURN_RESET_TOKEN = 'false';

  return config;
}

export async function prepareE2eDatabase(
  config: E2eDatabaseConfig,
): Promise<void> {
  assertSafeTestDatabaseName(config.database);
  await ensureDatabaseExists(config);
  await recreatePublicSchema(config);
  await runSqlMigrations(config);
}

function resolveE2eDatabaseConfig(): E2eDatabaseConfig {
  const envFile = readDotEnvFile(join(__dirname, '..', '.env'));

  return {
    host:
      process.env.E2E_DB_HOST ??
      process.env.DB_HOST ??
      envFile.DB_HOST ??
      'localhost',
    port: Number(
      process.env.E2E_DB_PORT ??
        process.env.DB_PORT ??
        envFile.DB_PORT ??
        '5432',
    ),
    username:
      process.env.E2E_DB_USERNAME ??
      process.env.DB_USERNAME ??
      envFile.DB_USERNAME ??
      'postgres',
    password:
      process.env.E2E_DB_PASSWORD ??
      process.env.DB_PASSWORD ??
      envFile.DB_PASSWORD ??
      '1234',
    database:
      process.env.E2E_DB_NAME ??
      process.env.DB_TEST_NAME ??
      'gestao_financeira_test',
    adminDatabase: process.env.E2E_DB_ADMIN_DATABASE ?? 'postgres',
  };
}

function readDotEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce<Record<string, string>>((accumulator, line) => {
      const separatorIndex = line.indexOf('=');

      if (separatorIndex <= 0) {
        return accumulator;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      accumulator[key] = value;

      return accumulator;
    }, {});
}

async function ensureDatabaseExists(config: E2eDatabaseConfig): Promise<void> {
  await withDataSource(
    { ...config, database: config.adminDatabase },
    async (dataSource) => {
      const databaseExists = await dataSource.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [config.database],
      );

      if (databaseExists.length === 0) {
        await dataSource.query(
          `CREATE DATABASE ${quoteIdentifier(config.database)}`,
        );
      }
    },
  );
}

async function recreatePublicSchema(config: E2eDatabaseConfig): Promise<void> {
  await withDataSource(config, async (dataSource) => {
    await dataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
    await dataSource.query('CREATE SCHEMA public');
    await dataSource.query('GRANT ALL ON SCHEMA public TO PUBLIC');
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
  callback: (dataSource: DataSource) => Promise<void>,
): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
  });

  await dataSource.initialize();

  try {
    await callback(dataSource);
  } finally {
    await dataSource.destroy();
  }
}

function assertSafeTestDatabaseName(database: string): void {
  if (!/test/i.test(database)) {
    throw new Error(
      `E2E_DB_NAME must include "test"; refusing to reset database "${database}".`,
    );
  }
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
  }

  return `"${identifier.replace(/"/g, '""')}"`;
}
