import { randomUUID } from 'node:crypto';
import { DataSource, type QueryRunner } from 'typeorm';
import type { Response, Test } from 'supertest';
import { combine } from '../e2e-runtime.cjs';

type PendingRequest = {
  request: Pick<Test, 'abort'>;
  promise: Promise<unknown>;
  settled: boolean;
};

export type BackendActivity = {
  blockers: number[];
  pid: number;
  query: string;
  waitEvent: string | null;
  waitEventType: string | null;
};

export type PostgresBarrier = {
  applicationName: string;
  functionName: string;
  marker: string;
  pendingRequests: PendingRequest[];
  pids: Set<number>;
  queryRunner: QueryRunner;
  table: string;
  triggerName: string;
  unlocked: boolean;
};

type InstallBarrierOptions = {
  holder: string;
  table: string;
  triggerEvent: string;
};

const DATABASE_POLL_DEADLINE_MS = 5000;
export const REQUEST_DEADLINE_MS = 15000;

export class PostgresConcurrencyHarness {
  private readonly activeBarriers = new Set<PostgresBarrier>();
  private cleanupFailure?: unknown;

  constructor(private readonly coordinatorDataSource: DataSource) {}

  async installBarrier({
    holder,
    table,
    triggerEvent,
  }: InstallBarrierOptions): Promise<PostgresBarrier> {
    if (this.cleanupFailure) throw this.cleanupFailure;
    const marker = `fc_${randomUUID().replaceAll('-', '')}`;
    const barrier: PostgresBarrier = {
      applicationName: `${marker}_${holder}`,
      functionName: `fn_${marker}`,
      marker,
      pendingRequests: [],
      pids: new Set<number>(),
      queryRunner: this.coordinatorDataSource.createQueryRunner(),
      table,
      triggerName: `trg_${marker}`,
      unlocked: false,
    };
    this.activeBarriers.add(barrier);
    await barrier.queryRunner.connect();
    await barrier.queryRunner.query(`SET lock_timeout = '5s'`);
    await barrier.queryRunner.query(`SET statement_timeout = '15s'`);

    const markerLiteral = quoteLiteral(marker);
    const applicationNameLiteral = quoteLiteral(barrier.applicationName);
    await barrier.queryRunner.query(`
      CREATE FUNCTION ${quoteIdentifier(barrier.functionName)}()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $barrier$
      BEGIN
        PERFORM set_config('application_name', ${applicationNameLiteral}, true);
        PERFORM set_config('lock_timeout', '10000', true);
        PERFORM pg_advisory_xact_lock(hashtextextended(${markerLiteral}, 0));
        RETURN NEW;
      END;
      $barrier$
    `);
    await barrier.queryRunner.query(`
      CREATE TRIGGER ${quoteIdentifier(barrier.triggerName)}
      ${triggerEvent}
      EXECUTE FUNCTION ${quoteIdentifier(barrier.functionName)}()
    `);
    await barrier.queryRunner.query(
      'SELECT pg_advisory_lock(hashtextextended($1, 0))',
      [marker],
    );

    return barrier;
  }

  async waitForTaggedHolder(
    barrier: PostgresBarrier,
  ): Promise<BackendActivity> {
    const coordinatorPid = await this.getCoordinatorPid(barrier);
    const activity = await this.pollDatabase(async () => {
      const rows = await this.readActivities(
        barrier,
        'WHERE application_name = $1',
        [barrier.applicationName],
      );

      return rows.find(
        (row) =>
          row.waitEventType === 'Lock' && row.blockers.includes(coordinatorPid),
      );
    }, `${barrier.applicationName} to reach its advisory barrier`);

    barrier.pids.add(activity.pid);
    expectBlockedBy(activity, coordinatorPid);
    return activity;
  }

  async expectTaggedHolderStillBlocked(
    barrier: PostgresBarrier,
    holderPid: number,
  ): Promise<void> {
    const coordinatorPid = await this.getCoordinatorPid(barrier);
    const [activity] = await this.readActivities(
      barrier,
      'WHERE pid = $1 AND application_name = $2',
      [holderPid, barrier.applicationName],
    );

    expect(activity).toBeDefined();
    expectBlockedBy(activity, coordinatorPid);
  }

