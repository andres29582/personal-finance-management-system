import type { QueryableClient } from './migration-runner';
const createQueryMock = () =>
  jest.fn() as jest.MockedFunction<QueryableClient['query']>;
import {
  calculateChecksum,
  ensureMigrationTable,
  getAppliedMigrations,
  getMigrationStatus,
  loadMigrationFiles,
  markMigrationsAsApplied,
  MigrationExecutionError,
  runPendingMigrations,
} from './migration-runner';
import { join } from 'node:path';

describe('MigrationRunner Unit Tests', () => {
  const migrationsDir = join(__dirname, '..', '..', 'migrations');

  it('calculateChecksum returns deterministic sha256', () => {
    const hash1 = calculateChecksum('SELECT 1;');
    const hash2 = calculateChecksum('SELECT 1;\n');
    const hash3 = calculateChecksum('SELECT 2;');

    expect(hash1).toBe(hash2); // trims whitespace
    expect(hash1).not.toBe(hash3);
    expect(hash1).toHaveLength(64);
  });

  it('loadMigrationFiles loads all 18 SQL migrations in sorted order', () => {
    const files = loadMigrationFiles(migrationsDir);

    expect(files.length).toBeGreaterThanOrEqual(18);
    expect(files[0].name).toBe('0001_mvp_baseline.sql');
    expect(files[files.length - 1].name).toBe(
      '0018_transfer_create_intent.sql',
    );

    for (const file of files) {
      expect(file.name).toMatch(/^\d{4}_.*\.sql$/);
      expect(file.checksum).toHaveLength(64);
      expect(file.sql.length).toBeGreaterThan(0);
    }
  });

  it('ensureMigrationTable executes CREATE TABLE IF NOT EXISTS schema_migrations', async () => {
    const mockQuery = createQueryMock().mockResolvedValue({ rows: [] });
    const client = { query: mockQuery };

    await ensureMigrationTable(client);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toContain(
      'CREATE TABLE IF NOT EXISTS schema_migrations',
    );
  });

  it('getAppliedMigrations parses applied records into a map', async () => {
    const mockQuery = createQueryMock()
      .mockResolvedValueOnce({ rows: [] }) // ensure table
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: '0001_mvp_baseline.sql',
            checksum: 'abc123456789',
            applied_at: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      });

    const client = { query: mockQuery };
    const applied = await getAppliedMigrations(client);

    expect(applied.size).toBe(1);
    expect(applied.has('0001_mvp_baseline.sql')).toBe(true);
    expect(applied.get('0001_mvp_baseline.sql')?.checksum).toBe('abc123456789');
  });

  it('getMigrationStatus flags applied vs pending migrations', async () => {
    const mockQuery = createQueryMock()
      .mockResolvedValueOnce({ rows: [] }) // ensure table
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: '0001_mvp_baseline.sql',
            checksum: 'test_hash',
            applied_at: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      });

    const client = { query: mockQuery };
    const statuses = await getMigrationStatus(migrationsDir, client);

    expect(statuses.length).toBeGreaterThanOrEqual(18);
    const first = statuses.find((s) => s.name === '0001_mvp_baseline.sql');
    const second = statuses.find(
      (s) => s.name === '0002_align_schema_and_create_orcamento.sql',
    );

    expect(first?.status).toBe('APPLIED');
    expect(second?.status).toBe('PENDING');
  });

  it('markMigrationsAsApplied inserts pending migrations into schema_migrations', async () => {
    const mockQuery = createQueryMock()
      .mockResolvedValueOnce({ rows: [] }) // ensure table
      .mockResolvedValueOnce({ rows: [] }) // ensure table in getAppliedMigrations
      .mockResolvedValueOnce({ rows: [] }) // getAppliedMigrations select
      .mockResolvedValue({ rows: [] }); // insert calls

    const client = { query: mockQuery };
    const marked = await markMigrationsAsApplied(migrationsDir, client, {
      target: '0001_mvp_baseline.sql',
    });

    expect(marked).toEqual(['0001_mvp_baseline.sql']);
    const insertCall = mockQuery.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('INSERT INTO schema_migrations'),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall?.[1]?.[0]).toBe('0001_mvp_baseline.sql');
  });

  it('runPendingMigrations executes pending migrations with lock and records success', async () => {
    const mockQuery = createQueryMock()
      .mockResolvedValueOnce({ rows: [] }) // ensure table
      .mockResolvedValueOnce({ rows: [] }) // lock
      .mockResolvedValueOnce({ rows: [] }) // ensure table in getApplied
      .mockResolvedValueOnce({
        rows: [
          // All applied except the last one (0018)
          {
            id: 1,
            name: '0001_mvp_baseline.sql',
            checksum: 'h',
            applied_at: new Date(),
          },
        ],
      })
      .mockResolvedValue({ rows: [] }); // sql queries and unlock

    const client = { query: mockQuery };
    const logger = jest.fn();

    // Mock getAppliedMigrations returning all except 0018
    const files = loadMigrationFiles(migrationsDir);
    const allExceptLastRows = files
      .slice(0, files.length - 1)
      .map((f, idx) => ({
        id: idx + 1,
        name: f.name,
        checksum: f.checksum,
        applied_at: new Date(),
      }));

    mockQuery.mockReset();
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // ensure
      .mockResolvedValueOnce({ rows: [] }) // lock
      .mockResolvedValueOnce({ rows: [] }) // ensure
      .mockResolvedValueOnce({ rows: allExceptLastRows }) // applied select
      .mockResolvedValue({ rows: [] }); // execute 0018 & insert & unlock

    const result = await runPendingMigrations(migrationsDir, client, {
      logger,
    });

    expect(result.applied).toEqual(['0018_transfer_create_intent.sql']);
    expect(result.skipped.length).toBe(files.length - 1);
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('[SUCCESS]  0018_transfer_create_intent.sql'),
    );
  });

  it('runPendingMigrations rolls back and throws MigrationExecutionError on failure', async () => {
    const mockQuery = createQueryMock()
      .mockResolvedValueOnce({ rows: [] }) // ensure
      .mockResolvedValueOnce({ rows: [] }) // lock
      .mockResolvedValueOnce({ rows: [] }) // ensure
      .mockResolvedValueOnce({ rows: [] }) // 0 applied
      .mockRejectedValueOnce(new Error('Syntax error in SQL')); // failure in first migration

    const client = { query: mockQuery };
    const logger = jest.fn();

    await expect(
      runPendingMigrations(migrationsDir, client, { logger }),
    ).rejects.toThrow(MigrationExecutionError);

    // Advisory lock must still be unlocked in finally
    const unlockCall = mockQuery.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('pg_advisory_unlock'),
    );
    expect(unlockCall).toBeDefined();
  });
});
