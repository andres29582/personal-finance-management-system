const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const OUTBOX_CHECKS = [
  "CHECK (((state)::text = ANY ((ARRAY['pending'::character varying, 'claimed'::character varying, 'delivered'::character varying, 'simulated'::character varying, 'failed'::character varying, 'reconciliation'::character varying])::text[])))",
  "CHECK (((state)::text = ANY (ARRAY[('pending'::character varying)::text, ('claimed'::character varying)::text, ('delivered'::character varying)::text, ('simulated'::character varying)::text, ('failed'::character varying)::text, ('reconciliation'::character varying)::text])))",
];
function expectedQuotaBranch(windowUs, nowUs) {
  assert.match(windowUs, /^\d+$/);
  assert.match(nowUs, /^\d+$/);
  assert.ok(
    BigInt(nowUs) >= BigInt(windowUs),
    'Database clock moved backwards',
  );
  return BigInt(nowUs) - BigInt(windowUs) < 60000000n ? 'deny' : 'renew';
}
function canonicalConstraints(rows) {
  return rows.map((r) => {
    if (
      r.table_name !== 'password_changed_outbox' ||
      r.conname !== 'password_changed_state'
    )
      return r;
    assert.ok(
      OUTBOX_CHECKS.includes(r.definition),
      'Unknown outbox CHECK rendering',
    );
    return { ...r, definition: OUTBOX_CHECKS[0] };
  });
}
module.exports = { OUTBOX_CHECKS, expectedQuotaBranch, canonicalConstraints };

function assertArtifactRoot(root, repo, bindingValue) {
  const { confined } = require('./u6-owned.cjs');
  assert.equal(typeof root, 'string');
  assert.equal(root, path.resolve(root), 'Canonical absolute root required');
  assert.equal(path.dirname(root), path.join(repo, '.tmp'));
  confined(root, root);
  assert.equal(fs.lstatSync(root).isDirectory(), true);
  if (bindingValue === undefined) {
    assert.match(path.basename(root), /^session-harness-u5d-[a-f0-9]{32}$/);
    return;
  }
  const binding = JSON.parse(bindingValue);
  assert.deepEqual(Object.keys(binding).sort(), [
    'candidate',
    'case',
    'root',
    'runnerCandidate',
    'token',
  ]);
  const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
  assert.equal(binding.case, 'U5D');
  assert.match(binding.root, new RegExp('^\\.tmp/u6-runtime-' + uuid + '$'));
  assert.match(binding.token, new RegExp('^' + uuid + '$'));
  assert.match(binding.candidate, /^[a-f0-9]{64}$/);
  assert.match(binding.runnerCandidate, /^[a-f0-9]{64}$/);
  assert.equal(root, path.resolve(repo, binding.root));
  // Only the handshaken runner writes this exclusive marker before this child.
  const marker = confined(path.join(root, 'u5d-owner.json'), root);
  assert.deepEqual(JSON.parse(fs.readFileSync(marker, 'utf8')), binding);
}

