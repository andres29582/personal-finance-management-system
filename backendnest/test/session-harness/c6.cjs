const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const backend = path.resolve(__dirname, '../..');
const { Client } = require(path.join(backend, 'node_modules/pg')),
  jwt = require(path.join(backend, 'node_modules/jsonwebtoken'));
const {
  BACKDATE_SQL,
  epoch,
  identity,
  clock,
  initializeAuthority,
  assertFixture,
  authority,
  instantMicros,
} = require('./contract.cjs');
const {
  ORDER,
  orderedToc,
  classifyRestore,
  validateNegative,
} = require('./c6-negative.cjs');
const root = process.env.SESSION_HARNESS_ARTIFACTS;
const negative = process.env.SESSION_HARNESS_CASE === 'C6_SQL_ERROR';
const proof = negative
  ? {
      case: 'C6_SQL_ERROR',
      status: 'running',
      normalContinuation: { http: 0, authority: 0 },
    }
  : {
      case: 'C6',
      status: 'running',
      cases: [],
      limits: {
        goalCapMs: 180000,
        httpTimeoutMs: 12000,
        fixtures: 4,
        loadRun: false,
      },
      scope:
        'Owned UTC backdated fixtures and synthetic PG18 dump/restore, not production or natural waits',
    };
const db = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
});
const digest = (value) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const write = (name, value) =>
  fs.writeFileSync(
    path.join(root, name + '.json'),
    JSON.stringify(value, null, 2),
    { flag: 'wx' },
  );
const safeRows = (rows) =>
  rows.map((r) => ({
    ...r,
    refresh_token_hash: {
      redacted: true,
      sha256: digest(r.refresh_token_hash),
    },
  }));
