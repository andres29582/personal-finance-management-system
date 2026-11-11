const { randomUUID } = require('node:crypto');

const LOCK_NAMESPACE = 117894459;
const SERVER_OPTIONS =
  '-c lock_timeout=5000 -c statement_timeout=20000 -c idle_in_transaction_session_timeout=20000';
const IDENTITY_SQL = `/* e2e:identity */
 SELECT (current_database() = $1 AND current_user = $2
   AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole
   AND NOT r.rolreplication AND NOT r.rolbypassrls AND d.datdba = r.oid
   AND shobj_description(d.oid, 'pg_database') = 'finance-e2e-disposable'
   AND NOT EXISTS (SELECT 1 FROM pg_database other WHERE other.datdba = r.oid AND other.datname <> $1)
   AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid)) AS safe,
   pg_backend_pid() AS pid, a.backend_start::text AS "backendStart"
 FROM pg_roles r JOIN pg_database d ON d.datname = current_database()
 JOIN pg_stat_activity a ON a.pid = pg_backend_pid() WHERE r.rolname = current_user`;

function resolveConfig(env = process.env) {
  const required = (key) => {
    if (!env[key])
      throw new Error(
        `Explicit disposable E2E configuration is required: ${key}`,
      );
    return env[key];
  };
  const config = {
    host: required('E2E_DB_HOST'),
    port: Number(required('E2E_DB_PORT')),
    username: required('E2E_DB_USERNAME'),
    password: required('E2E_DB_PASSWORD'),
    database: required('E2E_DB_NAME'),
  };
  validateConfig(config);
  if (required('E2E_DB_RESET_CONFIRM') !== config.database)
    throw new Error('E2E reset confirmation does not match.');
  return config;
}

function validateConfig(config) {
  if (
    !/^finance_e2e_[a-z0-9_]{1,51}$/.test(config.database) ||
    !/^finance_e2e_[a-z0-9_]{1,51}$/.test(config.username)
  )
    throw new Error('Dedicated E2E database and role are required.');
  if (
    !Number.isInteger(config.port) ||
    config.port < 1 ||
    config.port > 65535 ||
    typeof config.host !== 'string' ||
    !config.host.trim() ||
    typeof config.password !== 'string' ||
    !config.password.trim()
  )
    throw new Error('Invalid explicit E2E connection configuration.');
}

function configureEnvironment(config, env = process.env) {
  validateConfig(config);
  Object.assign(env, {
    NODE_ENV: 'test',
    DB_HOST: config.host,
    DB_PORT: String(config.port),
    DB_USERNAME: config.username,
    DB_PASSWORD: config.password,
    DB_NAME: config.database,
    DB_SSL_MODE: 'disable',
    DB_SSL_CA_BASE64: '',
    PGOPTIONS: SERVER_OPTIONS,
    PGCONNECT_TIMEOUT: '5',
    PGSSLMODE: 'disable',
    PGSSLROOTCERT: '',
    PGSERVICE: '',
    PASSWORD_CHANGED_WORKER_ENABLED: 'false',
    PASSWORD_CHANGED_RESEND_LIVE_ENABLED: 'false',
  });
  if (env.E2E_RUN_LEASE) {
    const lease = readLease(config, env);
    env.PGAPPNAME = `finance-e2e:${lease.token}`;
  }
  return env;
}

function connectionOptions(config, applicationName) {
  validateConfig(config);
  return {
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: false,
    connectionTimeoutMillis: 5000,
    lock_timeout: 5000,
    statement_timeout: 20000,
    idle_in_transaction_session_timeout: 20000,
    query_timeout: 25000,
    options: SERVER_OPTIONS,
    application_name: applicationName,
  };
}

async function assertIdentity(client, config) {
  const { rows } = await client.query(IDENTITY_SQL, [
    config.database,
    config.username,
  ]);
  if (rows[0]?.safe !== true)
    throw new Error(
      'Disposable E2E destination or role confinement could not be verified.',
    );
  return rows[0];
}

