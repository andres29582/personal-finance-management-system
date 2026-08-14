import { randomUUID } from 'node:crypto';
import { DataSource, type QueryRunner } from 'typeorm';

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
  pendingRequests: Promise<unknown>[];
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

  constructor(private readonly coordinatorDataSource: DataSource) {}

  async installBarrier({
    holder,
    table,
    triggerEvent,
  }: InstallBarrierOptions): Promise<PostgresBarrier> {
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
      return;
    }

    await barrier.queryRunner.connect();
    const discoveredPids = (await barrier.queryRunner
      .query(
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
      )
      .catch(() => [])) as Array<{ pid: number }>;
    for (const { pid } of discoveredPids) {
      barrier.pids.add(pid);
    }

    await this.unlockBarrier(barrier);
    await Promise.allSettled(
      barrier.pendingRequests.map((pending) =>
        withTimeout(pending, 'pending request cleanup', 1000),
      ),
    );

    const pids = [...barrier.pids];
    if (pids.length > 0) {
      await barrier.queryRunner.query(
        `SELECT pg_cancel_backend(pid)
         FROM pg_stat_activity
         WHERE pid = ANY($1::integer[]) AND state <> 'idle'`,
        [pids],
      );
    }
    const pendingResults = await Promise.allSettled(
      barrier.pendingRequests.map((pending) =>
        withTimeout(pending, 'cancelled request cleanup', 2000),
      ),
    );
    const timedOutRequest = pendingResults.find(
      (result) =>
        result.status === 'rejected' &&
        result.reason instanceof Error &&
        result.reason.message.startsWith('Timed out waiting for'),
    );
    if (timedOutRequest !== undefined) {
      throw new Error('Timed out cleaning up a pending HTTP request');
    }

    await barrier.queryRunner.query(
      `DROP TRIGGER IF EXISTS ${quoteIdentifier(barrier.triggerName)}
       ON ${quoteIdentifier(barrier.table)}`,
    );
    await barrier.queryRunner.query(
      `DROP FUNCTION IF EXISTS ${quoteIdentifier(barrier.functionName)}()`,
    );
    await barrier.queryRunner.release();
    this.activeBarriers.delete(barrier);
  }

  async cleanupAll(): Promise<void> {
    const results = await this.cleanupAllSettled();
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') {
      throw failure.reason instanceof Error
        ? failure.reason
        : new Error('Concurrency barrier cleanup failed');
    }
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
