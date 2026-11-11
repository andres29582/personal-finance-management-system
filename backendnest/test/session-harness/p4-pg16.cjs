const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { binding } = require('./p4-proof.cjs');
const {
  ORDER,
  orderedToc,
  classifyRestore,
  validateNegative,
} = require('./c6-negative.cjs');
const BIN = '/usr/lib/postgresql/16/bin';
function configuration(env, platform = process.platform) {
  assert.equal(platform, 'linux');
  assert.equal(env.GITHUB_ACTIONS, 'true');
  assert.equal(env.RUNNER_OS, 'Linux');
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(env.P4_APPROVAL, 'P4_PUBLIC_7D_OWNER_CUSTODY');
  const origin = binding({
    commit: env.GITHUB_SHA,
    runId: env.GITHUB_RUN_ID,
    attempt: env.GITHUB_RUN_ATTEMPT,
  });
  assert.equal(env.P4_APPROVED_COMMIT, origin.commit);
  return { ...origin, host: '127.0.0.1', port: 55436 };
}
async function connection(config) {
  const { Client } = require('pg');
  const client = new Client({
    ...config,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    statement_timeout: 10000,
    application_name: 'p4-disposable',
  });
  client.on('error', () => {}); // No database diagnostics may reach public job logs.
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.end();
    throw error;
  }
}
async function identity(db, name, owner) {
  const result = await db.query(
    `SELECT (current_database() = $1 AND current_user = $2
    AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole
    AND NOT r.rolreplication AND NOT r.rolbypassrls AND d.datdba = r.oid
    AND shobj_description(d.oid, 'pg_database') = 'finance-e2e-disposable'
    AND NOT EXISTS (SELECT 1 FROM pg_database other WHERE other.datdba = r.oid AND other.datname <> $1)
    AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid)) AS safe
    FROM pg_roles r JOIN pg_database d ON d.datname = current_database()
    WHERE r.rolname = current_user`,
    [name, owner],
  );
  assert.equal(result.rows[0]?.safe, true);
}
async function freshService(config) {
  const db = await connection({
    host: config.host,
    port: config.port,
    user: 'postgres',
    password: 'p4-bootstrap-disposable',
    database: 'postgres',
  });
  try {
    const server = Number(
      (await db.query('SHOW server_version_num')).rows[0].server_version_num,
    );
    assert.ok(server >= 160000 && server < 170000);
    assert.deepEqual(
      (
        await db.query('SELECT datname FROM pg_database ORDER BY datname')
      ).rows.map((row) => row.datname),
      ['postgres', 'template0', 'template1'],
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM pg_roles WHERE rolname LIKE 'finance_e2e_%'",
        )
      ).rows[0].count,
      0,
    );
    await db.query('REVOKE CONNECT ON DATABASE postgres FROM PUBLIC');
    await db.query('REVOKE CONNECT ON DATABASE template1 FROM PUBLIC');
    return server;
  } finally {
    await db.end();
  }
}
async function withDatabase(config, kind, action) {
  assert.ok(['negative', 'e2e'].includes(kind));
  const name = `finance_e2e_${config.runId}_${config.attempt}_${kind}`;
  const owner = name + '_owner';
  assert.match(owner, /^finance_e2e_[a-z0-9_]{1,50}$/);
  const password = crypto.randomBytes(24).toString('hex');
  const admin = await connection({
    host: config.host,
    port: config.port,
    user: 'postgres',
    password: 'p4-bootstrap-disposable',
    database: 'postgres',
  });
  let roleCreated = false,
    dbCreated = false,
    db;
  try {
    assert.equal(
      (
        await admin.query(
          'SELECT count(*)::int AS count FROM pg_roles WHERE rolname=$1',
          [owner],
        )
      ).rows[0].count,
      0,
    );
    assert.equal(
      (
        await admin.query(
          'SELECT count(*)::int AS count FROM pg_database WHERE datname=$1',
          [name],
        )
      ).rows[0].count,
      0,
    );
    await admin.query(
      `CREATE ROLE ${owner} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
    roleCreated = true;
    await admin.query(`CREATE DATABASE ${name} OWNER ${owner}`);
    dbCreated = true;
    await admin.query(
      `COMMENT ON DATABASE ${name} IS 'finance-e2e-disposable'`,
    );
    await admin.query(`REVOKE ALL ON DATABASE ${name} FROM PUBLIC`);
    db = await connection({
      host: config.host,
      port: config.port,
      user: owner,
      password,
      database: name,
    });
    await identity(db, name, owner);
    if (kind === 'e2e') {
      // The launcher owns every participant until its zero-connection readback.
      await db.end();
      db = undefined;
    }
    return await action({ db, name, owner, password });
  } finally {
    try {
      if (db) await db.end();
      // Only resources created in this invocation are eligible for removal.
      if (dbCreated) {
        const target = (
          await admin.query(
            "SELECT pg_get_userbyid(datdba) AS owner, shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1",
            [name],
          )
        ).rows[0];
        assert.equal(target?.owner, owner);
        assert.equal(target?.marker, 'finance-e2e-disposable');
        await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
      }
      if (roleCreated) await admin.query(`DROP ROLE ${owner}`);
      assert.equal(
        (
          await admin.query(
            'SELECT count(*)::int AS count FROM pg_database WHERE datname=$1',
            [name],
          )
        ).rows[0].count,
        0,
      );
      assert.equal(
        (
          await admin.query(
            'SELECT count(*)::int AS count FROM pg_roles WHERE rolname=$1',
            [owner],
          )
        ).rows[0].count,
        0,
      );
    } finally {
      await admin.end();
    }
  }
}
function clientVersion(text, command) {
  assert.equal(typeof text, 'string');
  const match = new RegExp(
    `^${command} \\(PostgreSQL\\) (16\\.[0-9]{1,3})(?: \\(Ubuntu [a-zA-Z0-9.+~:-]+\\))?\\n$`,
  ).exec(text);
  assert.ok(match);
  return match[1];
}
async function negative(config, root, execute) {
  const archive = path.join(root, 'negative.dump');
  const list = path.join(root, 'negative.list');
  try {
    return await withDatabase(
      config,
      'negative',
      async ({ db, name, owner, password }) => {
        const env = {
          PGHOST: config.host,
          PGPORT: String(config.port),
          PGUSER: owner,
          PGPASSWORD: password,
          PGDATABASE: name,
          PGCONNECT_TIMEOUT: '5',
          PGOPTIONS: '-c statement_timeout=10000',
          LC_ALL: 'C',
          LANG: 'C',
        };
        const pg = (command, args, expectedExit = 0) =>
          execute(path.join(BIN, command), args, 30000, env, expectedExit);
        await db.query(
          'CREATE TABLE public.before (marker text); CREATE TABLE public.error (marker text); CREATE TABLE public.after (marker text)',
        );
        await pg('pg_dump', [
          '-Fc',
          '--schema-only',
          '--no-owner',
          '--no-privileges',
          '--table=public.before',
          '--table=public.error',
          '--table=public.after',
          '-f',
          archive,
        ]);
        const toc = orderedToc(
          (await pg('pg_restore', ['--list', archive])).stdout,
          owner,
        );
        fs.writeFileSync(list, toc, { flag: 'wx' });
        assert.equal(orderedToc(fs.readFileSync(list, 'utf8'), owner), toc);
        const value = {
          case: 'C6_SQL_ERROR',
          status: 'completed',
          intendedNegative: true,
          toc: {
            entryTypes: ['TABLE', 'TABLE', 'TABLE'],
            order: [...ORDER],
            entries: 3,
          },
          normalContinuation: { http: 0, authority: 0 },
          counts: { nativeRestores: 2, expectedSqlErrors: 2, passed: 2 },
        };
        for (const control of [false, true]) {
          await identity(db, name, owner);
          await db.query(
            "DROP TABLE IF EXISTS public.before, public.error, public.after; CREATE TABLE public.error(marker text); INSERT INTO public.error VALUES ('synthetic-preserved')",
          );
          const result = await pg(
            'pg_restore',
            [
              '--dbname',
              name,
              ...(!control ? ['--exit-on-error'] : []),
              '--no-owner',
              '--no-privileges',
              '--use-list',
              list,
              archive,
            ],
            1,
          );
          const native = classifyRestore(
            { exitCode: result.exitCode, signal: result.signal, cause: 'exit' },
            result.stderr,
            control,
          );
          await identity(db, name, owner);
          const present = (
            await db.query(
              "SELECT to_regclass('public.before') IS NOT NULL AS before, to_regclass('public.error') IS NOT NULL AS error, to_regclass('public.after') IS NOT NULL AS after",
            )
          ).rows[0];
          const rows = (await db.query('SELECT marker FROM public.error')).rows;
          const sentinels = {
            beforeExists: present.before,
            errorExists: present.error,
            markerPreserved:
              rows.length === 1 && rows[0].marker === 'synthetic-preserved',
            afterExists: present.after,
          };
          value[control ? 'control' : 'failFast'] = { native, sentinels };
        }
        return validateNegative(value);
      },
    );
  } finally {
    for (const file of [archive, list])
      if (fs.existsSync(file)) fs.unlinkSync(file);
    assert.equal(fs.existsSync(archive) || fs.existsSync(list), false);
  }
}
module.exports = {
  BIN,
  configuration,
  freshService,
  withDatabase,
  identity,
  clientVersion,
  negative,
};