function readLease(config, env = process.env) {
  let lease;
  try {
    lease = JSON.parse(env.E2E_RUN_LEASE);
  } catch {
    throw new Error('Active E2E run lease is required.');
  }
  if (
    !lease ||
    !/^[a-f0-9-]{36}$/.test(lease.token) ||
    !Number.isSafeInteger(lease.pid) ||
    lease.pid < 1 ||
    typeof lease.backendStart !== 'string' ||
    !lease.backendStart ||
    !['host', 'port', 'username', 'database'].every(
      (key) => lease[key] === config[key],
    )
  )
    throw new Error('E2E run lease destination or identity is invalid.');
  return lease;
}

async function assertLease(client, config, env = process.env) {
  const lease = readLease(config, env);
  const { rows } = await client.query(
    `/* e2e:admission */
    SELECT EXISTS (
      SELECT 1 FROM e2e_harness.run_claim c
      JOIN pg_stat_activity a ON a.pid = c.owner_pid AND a.backend_start = c.backend_start
      JOIN pg_locks l ON l.pid = a.pid
      WHERE c.singleton AND c.token = $1 AND c.owner_pid = $2
        AND c.backend_start = $3::timestamptz
        AND a.datname = current_database() AND a.usename = current_user
        AND a.application_name = $4 AND l.locktype = 'advisory' AND l.granted
        AND l.mode = 'ExclusiveLock' AND l.classid = $5::oid
        AND l.objid = hashtext(current_database())::oid AND l.objsubid = 2
        AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
    ) AS safe`,
    [
      lease.token,
      lease.pid,
      lease.backendStart,
      `finance-e2e-owner:${lease.token}`,
      LOCK_NAMESPACE,
    ],
  );
  if (rows[0]?.safe !== true)
    throw new Error('Active E2E run lease could not be verified.');
  return lease;
}

function combine(
  primary,
  cleanup,
  message = 'E2E operation and cleanup failed',
) {
  const errors = [primary, ...cleanup].filter((error) => error !== undefined);
  if (errors.length === 1) return errors[0];
  return errors.length ? new AggregateError(errors, message) : undefined;
}

async function withGuardedDatabase(
  config,
  env,
  callback,
  { clientFactory } = {},
) {
  const lease = readLease(config, env);
  const client = (
    clientFactory || ((options) => new (require('pg').Client)(options))
  )(connectionOptions(config, `finance-e2e:${lease.token}`));
  // A connection error must reject work, not become an unhandled EventEmitter error.
  client.on('error', () => {});
  let result, primary;
  const cleanup = [];
  try {
    await client.connect();
    await assertIdentity(client, config);
    await assertLease(client, config, env);
    result = await callback(client);
  } catch (error) {
    primary = error;
  } finally {
    // pg.Client.end destroys its socket when a query is still active.
    try {
      await client.end();
    } catch (error) {
      cleanup.push(error);
    }
  }
  const error = combine(primary, cleanup);
  if (error) throw error;
  return result;
}

