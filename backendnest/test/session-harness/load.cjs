const assert = require('node:assert/strict');

function summarize(records) {
  const statuses = {
    200: 0,
    401: 0,
    429: 0,
    500: 0,
    other: 0,
    'network-error': 0,
  };
  for (const r of records)
    statuses[Object.hasOwn(statuses, r.status) ? r.status : 'other']++;
  const latency = records.map((r) => r.latencyMs).sort((a, b) => a - b);
  const pct = (p) =>
    latency.length ? latency[Math.ceil(latency.length * p) - 1] : null;
  return {
    statuses,
    p50: pct(0.5),
    p95: pct(0.95),
    p99: pct(0.99),
    samples: records.length,
  };
}
function assertHealthy(r, expected) {
  assert.equal(r.status, 200, 'authorized request must reach real auth');
  assert.equal(r.user, expected.user);
  assert.equal(r.sid, expected.sid);
  assert.equal(r.cacheControl, 'no-store');
  assert.deepEqual(r.headerState, r.state);
  assert.equal(r.state.policyVersion, 1);
  for (const key of ['idleExpiresAt', 'absoluteExpiresAt'])
    assert.equal(r.state[key], expected[key]);
  assert.ok(Number.isFinite(Date.parse(r.state.serverNow)));
  assert.ok(Date.parse(r.state.serverNow) < Date.parse(expected.idleExpiresAt));
  assert.ok(
    Date.parse(r.state.serverNow) < Date.parse(expected.absoluteExpiresAt),
  );
}
function assertAdmission(s, minimumWaits, otherRequired) {
  assert.ok(
    s.lockWaits >= minimumWaits && s.awaitingLocks >= 1 && s.directBlocked >= 1,
    'real pending DB lock admission required',
  );
  assert.equal(s.targetPending, true);
  assert.ok(
    s.otherCompleted >= otherRequired,
    'unrelated users must progress before target release',
  );
}
function assertNoRenewal(before, after, reason) {
  if (!reason || before.revoked_at) return assert.deepEqual(after, before);
  assert.ok(after.revoked_at, 'terminal session must not revive');
  assert.equal(after.terminal_reason, reason);
  for (const k of Object.keys(before).filter(
    (k) => !['updated_at', 'revoked_at', 'terminal_reason'].includes(k),
  ))
    assert.deepEqual(after[k], before[k], k);
}
module.exports = { summarize, assertHealthy, assertAdmission, assertNoRenewal };

