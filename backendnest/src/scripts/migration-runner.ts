import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface MigrationFile {
  name: string;
  fullPath: string;
  checksum: string;
  sql: string;
}

export interface MigrationRecord {
  id: number;
  name: string;
  checksum: string;
  applied_at: Date;
}

export interface MigrationStatus {
  name: string;
  status: 'APPLIED' | 'PENDING';
  checksum: string;
  applied_at: Date | null;
}

export interface QueryableClient {
  query<T extends object = Record<string, unknown>>(
    sql: string,
    parameters?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export const ADVISORY_LOCK_ID = 884729104;

export class MigrationExecutionError extends Error {
  constructor(
    public readonly migrationName: string,
    public readonly originalError: unknown,
  ) {
    const detail =
      originalError instanceof Error
        ? originalError.message
        : String(originalError);
    super(`Migration '${migrationName}' failed: ${detail}`);
    this.name = 'MigrationExecutionError';
  }
}

export function calculateChecksum(content: string): string {
  return createHash('sha256').update(content.trim()).digest('hex');
}

export function loadMigrationFiles(migrationsDir: string): MigrationFile[] {
  const fileNames = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  return fileNames.map((fileName) => {
    const fullPath = join(migrationsDir, fileName);
    const sql = readFileSync(fullPath, 'utf8');
    const checksum = calculateChecksum(sql);

    return {
      name: fileName,
      fullPath,
      checksum,
      sql,
    };
  });
}

export async function ensureMigrationTable(
  client: QueryableClient,
): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function getAppliedMigrations(
  client: QueryableClient,
): Promise<Map<string, MigrationRecord>> {
  await ensureMigrationTable(client);
  const result = await client.query<MigrationRecord>(
    `SELECT id, name, checksum, applied_at FROM schema_migrations ORDER BY id ASC;`,
  );

  const map = new Map<string, MigrationRecord>();
  for (const row of result.rows) {
    map.set(row.name, row);
  }

  return map;
}

export async function getMigrationStatus(
  migrationsDir: string,
  client: QueryableClient,
): Promise<MigrationStatus[]> {
  const files = loadMigrationFiles(migrationsDir);
  const applied = await getAppliedMigrations(client);

  return files.map((file) => {
    const record = applied.get(file.name);
    if (record) {
      return {
        name: file.name,
        status: 'APPLIED',
        checksum: record.checksum,
        applied_at: record.applied_at,
      };
    }
    return {
      name: file.name,
      status: 'PENDING',
      checksum: file.checksum,
      applied_at: null,
    };
  });
}

export async function markMigrationsAsApplied(
  migrationsDir: string,
  client: QueryableClient,
  options: { all?: boolean; target?: string } = { all: true },
): Promise<string[]> {
  await ensureMigrationTable(client);
  const files = loadMigrationFiles(migrationsDir);
  const applied = await getAppliedMigrations(client);
  const marked: string[] = [];

  for (const file of files) {
    if (applied.has(file.name)) {
      continue;
    }

    if (options.all || options.target === file.name) {
      await client.query(
        `INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2);`,
        [file.name, file.checksum],
      );
      marked.push(file.name);
    }
  }

  return marked;
}

export async function runPendingMigrations(
  migrationsDir: string,
  client: QueryableClient,
  options: {
    dryRun?: boolean;
    logger?: (msg: string) => void;
  } = {},
): Promise<{ applied: string[]; skipped: string[] }> {
  const logger = options.logger ?? console.log;
  await ensureMigrationTable(client);

  // Obtain advisory lock to prevent concurrent execution
  await client.query(`SELECT pg_advisory_lock($1);`, [ADVISORY_LOCK_ID]);

  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    const files = loadMigrationFiles(migrationsDir);
    const appliedMap = await getAppliedMigrations(client);

    for (const file of files) {
      if (appliedMap.has(file.name)) {
        skipped.push(file.name);
        continue;
      }

      if (options.dryRun) {
        logger(
          `[DRY-RUN] Pending: ${file.name} (checksum: ${file.checksum.slice(0, 8)}...)`,
        );
        applied.push(file.name);
        continue;
      }

      logger(`[APPLYING] ${file.name} ...`);

      const trimmedSql = file.sql.trim();
      const hasExplicitTransaction =
        trimmedSql.toUpperCase().startsWith('BEGIN;') ||
        trimmedSql.toUpperCase().startsWith('BEGIN');

      try {
        if (hasExplicitTransaction) {
          await client.query(file.sql);
          await client.query(
            `INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2);`,
            [file.name, file.checksum],
          );
        } else {
          await client.query('BEGIN;');
          await client.query(file.sql);
          await client.query(
            `INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2);`,
            [file.name, file.checksum],
          );
          await client.query('COMMIT;');
        }

        logger(`[SUCCESS]  ${file.name}`);
        applied.push(file.name);
      } catch (error) {
        if (!hasExplicitTransaction) {
          try {
            await client.query('ROLLBACK;');
          } catch {
            // Ignore rollback errors if already aborted
          }
        }
        logger(`[FAILED]   ${file.name}`);
        throw new MigrationExecutionError(file.name, error);
      }
    }
  } finally {
    // Release advisory lock
    try {
      await client.query(`SELECT pg_advisory_unlock($1);`, [ADVISORY_LOCK_ID]);
    } catch {
      // Ignore unlock cleanup failure
    }
  }

  return { applied, skipped };
}
