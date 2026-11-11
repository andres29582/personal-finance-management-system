const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const COLUMNS = {
  id: ['uuid', 'NO'],
  usuario_id: ['uuid', 'NO'],
  refresh_token_hash: ['character varying', 'NO'],
  expires_at: ['timestamp without time zone', 'NO'],
  revoked_at: ['timestamp without time zone', 'YES'],
  last_used_at: ['timestamp without time zone', 'YES'],
  created_at: ['timestamp without time zone', 'NO'],
  updated_at: ['timestamp without time zone', 'NO'],
  authenticated_at: ['timestamp with time zone', 'YES'],
  absolute_expires_at: ['timestamp with time zone', 'YES'],
  last_activity_at: ['timestamp with time zone', 'YES'],
  refresh_expires_at: ['timestamp with time zone', 'YES'],
  idle_timeout_seconds: ['integer', 'YES'],
  policy_version: ['integer', 'YES'],
  terminal_reason: ['character varying', 'YES'],
};
const IDENTITY_SQL = `SELECT current_database()=$1::text AND current_user=$2::text
 AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolreplication AND NOT r.rolbypassrls
 AND d.datdba=r.oid AND shobj_description(d.oid,'pg_database')='finance-e2e-disposable'
 AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)
 AND NOT EXISTS(SELECT 1 FROM pg_database o WHERE o.datdba=r.oid AND o.datname<>$1::text) AS safe
 FROM pg_roles r JOIN pg_database d ON d.datname=current_database() WHERE r.rolname=current_user`;
const BACKDATE_SQL = `UPDATE auth_session SET
 authenticated_at=$2::timestamptz-($3::integer*interval '1 second'),
 absolute_expires_at=$2::timestamptz-($3::integer*interval '1 second')+interval '43200 seconds',
 last_activity_at=$2::timestamptz-($4::integer*interval '1 second'), idle_timeout_seconds=900,policy_version=1,
 refresh_expires_at=$2::timestamptz-($3::integer*interval '1 second')+interval '43200 seconds',
 expires_at=($2::timestamptz-($3::integer*interval '1 second')+interval '43200 seconds') AT TIME ZONE 'UTC',
 last_used_at=($2::timestamptz-($4::integer*interval '1 second')) AT TIME ZONE 'UTC',
 created_at=($2::timestamptz-($3::integer*interval '1 second')) AT TIME ZONE 'UTC',
 updated_at=($2::timestamptz-interval '30 seconds') AT TIME ZONE 'UTC',
 revoked_at=CASE WHEN $5::boolean THEN ($2::timestamptz-interval '30 seconds') AT TIME ZONE 'UTC' ELSE NULL END,
 terminal_reason=CASE WHEN $5::boolean THEN 'AUTH_SESSION_REVOKED' ELSE NULL END WHERE id=$1::uuid AND usuario_id=$6::uuid`;

function instantMicros(value) {
  assert.match(value, /^-?\d+$/);
  return BigInt(value);
}
const epoch = (expression) =>
  `(extract(epoch FROM ${expression})*1000000)::numeric(20,0)::text`;