async function main() {
  const fs = require('node:fs'),
    path = require('node:path'),
    crypto = require('node:crypto');
  const backend = path.resolve(__dirname, '../..');
  const { Client } = require(path.join(backend, 'node_modules/pg'));
  const jwt = require(path.join(backend, 'node_modules/jsonwebtoken'));
  const {
    BACKDATE_SQL,
    initializeAuthority,
    identity,
    clock,
    authority,
    assertFixture,
  } = require('./contract.cjs');
  const root = process.env.SESSION_HARNESS_ARTIFACTS;
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 3000,
    query_timeout: 1500,
  };
  const db = new Client(config),
    locker = new Client(config);
  const began = Date.now();
  const proof = {
    status: 'running',
    cases: [
      { case: 'C7', status: 'NOT RUN', records: [], locks: [], terminal: [] },
      { case: 'C8', status: 'NOT RUN', records: [], locks: [] },
    ],
    loginRecords: [],
    limits: {
      goalsMs: 120000,
      measurementMsPerProfile: 60000,
      requestsPerProfile: 20,
      concurrency: [2, 5],
      terminalRequests: 6,
      totalSessionGETs: 46,
      logins: 9,
      lockAdmissionMs: 2500,
      lockHoldCapMs: 3000,
      httpMs: 12000,
      throttle: 'unchanged 60/60000; login separate 10/min',
      productionCapacityAccepted: false,
    },
    scope:
      'Owned local HTTP same-account/many-account observations only. No concurrent-login pruning, natural expiry, production capacity, browser or mixed binary proof.',
    cleanup: {},
  };
  const safe = (r) => {
    const { state, headerState, ...record } = r;
    return record;
  };
  const row = async (f) =>
    (
      await db.query(
        `SELECT id,usuario_id,policy_version,idle_timeout_seconds,authenticated_at::text,absolute_expires_at::text,last_activity_at::text,refresh_expires_at::text,expires_at::text,last_used_at::text,created_at::text,updated_at::text,revoked_at::text,terminal_reason FROM auth_session WHERE id=$1::uuid AND usuario_id=$2::uuid`,
        [f.sid, f.user],
      )
    ).rows[0];
  let current,
    gets = 0,
    lockerPid;
  const budget = (start) => {
    assert.ok(Date.now() - began < 120000, 'combined goal cap');
    if (start) assert.ok(Date.now() - start < 60000, 'profile cap');
  };
  async function http(f, body) {
    const start = Date.now();
    if (!body) assert.ok(++gets <= 46, 'shared localhost GET budget');
    let result;
    try {
      const response = await fetch(
        'http://127.0.0.1:4318/auth/' + (body ? 'login' : 'session'),
        {
          method: body ? 'POST' : 'GET',
          headers: body
            ? { 'Content-Type': 'application/json' }
            : { Authorization: 'Bearer ' + f.token },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(12000),
        },
      );
      const json = await response.json(),
        state = json.data ?? json;
      result = {
        status: response.status,
        latencyMs: Date.now() - start,
        ...(f ? { user: f.user, sid: f.sid } : {}),
        cacheControl: response.headers.get('cache-control'),
        code: json.code ?? json.error?.code ?? json.data?.code ?? null,
      };
      if (!body) {
        result.state = state;
        const header = response.headers.get('x-session-state');
        result.headerState = header ? JSON.parse(header) : null;
      } else result.data = state;
    } catch {
      result = {
        status: 'network-error',
        latencyMs: Date.now() - start,
        ...(f ? { user: f.user, sid: f.sid } : {}),
      };
    }
    if (!body) current.records.push(safe(result));
    else
      proof.loginRecords.push({
        status: result.status,
        latencyMs: result.latencyMs,
      });
    return result;
  }
  async function login(i) {
    budget();
    assert.ok(proof.loginRecords.length < 9);
    const r = await http(null, {
      email: `current-${i}@example.com`,
      senha: 'U4-disposable-password-42!',
    });
    assert.equal(r.status, 200, 'real login required');
    const access = jwt.verify(
      r.data.access_token,
      process.env.JWT_ACCESS_SECRET,
      { algorithms: ['HS256'], issuer: process.env.JWT_ISSUER },
    );
    const refresh = jwt.verify(
      r.data.refresh_token,
      process.env.JWT_REFRESH_SECRET,
      { algorithms: ['HS256'], issuer: process.env.JWT_ISSUER },
    );
    assert.equal(access.tokenType, 'access');
    assert.equal(refresh.tokenType, 'refresh');
    assert.equal(access.sid, refresh.sid);
    assert.equal(access.sub, refresh.sub);
    assert.equal(access.exp - access.iat, 900);
    const persisted = (await authority(db)).instants.find(
      (r) => r.id === access.sid,
    );
    assertFixture(persisted);
    return { user: access.sub, sid: access.sid, token: r.data.access_token };
  }
  async function expected(f) {
    const r = await row(f);
    assert.ok(r);
    const idle = Math.min(
      Date.parse(r.last_activity_at) + 900000,
      Date.parse(r.absolute_expires_at),
      Date.parse(r.refresh_expires_at),
    );
    return {
      user: f.user,
      sid: f.sid,
      idleExpiresAt: new Date(idle).toISOString(),
      absoluteExpiresAt: new Date(r.absolute_expires_at).toISOString(),
    };
  }
  async function lockedBatch(kind, fixtures, many, reason) {
    const target = fixtures[0],
      before = await row(target),
      expectations = await Promise.all(fixtures.map(expected));
    await identity(db);
    await initializeAuthority(locker);
    const lockStarted = Date.now(),
      states = fixtures.map(() => ({ settled: false }));
    let pending = [];
    const evidence = {
      kind,
      concurrency: fixtures.length,
      user: target.user,
      sid: target.sid,
      samples: [],
      status: 'running',
    };
    current.locks.push(evidence);
    await locker.query('BEGIN');
    try {
      await locker.query(
        "SET LOCAL lock_timeout='1s'; SET LOCAL statement_timeout='1s'",
      );
      const locked =
        kind === 'user'
          ? await locker.query(
              'SELECT id FROM usuario WHERE id=$1::uuid FOR UPDATE',
              [target.user],
            )
          : await locker.query(
              'SELECT id FROM auth_session WHERE id=$1::uuid AND usuario_id=$2::uuid FOR UPDATE',
              [target.sid, target.user],
            );
      assert.equal(locked.rowCount, 1);
      pending = fixtures.map((f, i) =>
        http(f).then((r) => {
          states[i].settled = true;
          states[i].response = r;
          return r;
        }),
      );
      const minimumWaits = many ? 1 : fixtures.length,
        otherRequired = many ? fixtures.length - 1 : 0;
      let admitted = false;
      while (Date.now() - lockStarted < 2500) {
        const counts = (
          await db.query(
            `SELECT count(*) FILTER(WHERE a.wait_event_type='Lock')::int AS "lockWaits",count(*) FILTER(WHERE $1::integer=ANY(pg_blocking_pids(a.pid)))::int AS "directBlocked",(SELECT count(*)::int FROM pg_locks l JOIN pg_stat_activity p ON p.pid=l.pid WHERE p.datname=current_database() AND NOT l.granted AND l.pid<>$1::integer) AS "awaitingLocks" FROM pg_stat_activity a WHERE a.datname=current_database() AND a.pid<>pg_backend_pid() AND a.pid<>$1::integer`,
            [lockerPid],
          )
        ).rows[0];
        const sample = {
          elapsedMs: Date.now() - lockStarted,
          ...counts,
          targetPending: !states[0].settled,
          otherCompleted: many
            ? states
                .slice(1)
                .filter((s) => s.settled && s.response.status === 200).length
            : 0,
        };
        evidence.samples.push(sample);
        if (states[0].settled) break;
        try {
          assertAdmission(sample, minimumWaits, otherRequired);
          admitted = true;
          break;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 10)); // Poll cadence, not an admission assertion.
      }
      assert.equal(
        admitted,
        true,
        'lock/progress admission not observed within cap',
      );
      if (many)
        for (let i = 1; i < states.length; i++)
          assertHealthy(states[i].response, expectations[i]);
      assert.ok(
        Date.now() - lockStarted < 3000,
        'release before production 5s lock timeout',
      );
      await locker.query('ROLLBACK');
      evidence.releasedAfterMs = Date.now() - lockStarted;
      const responses = await Promise.all(pending);
      for (let i = 0; i < responses.length; i++) {
        const r = responses[i];
        if (reason) {
          assert.equal(r.status, 401);
          assert.equal(r.code, reason);
        } else assertHealthy(r, expectations[i]);
      }
      assertNoRenewal(before, await row(target), reason);
      evidence.status = 'PASS';
      evidence.noRenewal = true;
    } finally {
      await locker.query('ROLLBACK');
      evidence.releasedAfterMs ??= Date.now() - lockStarted;
      await Promise.allSettled(pending);
    }
  }
  try {
    await db.connect();
    await locker.connect();
    proof.initialClock = await initializeAuthority(db);
    await initializeAuthority(locker);
    lockerPid = (await locker.query('SELECT pg_backend_pid() AS pid')).rows[0]
      .pid;
    assert.notEqual(
      lockerPid,
      (await db.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    proof.independentPhysicalConnection = true;
    const accounts = [];
    for (let i = 1; i <= 6; i++) accounts.push(await login(i));
    const anchor = await clock(db);
    for (let i = 0; i < accounts.length; i++) {
      const f = accounts[i];
      await identity(db);
      assert.equal(
        (
          await db.query(BACKDATE_SQL, [
            f.sid,
            anchor.now,
            1200 + i,
            60 + i,
            false,
            f.user,
          ])
        ).rowCount,
        1,
      );
      assertFixture((await authority(db)).instants.find((r) => r.id === f.sid));
    }
    const beforeActive = await Promise.all(accounts.map(row));
    proof.identities = accounts.map(({ token, ...f }) => f);
    proof.identityEvidence =
      'Verified HS256 SID/sub joined to owned SQL row; distinct fixture deadlines matched in response body and X-Session-State. Response contract contains no SID/user fields; no identity headers added.';
    for (const many of [false, true]) {
      current = proof.cases[many ? 1 : 0];
      current.status = 'running';
      const start = Date.now();
      try {
        for (const concurrency of [2, 5]) {
          const fixtures = Array.from(
            { length: concurrency },
            (_, i) => accounts[many ? i : 0],
          );
          for (const kind of ['user', 'session']) {
            budget(start);
            await lockedBatch(kind, fixtures, many);
          }
          const remaining = 10 - 2 * concurrency;
          for (let offset = 0; offset < remaining; offset += concurrency) {
            budget(start);
            await Promise.all(
              Array.from(
                { length: Math.min(concurrency, remaining - offset) },
                async (_, i) => {
                  const f = accounts[many ? (offset + i) % accounts.length : 0];
                  assertHealthy(await http(f), await expected(f));
                },
              ),
            );
          }
        }
        assert.equal(current.records.length, 20);
        current.authorizedProfile = summarize(current.records);
        assert.deepEqual(await Promise.all(accounts.map(row)), beforeActive);
        current.activeRowsUnchanged = true;
        if (!many) {
          for (const [name, reason, age, activity] of [
            ['idle-expired', 'AUTH_SESSION_IDLE_EXPIRED', 1200, 960],
            ['absolute-expired', 'AUTH_SESSION_ABSOLUTE_EXPIRED', 43260, 120],
            ['revoked', 'AUTH_SESSION_REVOKED', 1200, 60],
          ]) {
            budget(start);
            const f = await login(6),
              now = await clock(db);
            await identity(db);
            assert.equal(
              (
                await db.query(BACKDATE_SQL, [
                  f.sid,
                  now.now,
                  age,
                  activity,
                  name === 'revoked',
                  f.user,
                ])
              ).rowCount,
              1,
            );
            assertFixture(
              (await authority(db)).instants.find((r) => r.id === f.sid),
            );
            await lockedBatch('session', [f, f], false, reason);
            const terminal = await row(f);
            assert.equal(terminal.terminal_reason, reason);
            assert.ok(terminal.revoked_at);
            current.terminal.push({
              name,
              user: f.user,
              sid: f.sid,
              requests: 2,
              status: 401,
              reason,
              noRevival: true,
              noRenewal: true,
            });
          }
        }
        budget(start);
        current.status = 'PASS';
      } catch (e) {
        current.status = 'FAIL';
        throw e;
      } finally {
        current.elapsedMs = Date.now() - start;
        current.allRequests = summarize(current.records);
      }
    }
    assert.equal(gets, 46);
    assert.equal(proof.loginRecords.length, 9);
    assert.deepEqual(await Promise.all(accounts.map(row)), beforeActive);
    proof.activeRowsUnchangedAfterBoth = true;
    proof.status = 'completed';
  } catch (e) {
    proof.status = 'failed';
    proof.error = e.message;
    process.exitCode = 1;
  } finally {
    await locker.end();
    proof.cleanup.lockerClosed = true;
    await db.end();
    proof.cleanup.observerClosed = true;
    proof.elapsedMs = Date.now() - began;
    proof.actualSessionGETs = gets;
    proof.loginSummary = summarize(proof.loginRecords);
    proof.sourceManifestSha256 = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(root, 'candidate.json')))
      .digest('hex');
    fs.writeFileSync(
      path.join(root, 'load-proof.json'),
      JSON.stringify(proof, null, 2),
      { flag: 'wx' },
    );
  }
}
if (require.main === module)
  void main().catch(() => {
    console.error('Bounded concurrency harness cleanup failed.');
    process.exitCode = 1;
  });
