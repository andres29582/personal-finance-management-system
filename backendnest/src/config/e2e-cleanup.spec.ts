import { EventEmitter } from 'node:events';
import type { DataSource, QueryRunner } from 'typeorm';
import type { Test } from 'supertest';
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner';
import {
  PostgresConcurrencyHarness,
  type PostgresBarrier,
} from '../../test/helpers/postgres-concurrency.helper';

function fixture(failOn?: string) {
  const calls: string[] = [];
  const runner = {
    isReleased: false,
    isTransactionActive: false,
    connect: jest.fn(async () => {
      calls.push('connect');
      return Promise.resolve();
    }),
    query: jest.fn(async (sql: string) => {
      calls.push(sql);
      if (failOn && sql.includes(failOn))
        throw new Error('synthetic query failure');
      if (sql.includes('pg_advisory_unlock'))
        return Promise.resolve([{ pg_advisory_unlock: true }]);
      return Promise.resolve([]);
    }),
    release: jest.fn(async () => {
      calls.push('release');
      runner.isReleased = true;
      return Promise.resolve();
    }),
    releasePostgresConnection: jest.fn<Promise<void>, [Error]>(async () => {
      calls.push('release');
      runner.isReleased = true;
      return Promise.resolve();
    }),
    rollbackTransaction: jest.fn(async () => {
      calls.push('rollback');
      return Promise.resolve();
    }),
  };
  const source = { createQueryRunner: () => runner } as unknown as DataSource;
  const harness = new PostgresConcurrencyHarness(source);
  const barrier: PostgresBarrier = {
    applicationName: 'synthetic_holder',
    functionName: 'fn_synthetic',
    marker: 'synthetic',
    pendingRequests: [],
    pids: new Set([11]),
    queryRunner: runner as unknown as QueryRunner,
    table: 'conta',
    triggerName: 'trg_synthetic',
    unlocked: false,
  };
  return { harness, barrier, runner, calls };
}

describe('E2E barrier failure cleanup without PostgreSQL or HTTP', () => {
  it('installed PostgreSQL driver can discard an unhealthy pooled connection', () => {
    expect(
      typeof (
        PostgresQueryRunner.prototype as unknown as {
          releasePostgresConnection: unknown;
        }
      ).releasePostgresConnection,
    ).toBe('function');
  });
  it('continues cleanup and releases runner after trigger cleanup fails', async () => {
    const f = fixture('DROP TRIGGER');
    await expect(f.harness.cleanupBarrier(f.barrier)).rejects.toThrow(
      'synthetic query failure',
    );
    expect(f.calls.some((sql) => sql.includes('DROP FUNCTION'))).toBe(true);
    expect(f.calls.at(-1)).toBe('release');
    expect(f.runner.releasePostgresConnection).toHaveBeenCalledWith(
      expect.any(Error),
    );
    expect(f.runner.release).not.toHaveBeenCalled();
  });
  it('does not hide discovery failure and still unlocks, cancels and releases', async () => {
    const f = fixture('WITH holders');
    await expect(f.harness.cleanupBarrier(f.barrier)).rejects.toThrow(
      'synthetic query failure',
    );
    expect(f.calls.some((sql) => sql.includes('pg_advisory_unlock'))).toBe(
      true,
    );
    expect(f.calls.some((sql) => sql.includes('pg_cancel_backend'))).toBe(true);
    expect(f.calls.at(-1)).toBe('release');
  });
  it('aborts an actual request handle and settles its wrapper even if transport never settles', async () => {
    const f = fixture();
    const request = new EventEmitter() as EventEmitter & {
      then: () => Promise<unknown>;
      abort: jest.Mock;
      timeout: jest.Mock;
    };
    request.then = () => new Promise(() => {});
    request.abort = jest.fn(() => request.emit('abort'));
    request.timeout = jest.fn(() => request);
    const pending = f.harness.trackRequest(
      f.barrier,
      request as unknown as Test,
    );
    await expect(f.harness.cleanupBarrier(f.barrier)).rejects.toThrow(
      'completion is unconfirmed',
    );
    await expect(pending).rejects.toThrow('aborted');
    expect(request.abort).toHaveBeenCalledTimes(1);
    expect(f.runner.releasePostgresConnection).toHaveBeenCalledTimes(1);
  });
  it('preserves primary work failure together with all cleanup failures', async () => {
    const f = fixture('DROP');
    const primary = new Error('synthetic assertion failure');
    await expect(
      f.harness.withBarrier(f.barrier, () => Promise.reject(primary)),
    ).rejects.toMatchObject({ errors: [primary, expect.any(AggregateError)] });
    expect(f.calls.at(-1)).toBe('release');
  });
  it('detects an already released coordinator rather than declaring cleanup success', async () => {
    const f = fixture();
    f.runner.isReleased = true;
    await expect(f.harness.cleanupBarrier(f.barrier)).rejects.toThrow(
      'released',
    );
  });
});