const min = (...v) => v.reduce((a, b) => (a < b ? a : b));
const ms = (us) => instantMicros(us) / 1000n;
function isoMs(iso) {
  assert.match(iso, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  const n = Date.parse(iso);
  assert.ok(Number.isFinite(n));
  return BigInt(n);
}
async function http(endpoint, token, body) {
  if (negative) {
    proof.normalContinuation.http++;
    throw Error('Normal C6 HTTP forbidden in SQL-error case');
  }
  const r = await fetch('http://127.0.0.1:4318' + endpoint, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  return {
    status: r.status,
    cacheControl: r.headers.get('cache-control'),
    body: await r.json(),
  };
}
async function command(name, args, phase = name) {
  const phases = {
    pg_dump: 'pg_dump',
    pg_restore: 'pg_restore',
    'negative-dump': 'pg_dump',
    'negative-list': 'pg_restore',
    'negative-stop': 'pg_restore',
    'negative-control': 'pg_restore',
  };
  if (
    phases[phase] !== name ||
    (phase.startsWith('negative-') &&
      process.env.SESSION_HARNESS_CASE !== 'C6_SQL_ERROR')
  )
    throw Error('Unsupported C6 command phase');
  const expectedNegative = ['negative-stop', 'negative-control'].includes(
    phase,
  );
  if (
    expectedNegative &&
    (args.includes('--clean') ||
      args.includes('--single-transaction') ||
      !args.includes('--no-owner') ||
      !args.includes('--no-privileges') ||
      args.includes('--exit-on-error') !== (phase === 'negative-stop'))
  )
    throw Error('Unexpected C6 restore flags');
  await identity(db);
  const out = fs.openSync(path.join(root, phase + '.stdout.log'), 'wx'),
    err = fs.openSync(path.join(root, phase + '.stderr.log'), 'wx');
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(
        path.join(
          process.env.SESSION_HARNESS_PG_BIN,
          name + (process.platform === 'win32' ? '.exe' : ''),
        ),
        args,
        {
          cwd: path.join(root, 'run'),
          env: {
            SystemRoot: process.env.SystemRoot,
            PATH: process.env.PATH,
            PGPASSWORD: process.env.DB_PASSWORD,
            LC_ALL: 'C',
            LANG: 'C',
          },
          windowsHide: true,
          shell: false,
          stdio: ['ignore', out, err],
        },
      );
      let timedOut = false,
        hardTimer;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
        hardTimer = setTimeout(
          () => reject(Error(phase + ' termination unconfirmed')),
          2000,
        );
      }, 45000);
      child.once('error', (e) => {
        clearTimeout(timer);
        clearTimeout(hardTimer);
        reject(e);
      });
      child.once('exit', (code, signal = null) => {
        clearTimeout(timer);
        clearTimeout(hardTimer);
        if (timedOut) return reject(Error(phase + ' timeout'));
        const status = { exitCode: code, signal, cause: 'exit' };
        if (expectedNegative) resolve(status);
        else
          code === 0 && signal === null
            ? resolve(status)
            : reject(Error(name + ' exit ' + code));
      });
    });
  } finally {
    fs.closeSync(out);
    fs.closeSync(err);
  }
}
async function sqlErrorScenario() {
  await identity(db);
  await db.query('DROP SCHEMA public CASCADE');
  await db.query('CREATE SCHEMA public');
  for (const name of ORDER)
    await db.query(`CREATE TABLE public.${name} (marker text)`);
  const args = [
    '-h',
    '127.0.0.1',
    '-p',
    '55434',
    '-U',
    process.env.DB_USERNAME,
    '-d',
    process.env.DB_NAME,
  ];
  const archive = path.join(root, 'negative-synthetic.dump'),
    list = path.join(root, 'negative-order.list');
  await command(
    'pg_dump',
    [
      ...args,
      '-Fc',
      '--schema-only',
      '--no-owner',
      '--no-privileges',
      '--table=public.before',
      '--table=public.error',
      '--table=public.after',
      '-f',
      archive,
    ],
    'negative-dump',
  );
  await command('pg_restore', ['--list', archive], 'negative-list');
  const selected = orderedToc(
    fs.readFileSync(path.join(root, 'negative-list.stdout.log'), 'utf8'),
    process.env.DB_USERNAME,
  );
  fs.writeFileSync(list, selected, { flag: 'wx' });
  assert.equal(fs.readFileSync(list, 'utf8'), selected);
  assert.equal(orderedToc(selected, process.env.DB_USERNAME), selected);
  proof.intendedNegative = true;
  proof.toc = {
    entryTypes: ['TABLE', 'TABLE', 'TABLE'],
    order: [...ORDER],
    entries: 3,
  };
  for (const [phase, control] of [
    ['negative-stop', false],
    ['negative-control', true],
  ]) {
    // Each destination is a freshly created schema in the same guarded sole-owned DB.
    await identity(db);
    await db.query('DROP SCHEMA public CASCADE');
    await db.query('CREATE SCHEMA public');
    await db.query('CREATE TABLE public.error (marker text)');
    await db.query(
      "INSERT INTO public.error(marker) VALUES('preexisting-destination')",
    );
    const status = await command(
      'pg_restore',
      [
        ...args,
        ...(!control ? ['--exit-on-error'] : []),
        '--no-owner',
        '--no-privileges',
        '--use-list',
        list,
        archive,
      ],
      phase,
    );
    const native = classifyRestore(
      status,
      fs.readFileSync(path.join(root, phase + '.stderr.log'), 'utf8'),
      control,
    );
    await identity(db);
    const present = (
      await db.query(
        "SELECT to_regclass('public.before') IS NOT NULL AS before, to_regclass('public.error') IS NOT NULL AS error, to_regclass('public.after') IS NOT NULL AS after",
      )
    ).rows[0];
    const markers = (await db.query('SELECT marker FROM public.error')).rows;
    const sentinels = {
      beforeExists: present.before,
      errorExists: present.error,
      markerPreserved:
        markers.length === 1 && markers[0].marker === 'preexisting-destination',
      afterExists: present.after,
    };
    proof[control ? 'control' : 'failFast'] = { native, sentinels };
    assert.deepEqual(sentinels, {
      beforeExists: true,
      errorExists: true,
      markerPreserved: true,
      afterExists: control,
    });
  }
  proof.counts = { nativeRestores: 2, expectedSqlErrors: 2, passed: 2 };
  proof.status = 'completed';
  validateNegative(proof);
}
async function shape() {
  const columns = (
    await db.query(
      "SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
    )
  ).rows;
  const constraints = (
    await db.query(
      "SELECT conrelid::regclass::text AS table_name,conname,contype,convalidated,condeferrable,condeferred FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2",
    )
  ).rows;
  return { columns, constraints };
}
async function main() {
  await db.connect();
  if (negative) return sqlErrorScenario();
  if (proof.normalContinuation) proof.normalContinuation.authority++;
  proof.initialClock = await initializeAuthority(db);
  const fixtures = [];
  for (const [i, name, reason] of [
    [1, 'active', null],
    [2, 'idle-expired', 'AUTH_SESSION_IDLE_EXPIRED'],
    [3, 'absolute-expired', 'AUTH_SESSION_ABSOLUTE_EXPIRED'],
    [4, 'revoked', 'AUTH_SESSION_REVOKED'],
  ]) {
    const before = await clock(db),
      r = await http('/auth/login', null, {
        email: `current-${i}@example.com`,
        senha: 'U4-disposable-password-42!',
      });
    assert.equal(r.status, 200);
    const data = r.body.data ?? r.body,
      after = await clock(db);
    const access = jwt.verify(
      data.access_token,
      process.env.JWT_ACCESS_SECRET,
      { algorithms: ['HS256'], issuer: process.env.JWT_ISSUER },
    );
    const refresh = jwt.verify(
      data.refresh_token,
      process.env.JWT_REFRESH_SECRET,
      { algorithms: ['HS256'], issuer: process.env.JWT_ISSUER },
    );
    assert.equal(access.tokenType, 'access');
    assert.equal(refresh.tokenType, 'refresh');
    assert.equal(access.sid, refresh.sid);
    assert.equal(access.sub, refresh.sub);
    assert.equal(access.exp - access.iat, 900);
    assert.ok(
      BigInt(access.iat) * 1000000n >= instantMicros(before.now_us) - 1000000n,
    );
    assert.ok(BigInt(access.iat) * 1000000n <= instantMicros(after.now_us));
    const legal = (await authority(db)).instants.find(
      (r) => r.id === access.sid,
    );
    assertFixture(legal);
    assert.equal(
      BigInt(refresh.exp) * 1000000n,
      instantMicros(legal.refresh_us),
    );
    assert.ok(
      instantMicros(legal.refresh_us) <= instantMicros(legal.absolute_us),
    );
    fixtures.push({
      name,
      reason,
      token: data.access_token,
      sid: access.sid,
      user: access.sub,
    });
  }
  proof.signerClockAndLegalLogins = {
    verified: 4,
    algorithm: 'HS256',
    issuer: process.env.JWT_ISSUER,
    accessSeconds: 900,
    refreshCappedToAbsolute: true,
  };
  const anchor = await clock(db);
  proof.fixtureAnchor = anchor;
  for (const f of fixtures) {
    await identity(db);
    const age = f.name === 'absolute-expired' ? 43260 : 1200,
      activityAge =
        f.name === 'idle-expired'
          ? 960
          : f.name === 'absolute-expired'
            ? 120
            : 60;
    assert.equal(
      (
        await db.query(BACKDATE_SQL, [
          f.sid,
          anchor.now,
          age,
          activityAge,
          f.name === 'revoked',
          f.user,
        ])
      ).rowCount,
      1,
    );
  }
  const before = await authority(db);
  assert.equal(before.raw.length, 4);
  before.instants.forEach(assertFixture);
  const schemaBefore = await shape();
  write('authority-before', {
    rows: safeRows(before.raw),
    instants: before.instants,
    sha256: digest(before.raw),
  });
  write('schema-before', schemaBefore);
  proof.clockBeforeBackup = await clock(db);
  const args = [
    '-h',
    '127.0.0.1',
    '-p',
    '55434',
    '-U',
    process.env.DB_USERNAME,
    '-d',
    process.env.DB_NAME,
  ];
  await command('pg_dump', [
    ...args,
    '-Fc',
    '--exclude-schema=e2e_harness',
    '-f',
    path.join(root, 'synthetic.dump'),
  ]);
  await identity(db);
  await db.query('DROP SCHEMA public CASCADE');
  await db.query('CREATE SCHEMA public');
  await command('pg_restore', [
    ...args,
    '--exit-on-error',
    '--no-owner',
    '--no-privileges',
    path.join(root, 'synthetic.dump'),
  ]);
  await identity(db);
  await initializeAuthority(db);
  proof.clockAfterRestore = await clock(db);
  assert.ok(
    instantMicros(proof.clockAfterRestore.now_us) >=
      instantMicros(proof.clockBeforeBackup.now_us),
  );
  const restored = await authority(db),
    schemaAfter = await shape();
  write('authority-after', {
    rows: safeRows(restored.raw),
    instants: restored.instants,
    sha256: digest(restored.raw),
  });
  write('schema-after', schemaAfter);
  assert.deepEqual(restored, before);
  assert.deepEqual(schemaAfter, schemaBefore);
  proof.exactAuthorityEquality = {
    rows: 4,
    rawFieldSha256: digest(restored.raw),
    typedMicrosecondsEqual: true,
  };
  proof.schemaMetadataEqual = true;
  proof.checkDefinitionRenderingNotCompared =
    'C5 historical typed equivalence is separate; C6 compares names/types/nullability/defaults and constraint metadata, not generic normalized SQL';
  for (const f of fixtures) {
    const raw = restored.raw.find((r) => r.id === f.sid),
      typed = restored.instants.find((r) => r.id === f.sid),
      idle = min(
        instantMicros(typed.activity_us) + 900000000n,
        instantMicros(typed.absolute_us),
        instantMicros(typed.refresh_us),
      );
    const response = await http('/auth/session', f.token),
      state = response.body.data ?? response.body;
    const persisted = (await authority(db)).raw.find((r) => r.id === f.sid),
      code =
        response.body.code ??
        response.body.error?.code ??
        response.body.data?.code ??
        null;
    const evidence = {
      fixture: f.name,
      sid: f.sid,
      status: response.status,
      code,
      cacheControl: response.cacheControl,
      beforeSha256: digest(raw),
      afterSha256: digest(persisted),
    };
    proof.cases.push(evidence);
    if (!f.reason) {
      assert.equal(response.status, 200);
      assert.equal(response.cacheControl, 'no-store');
      assert.equal(isoMs(state.idleExpiresAt), idle / 1000n);
      assert.equal(isoMs(state.absoluteExpiresAt), ms(typed.absolute_us));
      assert.equal(state.policyVersion, 1);
      assert.ok(isoMs(state.serverNow) >= ms(proof.clockAfterRestore.now_us));
      assert.ok(isoMs(state.serverNow) < idle / 1000n);
      assert.deepEqual(persisted, raw);
      evidence.unchangedNoTouch = true;
    } else {
      assert.equal(response.status, 401);
      assert.equal(code, f.reason);
      assert.equal(persisted.terminal_reason, f.reason);
      assert.ok(persisted.revoked_at);
      for (const k of Object.keys(raw).filter(
        (k) => !['updated_at', 'revoked_at', 'terminal_reason'].includes(k),
      ))
        assert.deepEqual(persisted[k], raw[k]);
      if (f.name === 'revoked') assert.deepEqual(persisted, raw);
      else {
        const revoked = (
          await db.query(
            `SELECT ${epoch("revoked_at AT TIME ZONE 'UTC'")} AS revoked_us FROM auth_session WHERE id=$1::uuid`,
            [f.sid],
          )
        ).rows[0];
        assert.ok(
          instantMicros(revoked.revoked_us) / 1000n >=
            ms(proof.clockAfterRestore.now_us),
        );
      }
      evidence.deniedWithoutRenewal = true;
    }
    evidence.passed = true;
  }
  proof.status = 'completed';
  proof.counts = { fixtures: 4, passed: 4, accepted: 1, denied: 3 };
  proof.customPG18DumpRestore = true;
}
main()
  .catch((e) => {
    proof.status = 'failed';
    proof.error = e.message;
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
    write(negative ? 'c6-sql-error-proof' : 'c6-proof', proof);
  });