  async waitForBlockedActivity(
    barrier: PostgresBarrier,
    blockerPid: number,
    matchesRequest: (activity: BackendActivity) => boolean,
  ): Promise<BackendActivity> {
    const activity = await this.pollDatabase(async () => {
      const rows = await this.readActivities(
        barrier,
        'WHERE $1::integer = ANY(pg_blocking_pids(pid))',
        [blockerPid],
      );

      return rows.find(
        (row) => row.waitEventType === 'Lock' && matchesRequest(row),
      );
    }, `a request blocked by PostgreSQL PID ${blockerPid}`);

    barrier.pids.add(activity.pid);
    return activity;
  }

  async unlockBarrier(barrier: PostgresBarrier): Promise<void> {
    if (barrier.unlocked || barrier.queryRunner.isReleased) {
      return;
    }
    await barrier.queryRunner.query(
      'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
      [barrier.marker],
    );
    barrier.unlocked = true;
  }

  async cleanupBarrier(barrier: PostgresBarrier): Promise<void> {
    if (barrier.queryRunner.isReleased) {
      this.activeBarriers.delete(barrier);
      throw new Error(
        'Barrier coordinator was released before cleanup confirmation',
      );
    }
    const errors: unknown[] = [];
    const attempt = async (work: () => Promise<unknown>) => {
      try {
        await work();
      } catch (error) {
        errors.push(error);
      }
    };
    try {
      await attempt(async () => {
        await barrier.queryRunner.connect();
        const discoveredPids = (await barrier.queryRunner.query(
          `WITH holders AS (
           SELECT pid
           FROM pg_stat_activity
           WHERE application_name = $1
         )
         SELECT activity.pid
         FROM pg_stat_activity activity
         WHERE activity.application_name = $1
            OR EXISTS (
              SELECT 1
              FROM holders
              WHERE holders.pid = ANY(pg_blocking_pids(activity.pid))
            )`,
          [barrier.applicationName],
        )) as Array<{ pid: number }>;
        for (const { pid } of discoveredPids) barrier.pids.add(pid);
      });
      for (const pending of barrier.pendingRequests) {
        if (!pending.settled) {
          errors.push(
            new Error(
              'Pending HTTP handler completion is unconfirmed after abort',
            ),
          );
          await attempt(async () => {
            pending.request.abort();
          });
        }
      }
      await attempt(() => this.unlockBarrier(barrier));
      const pids = [...barrier.pids];
      if (pids.length > 0)
        await attempt(() =>
          barrier.queryRunner.query(
            `SELECT pg_cancel_backend(pid)
         FROM pg_stat_activity
         WHERE pid = ANY($1::integer[]) AND datname = current_database()
           AND usename = current_user AND state <> 'idle'`,
            [pids],
          ),
        );
      const pendingResults = await Promise.allSettled(
        barrier.pendingRequests.map(({ promise }) =>
          withTimeout(promise, 'aborted request cleanup', 2000),
        ),
      );
      for (const result of pendingResults) {
        if (
          result.status === 'rejected' &&
          result.reason instanceof Error &&
          result.reason.message.startsWith('Timed out waiting')
        )
          errors.push(result.reason);
      }
      if (pids.length > 0)
        await attempt(async () => {
          await this.pollDatabase(async () => {
            const active = (await barrier.queryRunner.query(
              `SELECT pid FROM pg_stat_activity WHERE pid = ANY($1::integer[])
               AND datname = current_database() AND usename = current_user
               AND (state <> 'idle' OR xact_start IS NOT NULL)`,
              [pids],
            )) as Array<{ pid: number }>;
            return active.length === 0 ? true : undefined;
          }, 'cancelled SQL transactions to settle');
        });
      await attempt(() =>
        barrier.queryRunner.query(
          `DROP TRIGGER IF EXISTS ${quoteIdentifier(barrier.triggerName)}
       ON ${quoteIdentifier(barrier.table)}`,
        ),
      );
      await attempt(() =>
        barrier.queryRunner.query(
          `DROP FUNCTION IF EXISTS ${quoteIdentifier(barrier.functionName)}()`,
        ),
      );
    } finally {
      if (barrier.queryRunner.isTransactionActive)
        await attempt(() => barrier.queryRunner.rollbackTransaction());
      // Remove session settings before returning a healthy coordinator to its pool.
      await attempt(() =>
        barrier.queryRunner.query(
          'RESET lock_timeout; RESET statement_timeout',
        ),
      );
      if (errors.length > 0) {
        // TypeORM's PostgreSQL release(error) path removes the client instead of recycling it.
        const disposable = barrier.queryRunner as unknown as {
          releasePostgresConnection(error: Error): Promise<void>;
        };
        await attempt(() =>
          disposable.releasePostgresConnection(
            new Error('E2E coordinator cleanup failed'),
          ),
        );
      } else {
        await attempt(() => barrier.queryRunner.release());
      }
      this.activeBarriers.delete(barrier);
    }
    const error = combine(
      undefined,
      errors,
      'Concurrency barrier cleanup failed',
    );
    if (error) {
      this.cleanupFailure = error;
      throw error;
    }
  }

