import { randomUUID } from 'crypto';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { AuthSession } from '../src/auth/entities/auth-session.entity';
import { PasswordResetToken } from '../src/auth/entities/password-reset-token.entity';
import { PasswordChangedOutbox } from '../src/auth/entities/password-changed-outbox.entity';
import { PasswordResetTokenRepository } from '../src/auth/repositories/password-reset-token.repository';
import { AuthSessionRepository } from '../src/auth/repositories/auth-session.repository';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';

jest.setTimeout(30000);

describe('credential boundaries on disposable PostgreSQL', () => {
  let source: DataSource;
  let userId: string;
  let sessionId: string;
  let firstHash: string;
  let secondHash: string;
  const runners = new Set<QueryRunner>();
  const blockers = new Set<QueryRunner>();
  const pendingTransactions = new Set<Promise<unknown>>();

  beforeAll(async () => {
    const config = configureE2eEnvironment();
    await prepareE2eDatabase(config);
    source = new DataSource({
      type: 'postgres',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      entities: [User, AuthSession, PasswordResetToken, PasswordChangedOutbox],
      extra: { max: 8 },
      synchronize: false,
      logging: false,
    });
    await source.initialize();
  });
  beforeEach(async () => {
    userId = randomUUID();
    sessionId = randomUUID();
    firstHash = randomUUID().replace(/-/g, '').repeat(2);
    secondHash = randomUUID().replace(/-/g, '').repeat(2);
    await source.getRepository(User).save({
      id: userId,
      nome: 'Credential test',
      email: `${userId}@example.com`,
      senhaHash: 'old-hash',
    });
    await source.getRepository(AuthSession).save({
      id: sessionId,
      userId,
      refreshTokenHash: 'refresh-hash',
      expiresAt: new Date(Date.now() + 60000),
      lastUsedAt: new Date(),
      revokedAt: null,
      authenticatedAt: new Date(Date.now() - 1000),
      lastActivityAt: new Date(Date.now() - 1000),
      absoluteExpiresAt: new Date(Date.now() + 43200000),
      refreshExpiresAt: new Date(Date.now() + 60000),
      idleTimeoutSeconds: 900,
      policyVersion: 1,
    });
    await source.getRepository(PasswordResetToken).save(
      [firstHash, secondHash].map((tokenHash) => ({
        id: randomUUID(),
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60000),
        usedAt: null,
        invalidatedAt: null,
      })),
    );
  });
  afterEach(async () => {
    // Release root blockers, then drain work before reusing its pooled connections.
    for (const runner of blockers) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
    }
    await Promise.allSettled([...pendingTransactions]);
    for (const runner of runners) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      if (!runner.isReleased) await runner.release();
    }
    runners.clear();
    blockers.clear();
  });
  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
  });

  async function connection() {
    const runner = source.createQueryRunner();
    runners.add(runner);
    await runner.connect();
    const [{ pid }] = (await runner.query(
      'SELECT pg_backend_pid() AS pid',
    )) as Array<{ pid: number }>;
    return { runner, pid };
  }
  function repositories(runner: QueryRunner) {
    const scopedSource = {
      transaction: <T>(work: (manager: EntityManager) => Promise<T>) => {
        const operation = (async () => {
          await runner.startTransaction();
          try {
            const result = await work(runner.manager);
            await runner.commitTransaction();
            return result;
          } catch (error) {
            if (runner.isTransactionActive) await runner.rollbackTransaction();
            throw error;
          }
        })();
        pendingTransactions.add(operation);
        const settled = () => {
          pendingTransactions.delete(operation);
        };
        void operation.then(settled, settled);
        return operation;
      },
    } as DataSource;
    return {
      reset: new PasswordResetTokenRepository(
        source.getRepository(PasswordResetToken),
        scopedSource,
      ),
      sessions: new AuthSessionRepository(
        source.getRepository(AuthSession),
        scopedSource,
      ),
    };
  }
  async function waitForLock(pid: number, blockingPid: number) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const [{ blocked }] = await source.query<Array<{ blocked: boolean }>>(
        `WITH RECURSIVE blocking_chain(pid, visited) AS (
           SELECT $1::integer, ARRAY[$1::integer]
           UNION ALL
           SELECT blocker.pid, chain.visited || blocker.pid
           FROM blocking_chain chain
           CROSS JOIN LATERAL unnest(pg_blocking_pids(chain.pid)) AS blocker(pid)
           WHERE NOT blocker.pid = ANY(chain.visited)
             AND cardinality(chain.visited) < 16
         )
         SELECT EXISTS (
           SELECT 1 FROM blocking_chain
           WHERE pid = $2::integer AND cardinality(visited) > 1
         ) AS blocked`,
        [pid, blockingPid],
      );
      if (blocked) return;
    }
    throw new Error('Expected lock barrier was not observed.');
  }
  async function blocker() {
    const locked = await connection();
    await locked.runner.startTransaction();
    blockers.add(locked.runner);
    await locked.runner.query(
      'SELECT id FROM usuario WHERE id = $1 FOR UPDATE',
      [userId],
    );
    return locked;
  }
  async function assertRevoked() {
    expect(
      (
        await source
          .getRepository(AuthSession)
          .findOneByOrFail({ id: sessionId })
      ).revokedAt,
    ).not.toBeNull();
    const tokens = await source
      .getRepository(PasswordResetToken)
      .findBy({ userId });
    expect(
      tokens.every(
        (token) => token.usedAt !== null || token.invalidatedAt !== null,
      ),
    ).toBe(true);
    expect(
      tokens.every((token) => !(token.usedAt && token.invalidatedAt)),
    ).toBe(true);
  }
  function sessionInput(expectedPasswordHash = 'old-hash') {
    return {
      id: randomUUID(),
      userId,
      expectedPasswordHash,
      policy: { idleSeconds: 900, absoluteSeconds: 43200, version: 1 },
      issue: async (now: Date, absolute: Date) => ({
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        refreshTokenHash: 'new-refresh',
        expiresAt: new Date(
          Math.min(now.getTime() + 60000, absolute.getTime()),
        ),
      }),
      maxActiveSessions: 5,
    } as const;
  }

  it.each([false, true])(
    'serializes same and sibling token consumers (siblings=%s)',
    async (siblings) => {
      const locked = await blocker();
      const left = await connection();
      const right = await connection();
      expect(new Set([locked.pid, left.pid, right.pid]).size).toBe(3);
      const first = repositories(left.runner).reset.consumeAndResetPassword(
        firstHash,
        'new-hash',
      );
      const second = repositories(right.runner).reset.consumeAndResetPassword(
        siblings ? secondHash : firstHash,
        'other-hash',
      );
      // Attach rejection handlers immediately, including the barrier failure path.
      const results = Promise.allSettled([first, second]);
      try {
        await waitForLock(left.pid, locked.pid);
        await waitForLock(right.pid, locked.pid);
        await locked.runner.commitTransaction();
        const outcomes = await results;
        expect(
          outcomes.filter((outcome) => outcome.status === 'rejected'),
        ).toEqual([]);
        expect(
          outcomes.filter(
            (outcome) =>
              outcome.status === 'fulfilled' && outcome.value !== null,
          ),
        ).toHaveLength(1);
        await assertRevoked();
      } finally {
        if (locked.runner.isTransactionActive)
          await locked.runner.rollbackTransaction();
        await results;
      }
    },
  );

  it('rejects a stale login password snapshot after the password-change commit', async () => {
    const locked = await blocker();
    const login = await connection();
    const result = repositories(login.runner)
      .sessions.createSession(sessionInput())
      .catch((error: unknown) => error);
    await waitForLock(login.pid, locked.pid);
    await locked.runner.manager.update(
      User,
      { id: userId },
      { senhaHash: 'new-hash' },
    );
    await locked.runner.commitTransaction();
    expect(await result).toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    expect(await source.getRepository(AuthSession).countBy({ userId })).toBe(1);
  });

  it('refuses recovery issuance based on a stale password snapshot', async () => {
    const locked = await blocker();
    const issuance = await connection();
    const result = repositories(issuance.runner).reset.createToken(
      { id: randomUUID(), userId, tokenHash: 'a'.repeat(64) },
      'old-hash',
      60,
    );
    await waitForLock(issuance.pid, locked.pid);
    await locked.runner.manager.update(
      User,
      { id: userId },
      { senhaHash: 'new-hash' },
    );
    await locked.runner.commitTransaction();
    expect(await result).toBeNull();
    expect(
      await source.getRepository(PasswordResetToken).countBy({ userId }),
    ).toBe(2);
  });

  it('does not rotate or restore a session revoked while refresh waits', async () => {
    const locked = await blocker();
    const refresh = await connection();
    const result = repositories(
      refresh.runner,
    ).sessions.rotateIfActiveWithMatchingToken(
      sessionId,
      userId,
      'refresh-hash',
      async (now, absolute) => ({
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        refreshTokenHash: 'next-hash',
        expiresAt: new Date(
          Math.min(now.getTime() + 60000, absolute.getTime()),
        ),
      }),
    );
    await waitForLock(refresh.pid, locked.pid);
    await locked.runner.manager.update(
      AuthSession,
      { id: sessionId },
      { revokedAt: new Date() },
    );
    await locked.runner.commitTransaction();
    expect(await result).toMatchObject({ failure: 'AUTH_SESSION_REVOKED' });
    expect(
      (
        await source
          .getRepository(AuthSession)
          .findOneByOrFail({ id: sessionId })
      ).refreshTokenHash,
    ).toBe('refresh-hash');
  });

  it('queries the real credential clock only after the blocked user lock completes', async () => {
    const locked = await blocker();
    const reset = await connection();
    const trace: string[] = [];
    const executeQuery = reset.runner.query.bind(reset.runner) as (
      sql: string,
      parameters?: unknown[],
      structured?: boolean,
    ) => Promise<unknown>;
    const spy = jest
      .spyOn(reset.runner, 'query')
      .mockImplementation(
        (sql: string, parameters?: unknown[], structured?: boolean) => {
          const locksUser = /FOR UPDATE/i.test(sql);
          if (locksUser) trace.push('lock-requested');
          if (sql.includes('clock_timestamp')) trace.push('clock-queried');
          return executeQuery(sql, parameters, structured).then((result) => {
            if (locksUser) trace.push('lock-acquired');
            return result;
          });
        },
      );
    const result = repositories(reset.runner).reset.consumeAndResetPassword(
      firstHash,
      'new-hash',
      new Date(0),
    );
    try {
      await waitForLock(reset.pid, locked.pid);
      expect(trace).toEqual(['lock-requested']);
      // This fixture proves expiry rejection separately, not natural elapsed-time expiry.
      await locked.runner.query(
        'UPDATE password_reset_token SET expires_at = $2 WHERE token_hash = $1',
        [firstHash, new Date(0)],
      );
      await locked.runner.commitTransaction();
      expect(await result).toBeNull();
      expect(trace).toEqual([
        'lock-requested',
        'lock-acquired',
        'lock-requested',
        'lock-acquired',
        'lock-requested',
        'lock-acquired',
        'clock-queried',
      ]);
      expect(
        (await source.getRepository(User).findOneByOrFail({ id: userId }))
          .senhaHash,
      ).toBe('old-hash');
    } finally {
      spy.mockRestore();
    }
  });

  it('changes an authenticated password and invalidates all previous credentials', async () => {
    const change = await connection();
    await repositories(change.runner).reset.changeAuthenticatedPassword(
      userId,
      sessionId,
      'old-hash',
      'new-hash',
    );
    await assertRevoked();
    expect(
      (await source.getRepository(User).findOneByOrFail({ id: userId }))
        .senhaHash,
    ).toBe('new-hash');
    const login = await connection();
    await expect(
      repositories(login.runner).sessions.createSession(
        sessionInput('new-hash'),
      ),
    ).resolves.toHaveProperty('access_token');
  });

  it('rolls back consumption, sibling invalidation and password on session write failure', async () => {
    const reset = await connection();
    await source.query(
      `CREATE FUNCTION credential_stage1_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected session failure'; END $$`,
    );
    // userId is a locally generated UUID, not request input.
    await source.query(
      `CREATE TRIGGER credential_stage1_fault BEFORE UPDATE ON auth_session FOR EACH ROW WHEN (NEW.usuario_id = '${userId}'::uuid) EXECUTE FUNCTION credential_stage1_fault()`,
    );
    try {
      await expect(
        repositories(reset.runner).reset.consumeAndResetPassword(
          firstHash,
          'new-hash',
        ),
      ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    } finally {
      await source.query(
        'DROP TRIGGER credential_stage1_fault ON auth_session',
      );
      await source.query('DROP FUNCTION credential_stage1_fault()');
    }
    expect(
      (await source.getRepository(User).findOneByOrFail({ id: userId }))
        .senhaHash,
    ).toBe('old-hash');
    expect(
      (
        await source
          .getRepository(AuthSession)
          .findOneByOrFail({ id: sessionId })
      ).revokedAt,
    ).toBeNull();
    expect(
      (await source.getRepository(PasswordResetToken).findBy({ userId })).every(
        (token) => !token.usedAt && !token.invalidatedAt,
      ),
    ).toBe(true);
  });

  it('does not block or alter unrelated users', async () => {
    const otherUserId = randomUUID();
    await source.getRepository(User).save({
      id: otherUserId,
      nome: 'Other',
      email: `${otherUserId}@example.com`,
      senhaHash: 'other-hash',
    });
    const locked = await blocker();
    const other = await connection();
    const created = await repositories(other.runner).sessions.createSession({
      ...sessionInput('other-hash'),
      userId: otherUserId,
    });
    expect(created.access_token).toBe('test-access');
    expect(
      await source.getRepository(AuthSession).countBy({ userId: otherUserId }),
    ).toBe(1);
    await locked.runner.commitTransaction();
    expect(
      (await source.getRepository(User).findOneByOrFail({ id: otherUserId }))
        .senhaHash,
    ).toBe('other-hash');
    expect(
      (await source.getRepository(User).findOneByOrFail({ id: userId }))
        .senhaHash,
    ).toBe('old-hash');
  });
});