async function main() {
  const backend = path.resolve(__dirname, '../..'),
    repo = path.dirname(backend);
  const root = process.env.SESSION_HARNESS_ARTIFACTS;
  assert.equal(process.env.SESSION_HARNESS_CASE, 'U5D');
  assert.equal(process.env.DB_HOST, '127.0.0.1');
  assert.equal(process.env.DB_PORT, '55434');
  assertArtifactRoot(root, repo, process.env.U6_COORDINATOR_BINDING);
  const { Client } = require(path.join(backend, 'node_modules/pg'));
  const { DataSource } = require(path.join(backend, 'node_modules/typeorm'));
  const { User } = require('../../src/users/entities/user.entity');
  const {
    AuthSession,
  } = require('../../src/auth/entities/auth-session.entity');
  const {
    AuthSessionRepository,
  } = require('../../src/auth/repositories/auth-session.repository');
  const {
    BACKDATE_SQL,
    clock,
    authority,
    assertFixture,
  } = require('./contract.cjs');
  const digest = (value) =>
    createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const write = (name, value) =>
    fs.writeFileSync(
      path.join(root, name + '.json'),
      JSON.stringify(value, null, 2),
      { flag: 'wx' },
    );
  const sourceConfig = {
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
  };
  const destinationConfig = {
    database: process.env.U5D_DEST_DATABASE,
    user: process.env.U5D_DEST_ROLE,
  };
  const negativeConfig = {
    database: process.env.U5D_NEG_DATABASE,
    user: process.env.U5D_NEG_ROLE,
  };
  const configs = [sourceConfig, destinationConfig, negativeConfig];
  configs.forEach((c) => {
    assert.match(c.database, /^finance_e2e_[a-z0-9_]+$/);
    assert.match(c.user, /^finance_e2e_[a-z0-9_]+$/);
  });
  assert.equal(new Set(configs.map((c) => c.database)).size, 3);
  assert.equal(new Set(configs.map((c) => c.user)).size, 3);
  assert.equal(process.env.E2E_DB_RESET_CONFIRM, sourceConfig.database);
  const connections = [],
    sources = [];
  const proof = {
    case: 'U5D',
    status: 'running',
    cases: [],
    operations: [],
    limits: { goalsMs: 180000, dumpRestoreMs: 45000 },
    scope:
      'Synthetic private PG18 all-17 restore + actual current repository; no Nest/browser/production/old published binary',
  };
  const pass = (name, evidence = {}) =>
    proof.cases.push({ name, status: 'PASS', ...evidence });
  async function guard(db, c) {
    const r = (
      await db.query(
        `SELECT current_database()=$1 AND current_user=$2 AND NOT r.rolsuper
      AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolreplication AND NOT r.rolbypassrls
      AND d.datdba=r.oid AND shobj_description(d.oid,'pg_database')='finance-e2e-disposable'
      AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)
      AND NOT EXISTS(SELECT 1 FROM pg_database other WHERE other.datdba=r.oid AND other.datname<>$1) AS safe
      FROM pg_roles r JOIN pg_database d ON d.datname=current_database() WHERE r.rolname=current_user`,
        [c.database, c.user],
      )
    ).rows[0];
    assert.equal(r?.safe, true, 'Private identity/role/owner/marker required');
  }
  async function connect(c) {
    const db = new Client({
      ...c,
      host: '127.0.0.1',
      port: 55434,
      password: process.env.DB_PASSWORD,
      connectionTimeoutMillis: 5000,
      query_timeout: 10000,
    });
    await db.connect();
    connections.push(db);
    await guard(db, c);
    await db.query(
      "SET TIME ZONE 'UTC'; SET statement_timeout='10s'; SET lock_timeout='2s'",
    );
    return db;
  }
  const gate = fs.readFileSync(
    path.join(repo, 'docs/operacao/U5_PREDEPLOY_CHECK.sql'),
    'utf8',
  );
  async function checkGate(db, c) {
    await guard(db, c);
    await db.query(gate);
  }
  async function repository(c) {
    const db = new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: 55434,
      database: c.database,
      username: c.user,
      password: process.env.DB_PASSWORD,
      entities: [User, AuthSession],
      synchronize: false,
      logging: false,
      extra: {
        max: 2,
        connectionTimeoutMillis: 5000,
        statement_timeout: 10000,
      },
    });
    await db.initialize();
    sources.push(db);
    return new AuthSessionRepository(db.getRepository(AuthSession), db);
  }
  async function snapshot(db) {
    const columns = (
      await db.query(
        "SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default,character_maximum_length FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
      )
    ).rows;
    const constraints = canonicalConstraints(
      (
        await db.query(
          "SELECT conrelid::regclass::text AS table_name,conname,contype,convalidated,condeferrable,condeferred,confdeltype,confupdtype,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2",
        )
      ).rows,
    );
    const indexes = (
      await db.query(
        "SELECT tablename,indexname,indexdef,i.indisvalid,i.indisready FROM pg_indexes p JOIN pg_class c ON c.relname=p.indexname AND c.relnamespace='public'::regnamespace JOIN pg_index i ON i.indexrelid=c.oid WHERE p.schemaname='public' ORDER BY 1,2",
      )
    ).rows;
    const counts = [];
    for (const { tablename } of (
      await db.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows) {
      assert.match(tablename, /^[a-z_]+$/);
      const raw = (
        await db.query(
          `SELECT row_to_json(t)::text AS row FROM public."${tablename}" t ORDER BY row_to_json(t)::text`,
        )
      ).rows;
      counts.push({ table: tablename, count: raw.length, sha256: digest(raw) });
    }
    return { columns, constraints, indexes, counts };
  }
  async function budget(db) {
    return (
      await db.query(
        'SELECT usuario_id,window_started_at::text,attempts,(extract(epoch FROM window_started_at)*1000000)::numeric(20,0)::text AS window_us FROM auth_session_reauthentication ORDER BY usuario_id',
      )
    ).rows;
  }
  async function command(label, c, args) {
    await guard(label === 'pg_dump' ? source : destination, c);
    const logs = ['stdout', 'stderr'].map((s) =>
      fs.openSync(path.join(root, label + '.' + s + '.log'), 'wx'),
    );
    const began = Date.now();
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(
          path.join(
            process.env.SESSION_HARNESS_PG_BIN,
            label + (process.platform === 'win32' ? '.exe' : ''),
          ),
          [
            '-h',
            '127.0.0.1',
            '-p',
            '55434',
            '-U',
            c.user,
            '-d',
            c.database,
            ...args,
          ],
          {
            cwd: path.join(root, 'run'),
            env: {
              SystemRoot: process.env.SystemRoot,
              PATH: process.env.PATH,
              PGPASSWORD: process.env.DB_PASSWORD,
            },
            shell: false,
            windowsHide: true,
            stdio: ['ignore', ...logs],
          },
        );
        let timedOut = false,
          hard;
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill();
          hard = setTimeout(
            () => reject(Error(label + ' termination unconfirmed')),
            2000,
          );
        }, 45000);
        child.once('error', (e) => {
          clearTimeout(timer);
          clearTimeout(hard);
          reject(e);
        });
        child.once('exit', (code, signal) => {
          clearTimeout(timer);
          clearTimeout(hard);
          proof.operations.push({
            label,
            code,
            signal,
            timedOut,
            elapsedMs: Date.now() - began,
          });
          code === 0 && !timedOut
            ? resolve()
            : reject(Error(label + ' failed'));
        });
      });
    } finally {
      logs.forEach((fd) => fs.closeSync(fd));
    }
  }
  let source, destination;
  try {
    source = await connect(sourceConfig);
    destination = await connect(destinationConfig);
    const negative = await connect(negativeConfig);
    assert.equal(
      (
        await destination.query(
          "SELECT count(*)::int AS n FROM pg_class WHERE relnamespace='public'::regnamespace",
        )
      ).rows[0].n,
      0,
      'Restore destination must be empty',
    );
    const files = fs
      .readdirSync(path.join(backend, 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    assert.equal(files.length, 17);
    for (const f of files.slice(0, 16)) {
      await guard(negative, negativeConfig);
      await negative.query(
        fs.readFileSync(path.join(backend, 'migrations', f), 'utf8'),
      );
    }
    let code;
    try {
      await checkGate(negative, negativeConfig);
    } catch (e) {
      code = e.code;
    } finally {
      await negative.query('ROLLBACK');
    }
    assert.equal(code, 'P0001');
    pass('predeploy-denies-0016-only', { code });
    await guard(negative, negativeConfig);
    await negative.query(
      fs.readFileSync(path.join(backend, 'migrations', files[16]), 'utf8'),
    );
    await checkGate(negative, negativeConfig);
    pass('predeploy-all17-private-upgrade');
    await checkGate(source, sourceConfig);
    pass('predeploy-source17');
    const current = await repository(sourceConfig),
      fixtures = [];
    const users = (
      await source.query(
        'SELECT id,senha_hash FROM usuario ORDER BY email LIMIT 4',
      )
    ).rows;
    assert.equal(users.length, 4);
    for (const [i, name] of [
      'active',
      'idle-expired',
      'absolute-expired',
      'revoked',
    ].entries()) {
      const u = users[i],
        sid = randomUUID();
      await current.createSession({
        id: sid,
        userId: u.id,
        expectedPasswordHash: u.senha_hash,
        maxActiveSessions: 5,
        policy: { idleSeconds: 900, absoluteSeconds: 43200, version: 1 },
        issue: async (_now, absolute) => ({
          access_token: 'synthetic-not-a-jwt',
          refresh_token: 'synthetic-not-a-jwt',
          refreshTokenHash: createHash('sha256').update(sid).digest('hex'),
          expiresAt: absolute,
        }),
      });
      fixtures.push({ name, sid, user: u.id });
    }
    const anchor = await clock(source);
    for (const f of fixtures) {
      await guard(source, sourceConfig);
      await source.query(BACKDATE_SQL, [
        f.sid,
        anchor.now,
        f.name === 'absolute-expired' ? 43260 : 1200,
        f.name === 'idle-expired'
          ? 960
          : f.name === 'absolute-expired'
            ? 120
            : 60,
        f.name === 'revoked',
        f.user,
      ]);
    }
    const active = fixtures[0];
    for (let i = 0; i < 5; i++)
      await current.reserveSessionReauthentication(active.user, active.sid);
    await assert.rejects(
      current.reserveSessionReauthentication(active.user, active.sid),
      (e) => e.code === 'AUTH_REAUTHENTICATION_LIMIT',
    );
    const before = await authority(source),
      beforeBudget = await budget(source),
      schemaBefore = await snapshot(source);
    before.instants.forEach(assertFixture);
    assert.equal(beforeBudget[0].attempts, 5);
    write('u5d-before', {
      authority: {
        ...before,
        raw: before.raw.map((r) => ({
          ...r,
          refresh_token_hash: {
            redacted: true,
            sha256: digest(r.refresh_token_hash),
          },
        })),
      },
      budget: beforeBudget,
      schema: schemaBefore,
    });
    const dump = path.join(root, 'synthetic-u5-all17.dump');
    proof.beforeBackupClock = await clock(source);
    await command('pg_dump', sourceConfig, ['-Fc', '-f', dump]);
    await command('pg_restore', destinationConfig, [
      '--no-owner',
      '--no-privileges',
      '--exit-on-error',
      dump,
    ]);
    await guard(destination, destinationConfig);
    await checkGate(destination, destinationConfig);
    const after = await authority(destination),
      afterBudget = await budget(destination),
      schemaAfter = await snapshot(destination);
    assert.deepEqual(after, before);
    assert.deepEqual(afterBudget, beforeBudget);
    assert.deepEqual(schemaAfter, schemaBefore);
    write('u5d-after', {
      authority: {
        ...after,
        raw: after.raw.map((r) => ({
          ...r,
          refresh_token_hash: {
            redacted: true,
            sha256: digest(r.refresh_token_hash),
          },
        })),
      },
      budget: afterBudget,
      schema: schemaAfter,
    });
    pass('restore-exact-authority-quota-schema', {
      authorityRows: before.raw.length,
      quotaRows: afterBudget.length,
      tables: schemaAfter.counts.length,
      fks: schemaAfter.constraints.filter((c) => c.contype === 'f').length,
      dumpSha256: createHash('sha256')
        .update(fs.readFileSync(dump))
        .digest('hex'),
    });
    pass('predeploy-restored17');
    const restored = await repository(destinationConfig),
      t0 = await clock(destination);
    const branchBefore = expectedQuotaBranch(
      afterBudget[0].window_us,
      t0.now_us,
    );
    let limited = false;
    try {
      await restored.reserveSessionReauthentication(active.user, active.sid);
    } catch (e) {
      assert.equal(e.code, 'AUTH_REAUTHENTICATION_LIMIT');
      limited = true;
    }
    const t1 = await clock(destination),
      branchAfter = expectedQuotaBranch(afterBudget[0].window_us, t1.now_us),
      newBudget = await budget(destination);
    if (branchBefore === branchAfter)
      assert.equal(limited, branchBefore === 'deny');
    if (limited) assert.deepEqual(newBudget, afterBudget);
    else {
      assert.equal(branchAfter, 'renew');
      assert.equal(newBudget[0].attempts, 1);
      assert.ok(BigInt(newBudget[0].window_us) >= BigInt(t0.now_us) - 1000n);
    }
    assert.deepEqual(await authority(destination), after);
    pass('restored-real-quota-clock-branch', {
      branchBefore,
      branchAfter,
      outcome: limited ? 'deny' : 'renew',
      clockBefore: t0,
      clockAfter: t1,
      beforeBudget: afterBudget,
      afterBudget: newBudget,
      authorityUnchanged: true,
    });
    for (const f of fixtures) {
      const prior = (await authority(destination)).raw.find(
        (r) => r.id === f.sid,
      );
      const expected = {
        'idle-expired': 'AUTH_SESSION_IDLE_EXPIRED',
        'absolute-expired': 'AUTH_SESSION_ABSOLUTE_EXPIRED',
        revoked: 'AUTH_SESSION_REVOKED',
      }[f.name];
      if (expected)
        await assert.rejects(
          restored.authorize(f.sid, f.user, false),
          (e) => e.code === expected,
        );
      else await restored.authorize(f.sid, f.user, false);
      const persisted = (await authority(destination)).raw.find(
        (r) => r.id === f.sid,
      );
      for (const key of Object.keys(prior).filter(
        (k) => !['revoked_at', 'terminal_reason', 'updated_at'].includes(k),
      ))
        assert.deepEqual(persisted[key], prior[key]);
      if (f.name === 'active' || f.name === 'revoked')
        assert.deepEqual(persisted, prior);
      else {
        assert.ok(persisted.revoked_at);
        assert.equal(persisted.terminal_reason, expected);
      }
      pass('restored-authority-' + f.name, {
        denied: !!expected,
        code: expected ?? null,
        noRenewal: true,
      });
    }
    proof.status = 'PASS';
    proof.counts = { passed: proof.cases.length, failed: 0 };
  } catch (e) {
    proof.status = 'FAIL';
    proof.error = e.code ? 'Failure code: ' + e.code : e.message;
    process.exitCode = 1;
  } finally {
    await Promise.all(sources.map((s) => s.destroy()));
    await Promise.all(connections.map((c) => c.end()));
    proof.connectionsClosed = true;
    write('u5d-proof', proof);
  }
}
if (
  process.env.SESSION_HARNESS_CASE === 'U5D' &&
  path.resolve(process.argv[2] || '') === __filename
)
  void main();