async function acquireLease(config, { clientFactory, onLost = () => {} } = {}) {
  validateConfig(config);
  const token = randomUUID();
  const client = (
    clientFactory || ((options) => new (require('pg').Client)(options))
  )(connectionOptions(config, `finance-e2e-owner:${token}`));
  let closing = false,
    lost = false;
  const lose = () => {
    if (!closing && !lost) {
      lost = true;
      onLost();
    }
  };
  client.on('error', lose);
  client.on('end', lose);
  let identity;
  try {
    await client.connect();
    identity = await assertIdentity(client, config);
    const { rows } = await client.query(
      `/* e2e:lock */
      SELECT pg_try_advisory_lock($1, hashtext(current_database())) AS locked`,
      [LOCK_NAMESPACE],
    );
    if (rows[0]?.locked !== true)
      throw new Error('Disposable E2E database is already in use.');
    // The durable claim survives connection loss; only confirmed shutdown may remove it.
    await client.query(
      `/* e2e:schema */ CREATE SCHEMA IF NOT EXISTS e2e_harness`,
    );
    await client.query(`/* e2e:table */ CREATE TABLE IF NOT EXISTS e2e_harness.run_claim (
      singleton boolean PRIMARY KEY CHECK (singleton), token text NOT NULL,
      owner_pid integer NOT NULL, backend_start timestamptz NOT NULL)`);
    const inserted = await client.query(
      `/* e2e:claim */
      INSERT INTO e2e_harness.run_claim(singleton, token, owner_pid, backend_start)
      VALUES (true, $1, $2, $3::timestamptz) ON CONFLICT (singleton) DO NOTHING RETURNING token`,
      [token, identity.pid, identity.backendStart],
    );
    if (inserted.rows[0]?.token !== token)
      throw new Error(
        'Existing E2E run claim: discard and reprovision this disposable database.',
      );
    if (lost) throw new Error('E2E coordinator was lost during acquisition.');
  } catch (error) {
    closing = true;
    const cleanup = [];
    try {
      await client.end();
    } catch (failure) {
      cleanup.push(failure);
    }
    throw combine(error, cleanup);
  }
  const descriptor = {
    token,
    pid: identity.pid,
    backendStart: identity.backendStart,
    host: config.host,
    port: config.port,
    username: config.username,
    database: config.database,
  };
  const environment = {
    E2E_RUN_LEASE: JSON.stringify(descriptor),
    PGAPPNAME: `finance-e2e:${token}`,
  };
  let closed = false;
  return {
    environment,
    get healthy() {
      return !lost && !closed;
    },
    async close({ participantsStopped }) {
      if (closed) return;
      let primary;
      const cleanup = [];
      try {
        if (!participantsStopped)
          throw new Error(
            'E2E participant shutdown was not confirmed; claim retained.',
          );
        if (lost) throw new Error('E2E coordinator lost; claim retained.');
        await assertLease(client, config, environment);
        const { rows } = await client.query(`/* e2e:participants */
          SELECT count(*)::integer AS remaining FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> pg_backend_pid()`);
        if (rows[0]?.remaining !== 0)
          throw new Error(
            'E2E database still has participants; claim retained.',
          );
        await client.query('BEGIN');
        try {
          const removed = await client.query(
            `/* e2e:release-claim */
            DELETE FROM e2e_harness.run_claim WHERE singleton AND token = $1
              AND owner_pid = $2 AND backend_start = $3::timestamptz RETURNING token`,
            [token, identity.pid, identity.backendStart],
          );
          if (removed.rows[0]?.token !== token)
            throw new Error('E2E claim ownership changed.');
          const unlocked = await client.query(
            `/* e2e:unlock */
            SELECT pg_advisory_unlock($1, hashtext(current_database())) AS unlocked`,
            [LOCK_NAMESPACE],
          );
          if (unlocked.rows[0]?.unlocked !== true)
            throw new Error('E2E lease unlock could not be confirmed.');
          await client.query('COMMIT');
        } catch (error) {
          try {
            await client.query('ROLLBACK');
          } catch (failure) {
            cleanup.push(failure);
          }
          throw error;
        }
      } catch (error) {
        primary = error;
      } finally {
        closing = true;
        closed = true;
        try {
          await client.end();
        } catch (error) {
          cleanup.push(error);
        }
      }
      const error = combine(primary, cleanup);
      if (error) throw error;
    },
  };
}

module.exports = {
  LOCK_NAMESPACE,
  SERVER_OPTIONS,
  IDENTITY_SQL,
  resolveConfig,
  configureEnvironment,
  connectionOptions,
  assertIdentity,
  readLease,
  assertLease,
  acquireLease,
  combine,
  withGuardedDatabase,
};