  trackRequest(barrier: PostgresBarrier, request: Test): Promise<Response> {
    const pending: PendingRequest = {
      request,
      promise: Promise.resolve(),
      settled: false,
    };
    request.timeout({ deadline: REQUEST_DEADLINE_MS });
    pending.promise = new Promise<Response>((resolve, reject) => {
      const aborted = () => reject(new Error('Owned HTTP request aborted'));
      request.once('abort', aborted);
      void request.then(resolve, reject).finally(() => {
        request.off('abort', aborted);
      });
    });
    void pending.promise.then(
      () => {
        pending.settled = true;
      },
      () => {
        pending.settled = true;
      },
    );
    barrier.pendingRequests.push(pending);
    return pending.promise as Promise<Response>;
  }

  async withBarrier<T>(
    barrier: PostgresBarrier,
    work: () => Promise<T>,
  ): Promise<T> {
    let primary: unknown;
    let value: T | undefined;
    try {
      value = await work();
    } catch (error) {
      primary = error;
    }
    const cleanup: unknown[] = [];
    try {
      await this.cleanupBarrier(barrier);
    } catch (error) {
      cleanup.push(error);
    }
    const error = combine(primary, cleanup);
    if (error) throw error;
    return value as T;
  }

  async cleanupAll(): Promise<void> {
    const results = await this.cleanupAllSettled();
    const errors = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason as unknown);
    const error = combine(
      undefined,
      errors,
      'Concurrency barrier cleanup failed',
    );
    if (error) throw error;
  }

  cleanupAllSettled(): Promise<PromiseSettledResult<void>[]> {
    return Promise.allSettled(
      [...this.activeBarriers].map((barrier) => this.cleanupBarrier(barrier)),
    );
  }

  private async getCoordinatorPid(barrier: PostgresBarrier): Promise<number> {
    const [{ pid }] = (await barrier.queryRunner.query(
      'SELECT pg_backend_pid() AS pid',
    )) as Array<{ pid: number }>;
    return pid;
  }

  private async readActivities(
    barrier: PostgresBarrier,
    whereClause: string,
    parameters: unknown[],
  ): Promise<BackendActivity[]> {
    return (await barrier.queryRunner.query(
      `SELECT
         pid,
         query,
         wait_event AS "waitEvent",
         wait_event_type AS "waitEventType",
         pg_blocking_pids(pid) AS blockers
       FROM pg_stat_activity
       ${whereClause}`,
      parameters,
    )) as BackendActivity[];
  }

  private async pollDatabase<T>(
    observe: () => Promise<T | undefined>,
    description: string,
  ): Promise<T> {
    const deadline = Date.now() + DATABASE_POLL_DEADLINE_MS;

    while (Date.now() < deadline) {
      const result = await observe();
      if (result !== undefined) {
        return result;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }

    throw new Error(`Timed out waiting for ${description}`);
  }
}

export function expectBlockedBy(
  activity: BackendActivity | undefined,
  blockerPid: number,
): void {
  expect(activity).toBeDefined();
  expect(activity?.pid).not.toBe(blockerPid);
  expect(activity?.waitEventType).toBe('Lock');
  expect(activity?.waitEvent).toEqual(expect.any(String));
  expect(activity?.blockers).toContain(blockerPid);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  description: string,
  timeoutMs = REQUEST_DEADLINE_MS,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${description}`)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
