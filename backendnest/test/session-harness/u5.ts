import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { AuthSession } from '../../src/auth/entities/auth-session.entity';
import { User } from '../../src/users/entities/user.entity';
import { AuthSessionRepository } from '../../src/auth/repositories/auth-session.repository';
import { decodeSessionCursor } from '../../src/auth/dto/session-management.dto';
const { identity, initializeAuthority } = require('./contract.cjs');
const root = process.env.SESSION_HARNESS_ARTIFACTS!;
const source = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  entities: [User, AuthSession],
  synchronize: false,
  extra: {
    max: 8,
    connectionTimeoutMillis: 3000,
    query_timeout: 7000,
    application_name: 'u5-repository-proof',
  },
});
const proof = {
  status: 'NOT RUN',
  cases: [] as Array<{
    name: string;
    status: string;
    evidence?: unknown;
    error?: string;
  }>,
  http: [] as Array<{ path: string; status: number; code?: string }>,
  lockAdmissions: [] as Array<{
    holder: number;
    requested: number;
    graph: unknown[];
  }>,
  limits: {
    startupMs: 120000,
    goalsMs: 180000,
    httpMs: 12000,
    account: '5 reserved attempts/60 seconds',
    routeIp: '20/minute',
    browser: 'NOT RUN',
  },
  cleanup: {} as Record<string, boolean>,
  elapsedMs: 0,
  error: '',
  sourceManifestSha256: '',
};
const began = Date.now();
const pendingOperations = new Set<Promise<unknown>>();
function tracked<T>(operation: Promise<T>): Promise<T> {
  pendingOperations.add(operation);
  void operation.then(
    () => pendingOperations.delete(operation),
    () => pendingOperations.delete(operation),
  );
  return operation;
}
const adapter = {
  query: async (sql: string, args?: unknown[]) => ({
    rows: await source.query(sql, args),
  }),
};
let repository: AuthSessionRepository;
async function caseOf(name: string, work: () => Promise<unknown>) {
  assert.ok(Date.now() - began < 180000, 'U5 goals cap');
  const result = {
    name,
    status: 'FAIL',
    evidence: undefined as unknown,
    error: undefined as string | undefined,
  };
  proof.cases.push(result);
  try {
    result.evidence = await work();
    result.status = 'PASS';
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown failure';
    throw error;
  }
}
async function request(path: string, token?: string, body?: unknown) {
  assert.ok(proof.http.length < 45, 'bounded actual HTTP count');
  const response = await fetch('http://127.0.0.1:4318' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  // Test-only evidence contains no credentials, passwords or raw target identifiers.
  proof.http.push({
    path: path.replace(/\/sessions\/[^/?]+\/revoke/, '/sessions/:id/revoke'),
    status: response.status,
    code: payload?.error?.code,
  });
  return { status: response.status, payload, text, headers: response.headers };
}
async function login(email: string) {
  const response = await request('/auth/login', undefined, {
    email,
    senha: 'U4-disposable-password-42!',
  });
  assert.equal(response.status, 200);
  const data = response.payload.data;
  const claims = JSON.parse(
    Buffer.from(data.access_token.split('.')[1], 'base64url').toString('utf8'),
  );
  const [row] = await source.query(
    'SELECT usuario_id FROM auth_session WHERE id=$1::uuid',
    [claims.sid],
  );
  assert.equal(row.usuario_id, claims.sub);
  return {
    access: data.access_token as string,
    refresh: data.refresh_token as string,
    user: claims.sub as string,
    sid: claims.sid as string,
  };
}
async function fixture(count = 2) {
  await identity(adapter);
  const id = randomUUID();
  const [base] = await source.query('SELECT senha_hash FROM usuario LIMIT 1');
  await source.query(
    'INSERT INTO usuario(id,nome,email,senha_hash) VALUES($1,$2,$3,$4)',
    [id, 'U5 repository fixture', `${id}@example.com`, base.senha_hash],
  );
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const sid = randomUUID();
    ids.push(sid);
    await repository.createSession({
      id: sid,
      userId: id,
      expectedPasswordHash: base.senha_hash,
      maxActiveSessions: 30,
      policy: { idleSeconds: 900, absoluteSeconds: 43200, version: 1 },
      issue: async (now, absolute) => ({
        access_token: 'synthetic-repository-only',
        refresh_token: 'synthetic-repository-only',
        refreshTokenHash: 'before',
        expiresAt: absolute,
      }),
    });
  }
  return {
    user: id,
    caller: ids[0],
    target: ids[1],
    ids,
    hash: base.senha_hash as string,
  };
}
async function raw(sid: string) {
  return (
    await source.query(
      'SELECT authenticated_at::text,last_activity_at::text,absolute_expires_at::text,refresh_expires_at::text,last_used_at::text,updated_at::text,revoked_at::text,terminal_reason FROM auth_session WHERE id=$1::uuid',
      [sid],
    )
  )[0];
}
async function waited(pid: number, minimum = 1) {
  const start = Date.now();
  for (;;) {
    const rows: Array<{ pid: number; blockers: number[]; wait: string }> =
      await source.query(
        "SELECT pid,pg_blocking_pids(pid) AS blockers,wait_event_type AS wait FROM pg_stat_activity WHERE application_name='u5-repository-proof' AND datname=current_database()",
      );
    const chain = (
      candidate: number,
      visited: number[] = [],
    ): number[] | null => {
      if (candidate === pid) return [pid];
      if (visited.includes(candidate) || visited.length >= 12) return null;
      const row = rows.find((value) => value.pid === candidate);
      for (const blocker of row?.blockers ?? []) {
        const tail = chain(blocker, [...visited, candidate]);
        if (tail) return [candidate, ...tail];
      }
      return null;
    };
    const graph = rows
      .filter((row) => row.pid !== pid && row.wait === 'Lock')
      .map((row) => ({
        pid: row.pid,
        blockers: row.blockers,
        chain: chain(row.pid),
      }))
      .filter((row) => row.chain !== null);
    if (graph.length >= minimum) {
      proof.lockAdmissions.push({ holder: pid, requested: minimum, graph });
      return graph.length;
    }
    if (Date.now() - start >= 2000)
      proof.lockAdmissions.push({ holder: pid, requested: minimum, graph });
    assert.ok(
      Date.now() - start < 2000,
      'actual pending PostgreSQL lock admission required',
    );
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}
async function withLock(
  user: string,
  session: string | null,
  work: (pid: number, release: () => Promise<void>) => Promise<unknown>,
) {
  const lock = source.createQueryRunner();
  await lock.connect();
  try {
    await lock.startTransaction();
    const [pid] = await lock.query('SELECT pg_backend_pid() AS pid');
    if (session)
      await lock.query(
        'SELECT id FROM auth_session WHERE id=$1::uuid AND usuario_id=$2::uuid FOR UPDATE',
        [session, user],
      );
    else
      await lock.query('SELECT id FROM usuario WHERE id=$1::uuid FOR UPDATE', [
        user,
      ]);
    let released = false;
    const timer = setTimeout(() => {
      if (!released) void lock.rollbackTransaction().catch(() => {});
    }, 3000);
    try {
      return await work(pid.pid, async () => {
        await lock.commitTransaction();
        released = true;
      });
    } finally {
      clearTimeout(timer);
      if (lock.isTransactionActive) await lock.rollbackTransaction();
    }
  } finally {
    await lock.release();
  }
}
async function main() {
  await source.initialize();
  repository = new AuthSessionRepository(
    source.getRepository(AuthSession),
    source,
  );
  try {
    await initializeAuthority(adapter);
    await caseOf('migration-budget-and-index', async () => {
      const [columns] = await source.query(
        "SELECT count(*)::integer AS n FROM information_schema.columns WHERE table_name='auth_session_reauthentication'",
      );
      assert.equal(columns.n, 3);
      const [index] = await source.query(
        "SELECT indexdef FROM pg_indexes WHERE indexname='auth_session_owner_authenticated_idx'",
      );
      assert.match(
        index.indexdef,
        /usuario_id, authenticated_at DESC, id DESC/,
      );
      const constraints = await source.query(
        "SELECT contype,confdeltype FROM pg_constraint WHERE conrelid='auth_session_reauthentication'::regclass",
      );
      assert.ok(
        constraints.some(
          (row: any) => row.contype === 'f' && row.confdeltype === 'c',
        ),
      );
      assert.ok(constraints.some((row: any) => row.contype === 'p'));
      return { columns: columns.n, ownerCascade: true, ownerKeysetIndex: true };
    });
    const a = await login('current-1@example.com'),
      remote = await login('current-1@example.com');
    const global = await login('current-2@example.com'),
      globalRemote = await login('current-2@example.com');
    const foreign = await login('current-3@example.com');
    await caseOf('real-http-owner-list-no-touch-and-validation', async () => {
      const before = await raw(a.sid);
      const result = await request('/auth/sessions', a.access);
      assert.equal(result.status, 200);
      assert.equal(result.headers.get('cache-control'), 'no-store');
      const data = result.payload.data;
      assert.equal(data.items.length, 2);
      assert.equal(data.items.filter((row: any) => row.isCurrent).length, 1);
      assert.equal(data.items.find((row: any) => row.isCurrent).id, a.sid);
      for (const item of data.items)
        assert.deepEqual(
          Object.keys(item).sort(),
          [
            'absoluteExpiresAt',
            'authenticatedAt',
            'clientDescription',
            'id',
            'idleExpiresAt',
            'isCurrent',
            'lastActivityAt',
          ].sort(),
        );
      assert.equal(data.nextCursor, null);
      for (const path of [
        '/auth/sessions?limit=21',
        '/auth/sessions?cursor=!bad',
        '/auth/sessions?cursor=' +
          Buffer.from(
            JSON.stringify(['0000-01-01T12:00:00.000000Z', a.sid]),
          ).toString('base64url'),
        '/auth/sessions?usuarioId=x',
      ])
        assert.equal((await request(path, a.access)).status, 400);
      assert.equal(
        (
          await request('/auth/sessions/not-uuid/revoke', a.access, {
            senhaAtual: 'password',
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(`/auth/sessions/${remote.sid}/revoke`, a.access, {
            senhaAtual: 'password',
            usuarioId: foreign.user,
          })
        ).status,
        400,
      );
      assert.deepEqual(await raw(a.sid), before);
      return {
        own: 2,
        currentMarker: true,
        noTouch: true,
        malformedExtra: 400,
      };
    });
    await caseOf(
      'real-http-password-remote-idor-idempotence-and-shared-account-budget',
      async () => {
        assert.equal(
          (
            await request(`/auth/sessions/${remote.sid}/revoke`, a.access, {
              senhaAtual: 'wrong-U5-secret',
            })
          ).payload.error.code,
          'AUTH_CURRENT_PASSWORD_INVALID',
        );
        assert.equal((await request('/auth/session', a.access)).status, 200);
        for (const sid of [remote.sid, remote.sid, foreign.sid, randomUUID()]) {
          const result = await request(
            `/auth/sessions/${sid}/revoke`,
            a.access,
            { senhaAtual: 'U4-disposable-password-42!' },
          );
          assert.equal(result.status, 204);
          assert.equal(result.text, '');
          assert.equal(result.headers.get('cache-control'), 'no-store');
        }
        assert.equal(
          (await request('/auth/session', remote.access)).payload.error.code,
          'AUTH_SESSION_REVOKED',
        );
        assert.equal(
          (await request('/auth/session', foreign.access)).status,
          200,
        );
        const limit = await request('/auth/sessions/revoke-all', a.access, {
          senhaAtual: 'U4-disposable-password-42!',
        });
        assert.equal(limit.status, 429);
        assert.equal(limit.payload.error.code, 'AUTH_REAUTHENTICATION_LIMIT');
        assert.equal((await request('/auth/session', a.access)).status, 200);
        assert.equal(
          (
            await source.query(
              'SELECT attempts FROM auth_session_reauthentication WHERE usuario_id=$1',
              [a.user],
            )
          )[0].attempts,
          5,
        );
        return {
          selected: 204,
          repeated: 204,
          foreign: 204,
          nonexistent: 204,
          callerRetained: true,
          sharedQuota: 429,
          reservations: 5,
        };
      },
    );
    await caseOf(
      'real-http-global-includes-current-and-live-jwt-refresh-denial',
      async () => {
        const result = await request(
          '/auth/sessions/revoke-all',
          global.access,
          { senhaAtual: 'U4-disposable-password-42!' },
        );
        assert.equal(result.status, 204);
        assert.equal(result.text, '');
        for (const owner of [global, globalRemote])
          assert.equal(
            (await request('/auth/session', owner.access)).payload.error.code,
            'AUTH_SESSION_REVOKED',
          );
        assert.equal(
          (
            await request('/auth/refresh', undefined, {
              refreshToken: global.refresh,
            })
          ).payload.error.code,
          'AUTH_SESSION_REVOKED',
        );
        assert.equal(
          (
            await request('/auth/sessions/revoke-all', global.access, {
              senhaAtual: 'U4-disposable-password-42!',
            })
          ).status,
          401,
        );
        return {
          empty204: true,
          includedCurrent: true,
          stillSignedJWTDenied: true,
          refreshDenied: true,
          terminalRepeat: 401,
        };
      },
    );
    await caseOf('real-audit-no-session-id-or-password', async () => {
      const response = await request(
        `/auth/sessions/${remote.sid}/revoke`,
        global.access,
        { senhaAtual: 'U5-never-log-this-password' },
      );
      assert.equal(response.status, 401);
      const start = Date.now();
      let rows: any[] = [];
      while (!rows.length) {
        rows = await source.query(
          "SELECT route,details,message FROM audit_log WHERE route='/auth/sessions/:id/revoke'",
        );
        assert.ok(Date.now() - start < 2000, 'real persisted audit required');
        if (!rows.length)
          await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const logs = JSON.stringify(rows);
      for (const secret of [
        remote.sid,
        global.sid,
        'U5-never-log-this-password',
        global.access,
        global.refresh,
      ])
        assert.ok(!logs.includes(secret));
      return {
        persisted: true,
        parameterizedRoute: true,
        noCredentialOrTarget: true,
      };
    });
    await caseOf(
      'owner-keyset-pages-over-five-with-microsecond-ties',
      async () => {
        const f = await fixture(26);
        await source.query(
          "UPDATE auth_session SET authenticated_at=clock_timestamp()-interval '1 second', last_activity_at=clock_timestamp()-interval '1 second' WHERE usuario_id=$1",
          [f.user],
        );
        // Distinct sub-millisecond positions must survive cursor serialization.
        await source.query(
          "UPDATE auth_session SET authenticated_at=date_trunc('milliseconds',authenticated_at)+(row.n * interval '1 microsecond'), last_activity_at=date_trunc('milliseconds',last_activity_at)+interval '1 millisecond' FROM (SELECT id,row_number() OVER (ORDER BY id) AS n FROM auth_session WHERE usuario_id=$1) row WHERE auth_session.id=row.id",
          [f.user],
        );
        const before = await raw(f.caller);
        const first = await repository.listOwnSessions(f.user, f.caller, {
          limit: 20,
        });
        assert.equal(first.items.length, 20);
        assert.ok(first.nextCursor);
        const second = await repository.listOwnSessions(f.user, f.caller, {
          limit: 20,
          cursor: decodeSessionCursor(first.nextCursor!),
        });
        assert.equal(second.items.length, 6);
        assert.equal(second.nextCursor, null);
        const all = [...first.items, ...second.items];
        assert.equal(new Set(all.map((row) => row.id)).size, 26);
        assert.equal(all.filter((row) => row.isCurrent).length, 1);
        assert.deepEqual(await raw(f.caller), before);
        const cursor = decodeSessionCursor(first.nextCursor!)!;
        assert.equal(
          cursor.authenticatedAt,
          first.items.at(-1)!.authenticatedAt,
        );
        return {
          configuredRepositoryLimit: 30,
          rows: 26,
          pages: [20, 6],
          microsecondCursor: true,
          noTouch: true,
        };
      },
    );
    await caseOf(
      'concurrent-reservations-bounded-and-window-renews',
      async () => {
        const f = await fixture();
        const results = await Promise.allSettled(
          Array.from({ length: 7 }, () =>
            repository.reserveSessionReauthentication(f.user, f.caller),
          ),
        );
        assert.equal(
          results.filter((row) => row.status === 'fulfilled').length,
          5,
        );
        for (const row of results.filter(
          (row) => row.status === 'rejected',
        ) as PromiseRejectedResult[])
          assert.equal(row.reason.code, 'AUTH_REAUTHENTICATION_LIMIT');
        await identity(adapter);
        await source.query(
          "UPDATE auth_session_reauthentication SET window_started_at=clock_timestamp()-interval '60 seconds' WHERE usuario_id=$1",
          [f.user],
        );
        assert.equal(
          await repository.reserveSessionReauthentication(f.user, f.caller),
          f.hash,
        );
        assert.equal(
          (
            await source.query(
              'SELECT attempts FROM auth_session_reauthentication WHERE usuario_id=$1',
              [f.user],
            )
          )[0].attempts,
          1,
        );
        return { concurrent: 7, reserved: 5, rejected: 2, nextWindow: 1 };
      },
    );
    await caseOf(
      'revoked-caller-and-password-change-fence-the-effect',
      async () => {
        const f = await fixture();
        const before = await raw(f.target);
        await repository.revoke(f.caller, f.user);
        await assert.rejects(
          repository.revokeOwnSessions(f.user, f.caller, f.hash, f.target),
          (e: any) => e.code === 'AUTH_SESSION_REVOKED',
        );
        assert.deepEqual(await raw(f.target), before);
        const g = await fixture();
        const hash = await repository.reserveSessionReauthentication(
          g.user,
          g.caller,
        );
        await source.query('UPDATE usuario SET senha_hash=$2 WHERE id=$1', [
          g.user,
          'changed-after-password-comparison',
        ]);
        await assert.rejects(
          repository.revokeOwnSessions(g.user, g.caller, hash, g.target),
          (e: any) => e.code === 'AUTH_CURRENT_PASSWORD_INVALID',
        );
        assert.equal((await raw(g.target)).revoked_at, null);
        return {
          revokedCallerCannotEffect: true,
          changedHashCannotEffect: true,
        };
      },
    );
    await caseOf('clock-after-last-lock-and-terminal-commit', async () => {
      const f = await fixture();
      await source.query(
        "UPDATE auth_session SET authenticated_at=clock_timestamp()-interval '901 seconds',last_activity_at=clock_timestamp()-interval '899.5 seconds' WHERE id=$1",
        [f.caller],
      );
      let observed = 0;
      await withLock(f.user, f.caller, async (pid, release) => {
        const pending = tracked(
          repository.revokeOwnSessions(f.user, f.caller, f.hash, f.target).then(
            () => ({ code: 'unexpected-success' }),
            (e: any) => ({ code: e.code }),
          ),
        );
        observed = await waited(pid);
        for (;;) {
          const [row] = await source.query(
            "SELECT clock_timestamp() >= last_activity_at + interval '900 seconds' AS expired FROM auth_session WHERE id=$1",
            [f.caller],
          );
          if (row.expired) break;
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
        await release();
        assert.equal((await pending).code, 'AUTH_SESSION_IDLE_EXPIRED');
      });
      assert.equal(
        (await raw(f.caller)).terminal_reason,
        'AUTH_SESSION_IDLE_EXPIRED',
      );
      assert.equal((await raw(f.target)).revoked_at, null);
      return {
        actualLockWaiters: observed,
        elapsedDeadlineDenied: true,
        terminalCommitted: true,
        targetUnchanged: true,
      };
    });
    await caseOf('refresh-before-and-after-revocation', async () => {
      const f = await fixture();
      const rotate = () =>
        repository.rotateIfActiveWithMatchingToken(
          f.target,
          f.user,
          'before',
          async (_now, absolute) => ({
            access_token: 'synthetic',
            refresh_token: 'synthetic',
            refreshTokenHash: 'after',
            expiresAt: absolute,
          }),
        );
      assert.ok('tokens' in (await rotate()));
      await repository.revokeOwnSessions(f.user, f.caller, f.hash, f.target);
      assert.equal(((await rotate()) as any).failure, 'AUTH_SESSION_REVOKED');
      const g = await fixture();
      let observed = 0;
      await withLock(g.user, null, async (pid, release) => {
        const revoke = tracked(
          repository.revokeOwnSessions(g.user, g.caller, g.hash, g.target),
        );
        observed = await waited(pid);
        const refresh = tracked(
          repository.rotateIfActiveWithMatchingToken(
            g.target,
            g.user,
            'before',
            async (_now, absolute) => ({
              access_token: 'synthetic',
              refresh_token: 'synthetic',
              refreshTokenHash: 'after',
              expiresAt: absolute,
            }),
          ),
        );
        await waited(pid, 2);
        await release();
        await revoke;
        assert.equal(((await refresh) as any).failure, 'AUTH_SESSION_REVOKED');
      });
      return {
        rotateFirstThenRevoke: true,
        queuedRevokeThenRefreshDenied: true,
        actualWaiters: observed,
      };
    });
    await caseOf(
      'global-user-lock-orders-a-later-login-without-permanent-epoch',
      async () => {
        const f = await fixture();
        let newId = randomUUID(),
          observed = 0;
        await withLock(f.user, null, async (pid, release) => {
          const revoke = tracked(
            repository.revokeOwnSessions(f.user, f.caller, f.hash),
          );
          observed = await waited(pid);
          const laterLogin = tracked(
            repository.createSession({
              id: newId,
              userId: f.user,
              expectedPasswordHash: f.hash,
              maxActiveSessions: 5,
              policy: { idleSeconds: 900, absoluteSeconds: 43200, version: 1 },
              issue: async (_now, absolute) => ({
                access_token: 'synthetic',
                refresh_token: 'synthetic',
                refreshTokenHash: 'after',
                expiresAt: absolute,
              }),
            }),
          );
          await waited(pid, 2);
          await release();
          await revoke;
          await laterLogin;
        });
        assert.ok((await raw(f.caller)).revoked_at);
        assert.ok((await raw(f.target)).revoked_at);
        await repository.authorize(newId, f.user, false);
        return {
          existingRevoked: true,
          laterOrderedLoginAllowed: true,
          actualWaiters: observed,
        };
      },
    );
    proof.status = 'PASS';
  } catch (error) {
    proof.status = 'FAIL';
    proof.error = error instanceof Error ? error.message : 'Unknown failure';
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([...pendingOperations]);
    proof.cleanup.pendingOperationsSettled = pendingOperations.size === 0;
    await source.destroy();
    proof.cleanup.connectionsClosed = true;
    proof.elapsedMs = Date.now() - began;
    proof.sourceManifestSha256 = createHash('sha256')
      .update(readFileSync(join(root, 'candidate.json')))
      .digest('hex');
    writeFileSync(join(root, 'u5-proof.json'), JSON.stringify(proof, null, 2), {
      flag: 'wx',
    });
    console.log(
      JSON.stringify({
        status: proof.status,
        cases: proof.cases.length,
        elapsedMs: proof.elapsedMs,
      }),
    );
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'U5 cleanup failed');
  process.exitCode = 1;
});
