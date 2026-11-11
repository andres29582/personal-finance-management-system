import { randomUUID } from 'crypto';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { AuthSession } from '../src/auth/entities/auth-session.entity';
import { AuthSessionRepository } from '../src/auth/repositories/auth-session.repository';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';

// Destructive disposable-only harness. This suite is not proof until executed.
jest.setTimeout(30000);
describe('U4 authority on disposable PostgreSQL', () => {
  let source: DataSource, userId: string, sid: string;
  const runners = new Set<QueryRunner>(),
    pending = new Set<Promise<unknown>>();
  beforeAll(async () => {
    const config = configureE2eEnvironment();
    await prepareE2eDatabase(config);
    source = new DataSource({
      type: 'postgres',
      ...config,
      entities: [User, AuthSession],
      logging: false,
      synchronize: false,
      extra: { max: 12 },
    });
    await source.initialize();
  });
  beforeEach(async () => {
    userId = randomUUID();
    sid = randomUUID();
    await source.getRepository(User).save({
      id: userId,
      nome: 'U4 test',
      email: `${userId}@example.com`,
      senhaHash: 'verified',
    });
    await source.query(
      `WITH t AS (SELECT clock_timestamp() AS n) INSERT INTO auth_session(id,usuario_id,refresh_token_hash,expires_at,authenticated_at,last_activity_at,absolute_expires_at,refresh_expires_at,idle_timeout_seconds,policy_version)
   SELECT $1,$2,'old',n+interval '12 hours',n,n,n+interval '12 hours',n+interval '12 hours',900,1 FROM t`,
      [sid, userId],
    );
  });
  afterEach(async () => {
    for (const runner of runners)
      if (runner.isTransactionActive) await runner.rollbackTransaction();
    await Promise.allSettled([...pending]);
    for (const runner of runners)
      if (!runner.isReleased) await runner.release();
    runners.clear();
  });
  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
  });
  function repository(runner?: QueryRunner) {
    const scoped = runner
      ? ({
          transaction: <T>(work: (manager: EntityManager) => Promise<T>) => {
            const operation = (async () => {
              await runner.startTransaction();
              try {
                const result = await work(runner.manager);
                await runner.commitTransaction();
                return result;
              } catch (error) {
                if (runner.isTransactionActive)
                  await runner.rollbackTransaction();
                throw error;
              }
            })();
            pending.add(operation);
            void operation.then(
              () => pending.delete(operation),
              () => pending.delete(operation),
            );
            return operation;
          },
        } as DataSource)
      : source;
    return new AuthSessionRepository(source.getRepository(AuthSession), scoped);
  }
  async function connection() {
    const runner = source.createQueryRunner();
    runners.add(runner);
    await runner.connect();
    const [{ pid }] = await runner.query('SELECT pg_backend_pid() AS pid');
    return { runner, pid: pid as number };
  }
  async function waitBlocked(pid: number, blocker: number) {
    const stop = Date.now() + 3000;
    while (Date.now() < stop) {
      const [{ blocked }] = await source.query(
        `WITH RECURSIVE chain(pid,visited) AS (SELECT $1::integer,ARRAY[$1::integer] UNION ALL SELECT p.pid,c.visited||p.pid FROM chain c CROSS JOIN LATERAL unnest(pg_blocking_pids(c.pid)) p(pid) WHERE NOT p.pid=ANY(c.visited) AND cardinality(c.visited)<16) SELECT EXISTS(SELECT 1 FROM chain WHERE pid=$2::integer) AS blocked`,
        [pid, blocker],
      );
      if (blocked) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(
      'Expected independent backend lock barrier was not observed.',
    );
  }
  async function waitExpired() {
    const stop = Date.now() + 3500;
    while (Date.now() < stop) {
      const [{ expired }] = await source.query(
        'SELECT clock_timestamp() >= absolute_expires_at AS expired FROM auth_session WHERE id=$1',
        [sid],
      );
      if (expired) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Database deadline was not observed.');
  }
  it.each(['user', 'session'])(
    'evaluates DBclock after waiting for %s lock in an already old transaction',
    async (resource) => {
      const blocker = await connection(),
        worker = await connection();
      expect(blocker.pid).not.toBe(worker.pid);
      await source.query(
        "WITH t AS (SELECT clock_timestamp() AS n) UPDATE auth_session SET absolute_expires_at=t.n+interval '2 seconds',refresh_expires_at=t.n+interval '2 seconds' FROM t WHERE id=$1",
        [sid],
      );
      await blocker.runner.startTransaction();
      await blocker.runner.query(
        resource === 'user'
          ? 'SELECT id FROM usuario WHERE id=$1 FOR UPDATE'
          : 'SELECT id FROM auth_session WHERE id=$1 FOR UPDATE',
        [resource === 'user' ? userId : sid],
      );
      const result = repository(worker.runner)
        .authorize(sid, userId, true)
        .catch((error) => error);
      try {
        await waitBlocked(worker.pid, blocker.pid);
        await waitExpired();
        await blocker.runner.commitTransaction();
        expect(await result).toMatchObject({
          code: 'AUTH_SESSION_ABSOLUTE_EXPIRED',
        });
        const session = await source
          .getRepository(AuthSession)
          .findOneByOrFail({ id: sid });
        expect(session.revokedAt).not.toBeNull();
        expect(session.terminalReason).toBe('AUTH_SESSION_ABSOLUTE_EXPIRED');
      } finally {
        if (blocker.runner.isTransactionActive)
          await blocker.runner.rollbackTransaction();
        await result;
      }
    },
  );
  it('rejects an active complete authority row downgraded to null policy version', async () => {
    const before = await source
      .getRepository(AuthSession)
      .findOneByOrFail({ id: sid });
    expect(before.policyVersion).toBe(1);
    expect(before.revokedAt).toBeNull();
    expect(before.authenticatedAt).toBeInstanceOf(Date);
    expect(before.lastActivityAt).toBeInstanceOf(Date);
    expect(before.absoluteExpiresAt).toBeInstanceOf(Date);
    expect(before.refreshExpiresAt).toBeInstanceOf(Date);
    await expect(
      source.query(
        'UPDATE auth_session SET policy_version = NULL WHERE id = $1',
        [sid],
      ),
    ).rejects.toMatchObject({
      driverError: { code: '23514', constraint: 'auth_session_policy_shape' },
    });
    const after = await source
      .getRepository(AuthSession)
      .findOneByOrFail({ id: sid });
    expect(after).toEqual(before);
  });
  it('checks polling without touch and rotates without extending activity or authority', async () => {
    const before = await source
      .getRepository(AuthSession)
      .findOneByOrFail({ id: sid });
    await repository().authorize(sid, userId, false);
    const result = await repository().rotateIfActiveWithMatchingToken(
      sid,
      userId,
      'old',
      async (_now, cap) => ({
        access_token: 'access',
        refresh_token: 'refresh',
        refreshTokenHash: 'next',
        expiresAt: new Date(Math.floor(cap.getTime() / 1000) * 1000),
      }),
    );
    expect(result).toHaveProperty('tokens');
    const after = await source
      .getRepository(AuthSession)
      .findOneByOrFail({ id: sid });
    expect(after.lastActivityAt).toEqual(before.lastActivityAt);
    expect(after.absoluteExpiresAt).toEqual(before.absoluteExpiresAt);
    expect(after.refreshExpiresAt!.getTime()).toBeLessThanOrEqual(
      before.refreshExpiresAt!.getTime(),
    );
  });
  it('commits normal idle expiry without classifying it as refresh reuse', async () => {
    await source.query(
      "UPDATE auth_session SET authenticated_at=clock_timestamp()-interval '16 minutes',last_activity_at=clock_timestamp()-interval '15 minutes' WHERE id=$1",
      [sid],
    );
    expect(
      await repository().rotateIfActiveWithMatchingToken(
        sid,
        userId,
        'wrong',
        async () => {
          throw new Error('must not issue');
        },
      ),
    ).toEqual({ failure: 'AUTH_SESSION_IDLE_EXPIRED' });
    const terminal = await source
      .getRepository(AuthSession)
      .findOneByOrFail({ id: sid });
    expect(terminal.revokedAt).not.toBeNull();
    expect(terminal.terminalReason).toBe('AUTH_SESSION_IDLE_EXPIRED');
  });
  it('cannot touch another owner or a committed revoked session', async () => {
    const before = await source
      .getRepository(AuthSession)
      .findOneByOrFail({ id: sid });
    await expect(
      repository().authorize(sid, randomUUID(), true),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID_SESSION' });
    await repository().revoke(sid, userId);
    await expect(
      repository().authorize(sid, userId, true),
    ).rejects.toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
    expect(
      (await source.getRepository(AuthSession).findOneByOrFail({ id: sid }))
        .lastActivityAt,
    ).toEqual(before.lastActivityAt);
  });
  it('serializes concurrent login pruning at five valid sessions', async () => {
    const blocker = await connection();
    await blocker.runner.startTransaction();
    await blocker.runner.query(
      'SELECT id FROM usuario WHERE id=$1 FOR UPDATE',
      [userId],
    );
    const workers = await Promise.all(
      Array.from({ length: 7 }, () => connection()),
    );
    expect(
      new Set([blocker.pid, ...workers.map((worker) => worker.pid)]).size,
    ).toBe(8);
    const operations = workers.map((worker) =>
      repository(worker.runner).createSession({
        id: randomUUID(),
        userId,
        expectedPasswordHash: 'verified',
        maxActiveSessions: 5,
        policy: { idleSeconds: 900, absoluteSeconds: 43200, version: 1 },
        issue: async (_now, cap) => ({
          access_token: 'access',
          refresh_token: 'refresh',
          refreshTokenHash: randomUUID(),
          expiresAt: new Date(Math.floor(cap.getTime() / 1000) * 1000),
        }),
      }),
    );
    const settled = Promise.allSettled(operations);
    try {
      for (const worker of workers) await waitBlocked(worker.pid, blocker.pid);
      await blocker.runner.commitTransaction();
      expect(
        (await settled).every((result) => result.status === 'fulfilled'),
      ).toBe(true);
    } finally {
      if (blocker.runner.isTransactionActive)
        await blocker.runner.rollbackTransaction();
      await settled;
    }
    const [{ count }] = await source.query(
      "SELECT count(*)::integer AS count FROM auth_session WHERE usuario_id=$1 AND revoked_at IS NULL AND clock_timestamp()<absolute_expires_at AND clock_timestamp()<refresh_expires_at AND clock_timestamp()<last_activity_at+idle_timeout_seconds*interval '1 second'",
      [userId],
    );
    expect(count).toBe(5);
  });
});