async function identity(db) {
  assert.equal(process.env.DB_HOST, '127.0.0.1');
  assert.equal(process.env.DB_PORT, '55434');
  assert.match(process.env.DB_NAME, /^finance_e2e_[a-z0-9_]+$/);
  assert.match(process.env.DB_USERNAME, /^finance_e2e_[a-z0-9_]+$/);
  assert.equal(process.env.E2E_DB_RESET_CONFIRM, process.env.DB_NAME);
  assert.equal(
    (
      await db.query(IDENTITY_SQL, [
        process.env.DB_NAME,
        process.env.DB_USERNAME,
      ])
    ).rows[0]?.safe,
    true,
    'owned disposable destination required',
  );
}
async function clock(db) {
  return (
    await db.query(
      `SELECT t.now::text AS now, ${epoch('t.now')} AS now_us FROM (SELECT clock_timestamp() AS now) t`,
    )
  ).rows[0];
}
async function initializeAuthority(db, check = () => identity(db)) {
  await check();
  await db.query("SET TIME ZONE 'UTC'");
  assert.equal((await db.query('SHOW TIME ZONE')).rows[0].TimeZone, 'UTC');
  const anchor = await clock(db);
  assert.match(anchor.now, /\+00$/);
  instantMicros(anchor.now_us);
  return anchor;
}
function assertSchema(columns) {
  for (const [name, expected] of Object.entries(COLUMNS)) {
    const column = columns.find((c) => c.column_name === name);
    assert.ok(column, 'missing auth_session.' + name);
    assert.deepEqual(
      [column.data_type, column.is_nullable],
      expected,
      'wrong auth_session.' + name,
    );
  }
}
function assertRuntime({ policy, throttle, token }) {
  assert.deepEqual(policy, {
    idleSeconds: 900,
    absoluteSeconds: 43200,
    version: 1,
  });
  assert.deepEqual(throttle, { limit: 60, ttl: 60000 });
  for (const [key, value] of Object.entries({
    issuer: 'meu-sistema-financeiro',
    algorithm: 'HS256',
    accessExpiresIn: '15m',
    refreshExpiresIn: '30d',
    maxActiveSessions: 5,
  }))
    assert.equal(token[key], value, key);
}
function assertFixture(row) {
  assert.equal(row.policy_version, 1);
  assert.equal(row.idle_timeout_seconds, 900);
  const start = instantMicros(row.authenticated_us),
    absolute = instantMicros(row.absolute_us),
    activity = instantMicros(row.activity_us),
    refresh = instantMicros(row.refresh_us);
  assert.equal(absolute - start, 43200000000n);
  assert.ok(activity >= start && activity < absolute);
  assert.ok(refresh > start && refresh <= absolute);
  assert.equal(instantMicros(row.expires_us), refresh);
}
async function authority(db) {
  const raw = (
    await db.query(`SELECT id,usuario_id,policy_version,idle_timeout_seconds,
   authenticated_at::text,absolute_expires_at::text,last_activity_at::text,refresh_expires_at::text,
   expires_at::text,last_used_at::text,created_at::text,updated_at::text,revoked_at::text,terminal_reason,refresh_token_hash
   FROM auth_session WHERE policy_version=1 ORDER BY id`)
  ).rows;
  // Only this harness's freshly written UTC legacy fields have known provenance.
  const instants = (
    await db.query(`SELECT id,policy_version,idle_timeout_seconds,
   ${epoch('authenticated_at')} AS authenticated_us,${epoch('absolute_expires_at')} AS absolute_us,
   ${epoch('last_activity_at')} AS activity_us,${epoch('refresh_expires_at')} AS refresh_us,
   ${epoch("expires_at AT TIME ZONE 'UTC'")} AS expires_us FROM auth_session WHERE policy_version=1 ORDER BY id`)
  ).rows;
  return { raw, instants };
}
async function preflight(db, runtime) {
  const anchor = await initializeAuthority(db);
  assertRuntime(runtime);
  const columns = (
    await db.query(
      "SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='auth_session' ORDER BY ordinal_position",
    )
  ).rows;
  assertSchema(columns);
  const constraints = (
    await db.query(`SELECT conname,contype,convalidated,condeferrable,condeferred,confdeltype,
   pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.auth_session'::regclass ORDER BY conname`)
  ).rows;
  for (const [name, type] of [
    ['auth_session_pkey', 'p'],
    ['auth_session_usuario_id_fkey', 'f'],
    ['auth_session_policy_shape', 'c'],
  ]) {
    const c = constraints.find((c) => c.conname === name);
    assert.ok(c, 'missing constraint ' + name);
    assert.equal(c.contype, type);
    assert.equal(c.convalidated, true);
    assert.equal(c.condeferrable, false);
    assert.equal(c.condeferred, false);
    if (type === 'f') {
      assert.equal(c.confdeltype, 'c');
      assert.equal(
        c.definition,
        'FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE',
      );
    }
    if (type === 'p') assert.equal(c.definition, 'PRIMARY KEY (id)');
  }
  const timezoneComparisons = [];
  for (const zone of ['UTC', 'America/Sao_Paulo']) {
    await db.query(`SET TIME ZONE '${zone}'`);
    const r = (
      await db.query(`SELECT ${epoch("'2026-10-11 17:00:00.000001'::timestamp AT TIME ZONE 'UTC'")} AS legacy_us,
     ${epoch("'2026-10-11 17:00:00.000001+00'::timestamptz")} AS authority_us`)
    ).rows[0];
    assert.equal(r.legacy_us, r.authority_us);
    assert.equal(BigInt(r.legacy_us) % 1000n, 1n);
    timezoneComparisons.push({ zone, ...r });
  }
  await initializeAuthority(db);
  const user = randomUUID(),
    sid = randomUUID(),
    rejected = [];
  await db.query('BEGIN');
  try {
    await db.query(
      'INSERT INTO usuario(id,nome,email,senha_hash) VALUES($1::uuid,$2::text,$3::text,$4::text)',
      [
        user,
        'Contract fixture',
        `${user}@example.com`,
        'synthetic-preflight-not-a-login',
      ],
    );
    await db.query(
      `INSERT INTO auth_session(id,usuario_id,refresh_token_hash,expires_at,authenticated_at,absolute_expires_at,last_activity_at,refresh_expires_at,idle_timeout_seconds,policy_version)
     VALUES($1::uuid,$2::uuid,$3::text,($4::timestamptz+interval '43200 seconds') AT TIME ZONE 'UTC',$4::timestamptz,$4::timestamptz+interval '43200 seconds',$4::timestamptz,$4::timestamptz+interval '43200 seconds',900,1)`,
      [sid, user, 'synthetic-preflight-hash', anchor.now],
    );
    const invalid = [
      'idle_timeout_seconds=0',
      'idle_timeout_seconds=31536001',
      'idle_timeout_seconds=NULL',
      'policy_version=2',
      'authenticated_at=NULL',
      'absolute_expires_at=authenticated_at',
      "last_activity_at=authenticated_at-interval '1 second'",
      'last_activity_at=absolute_expires_at',
      "refresh_expires_at=absolute_expires_at+interval '1 microsecond'",
      'refresh_expires_at=NULL',
      'policy_version=NULL',
    ];
    for (const assignment of invalid) {
      await db.query('SAVEPOINT contract_trial');
      let code;
      try {
        await db.query(
          `UPDATE auth_session SET ${assignment} WHERE id=$1::uuid`,
          [sid],
        );
      } catch (e) {
        code = e.code;
      } finally {
        await db.query('ROLLBACK TO SAVEPOINT contract_trial');
        await db.query('RELEASE SAVEPOINT contract_trial');
      }
      assert.equal(code, '23514', 'shape must reject ' + assignment);
      rejected.push({ assignment, code });
    }
    for (const idle of [1, 31536000])
      await db.query(
        'UPDATE auth_session SET idle_timeout_seconds=$2::integer WHERE id=$1::uuid',
        [sid, idle],
      );
    await db.query(
      "UPDATE auth_session SET policy_version=NULL,authenticated_at=NULL,absolute_expires_at=NULL,last_activity_at=NULL,refresh_expires_at=NULL,idle_timeout_seconds=NULL,revoked_at=clock_timestamp() AT TIME ZONE 'UTC' WHERE id=$1::uuid",
      [sid],
    );
  } finally {
    await db.query('ROLLBACK');
  }
  return {
    kind: 'live-contract-preflight-not-scenario-pass',
    anchor,
    columns,
    constraints,
    timezoneComparisons,
    rejected,
    acceptedIdleBounds: [1, 31536000],
    revokedLegacyNullShapeAccepted: true,
    runtime,
  };
}
module.exports = {
  COLUMNS,
  BACKDATE_SQL,
  instantMicros,
  epoch,
  identity,
  clock,
  initializeAuthority,
  assertSchema,
  assertRuntime,
  assertFixture,
  authority,
  preflight,
};
