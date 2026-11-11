const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const runtime = require('./e2e-runtime.cjs');

const config = {
  host: '127.0.0.1',
  port: 55434,
  username: 'finance_e2e_owner',
  password: 'synthetic-not-a-credential',
  database: 'finance_e2e_mock',
};
function fixture(overrides = {}) {
  const calls = [];
  const client = new EventEmitter();
  let claimed = false;
  client.connect = async () => calls.push('connect');
  client.end = async () => {
    calls.push('end');
    client.emit('end');
  };
  client.query = async (sql, args) => {
    const operation = /e2e:([a-z-]+)/.exec(sql)?.[1] || sql;
    calls.push(operation);
    if (overrides[operation]) return overrides[operation](args);
    switch (operation) {
      case 'identity':
        return {
          rows: [
            { safe: true, pid: 42, backendStart: '2026-10-22 00:00:00+00' },
          ],
        };
      case 'lock':
        return { rows: [{ locked: true }] };
      case 'claim':
        claimed = true;
        return { rows: [{ token: args[0] }] };
      case 'admission':
        return { rows: [{ safe: claimed }] };
      case 'participants':
        return { rows: [{ remaining: 0 }] };
      case 'release-claim':
        return { rows: [{ token: args[0] }] };
      case 'unlock':
        return { rows: [{ unlocked: true }] };
      default:
        return { rows: [] };
    }
  };
  let connectionOptions;
  const options = {
    clientFactory: (options) => {
      connectionOptions = options;
      return client;
    },
  };
  return {
    client,
    calls,
    options,
    get connectionOptions() {
      return connectionOptions;
    },
  };
}

test('unsafe identity rejects before lock, schema or claim DDL and closes', async () => {
  const f = fixture({ identity: async () => ({ rows: [{ safe: false }] }) });
  await assert.rejects(runtime.acquireLease(config, f.options), /confinement/);
  assert.deepEqual(f.calls, ['connect', 'identity', 'end']);
});
test('timeouts are installed before the very first connection/query', async () => {
  const f = fixture();
  const lease = await runtime.acquireLease(config, f.options);
  assert.equal(f.connectionOptions.connectionTimeoutMillis, 5000);
  assert.equal(f.connectionOptions.lock_timeout, 5000);
  assert.equal(f.connectionOptions.statement_timeout, 20000);
  assert.equal(f.connectionOptions.query_timeout, 25000);
  assert.ok(f.calls.indexOf('identity') < f.calls.indexOf('schema'));
  assert.ok(f.calls.indexOf('lock') < f.calls.indexOf('schema'));
  await lease.close({ participantsStopped: true });
});
test('contending session rejects before claim/schema and never waits', async () => {
  const f = fixture({ lock: async () => ({ rows: [{ locked: false }] }) });
  await assert.rejects(
    runtime.acquireLease(config, f.options),
    /already in use/,
  );
  assert.deepEqual(f.calls, ['connect', 'identity', 'lock', 'end']);
});
test('existing persistent claim is never replaced or cleared', async () => {
  const f = fixture({ claim: async () => ({ rows: [] }) });
  await assert.rejects(runtime.acquireLease(config, f.options), /reprovision/);
  assert.ok(!f.calls.includes('release-claim'));
  assert.equal(f.calls.at(-1), 'end');
});
test('successful close checks admission and participants before clearing claim', async () => {
  const f = fixture();
  const lease = await runtime.acquireLease(config, f.options);
  const value = runtime.readLease(config, lease.environment);
  assert.equal(value.pid, 42);
  assert.equal(value.backendStart, '2026-10-22 00:00:00+00');
  await lease.close({ participantsStopped: true });
  const tail = f.calls.slice(f.calls.indexOf('admission'));
  assert.deepEqual(tail, [
    'admission',
    'participants',
    'BEGIN',
    'release-claim',
    'unlock',
    'COMMIT',
    'end',
  ]);
});
test('unknown shutdown keeps claim and closes the coordinator', async () => {
  const f = fixture();
  const lease = await runtime.acquireLease(config, f.options);
  await assert.rejects(lease.close({ participantsStopped: false }), /shutdown/);
  assert.ok(!f.calls.includes('release-claim'));
  assert.equal(f.calls.at(-1), 'end');
});
test('a surviving participant keeps the claim', async () => {
  const f = fixture({
    participants: async () => ({ rows: [{ remaining: 1 }] }),
  });
  const lease = await runtime.acquireLease(config, f.options);
  await assert.rejects(
    lease.close({ participantsStopped: true }),
    /participants/,
  );
  assert.ok(!f.calls.includes('release-claim'));
});
test('coordinator loss keeps claim and causes successor acquisition to reject', async () => {
  const f = fixture();
  let lost = 0;
  const lease = await runtime.acquireLease(config, {
    ...f.options,
    onLost: () => lost++,
  });
  f.client.emit('error', new Error('synthetic disconnect'));
  assert.equal(lost, 1);
  await assert.rejects(
    lease.close({ participantsStopped: true }),
    /coordinator/,
  );
  assert.ok(!f.calls.includes('release-claim'));
  const successor = fixture({ claim: async () => ({ rows: [] }) });
  await assert.rejects(
    runtime.acquireLease(config, successor.options),
    /reprovision/,
  );
});
test('failed unlock rolls back claim deletion and preserves cleanup failures', async () => {
  const failure = new Error('synthetic unlock error');
  const f = fixture({
    unlock: async () => {
      throw failure;
    },
  });
  const lease = await runtime.acquireLease(config, f.options);
  await assert.rejects(lease.close({ participantsStopped: true }), failure);
  assert.ok(f.calls.includes('ROLLBACK'));
  assert.ok(!f.calls.includes('COMMIT'));
  assert.equal(f.calls.at(-1), 'end');
});
test('primary and closing failures both survive', async () => {
  const primary = new Error('synthetic primary');
  const closing = new Error('synthetic close');
  const f = fixture({
    identity: async () => {
      throw primary;
    },
  });
  f.client.end = async () => {
    throw closing;
  };
  await assert.rejects(runtime.acquireLease(config, f.options), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [primary, closing]);
    return true;
  });
});
test('malformed, mismatched, missing and reused PID lease envelopes reject before SQL', async () => {
  for (const env of [
    {},
    { E2E_RUN_LEASE: '{}' },
    { E2E_RUN_LEASE: 'invalid' },
  ]) {
    assert.throws(() => runtime.readLease(config, env), /lease/);
  }
  const f = fixture();
  const lease = await runtime.acquireLease(config, f.options);
  assert.throws(
    () => runtime.readLease({ ...config, port: 5432 }, lease.environment),
    /destination/,
  );
  const denied = fixture({
    admission: async () => ({ rows: [{ safe: false }] }),
  });
  await assert.rejects(
    runtime.assertLease(denied.client, config, lease.environment),
    /lease/,
  );
  assert.deepEqual(denied.calls, ['admission']);
  await lease.close({ participantsStopped: true });
});
test('closed profile drops inherited PG options, TLS CA and notification flags', () => {
  const env = runtime.configureEnvironment(config, {
    PGOPTIONS: '-c statement_timeout=0',
    DB_SSL_CA_BASE64: 'synthetic',
    PASSWORD_CHANGED_WORKER_ENABLED: 'true',
    PASSWORD_CHANGED_RESEND_LIVE_ENABLED: 'true',
  });
  assert.equal(env.DB_SSL_CA_BASE64, '');
  assert.equal(env.PASSWORD_CHANGED_WORKER_ENABLED, 'false');
  assert.equal(env.PASSWORD_CHANGED_RESEND_LIVE_ENABLED, 'false');
  assert.equal(
    env.PGOPTIONS,
    '-c lock_timeout=5000 -c statement_timeout=20000 -c idle_in_transaction_session_timeout=20000',
  );
});

test('destructive participant rejects missing lease before even constructing a client', async () => {
  let opened = false;
  await assert.rejects(
    runtime.withGuardedDatabase(config, {}, async () => {}, {
      clientFactory: () => {
        opened = true;
        throw new Error('must not open');
      },
    }),
    /lease/,
  );
  assert.equal(opened, false);
});
test('destructive participant checks confinement then live claim before any callback SQL', async () => {
  const owner = fixture();
  const lease = await runtime.acquireLease(config, owner.options);
  const f = fixture({ admission: async () => ({ rows: [{ safe: true }] }) });
  await runtime.withGuardedDatabase(
    config,
    lease.environment,
    async (client) => {
      await client.query('DROP SCHEMA public CASCADE');
    },
    f.options,
  );
  assert.deepEqual(f.calls, [
    'connect',
    'identity',
    'admission',
    'DROP SCHEMA public CASCADE',
    'end',
  ]);
  await lease.close({ participantsStopped: true });
});
for (const denied of ['identity', 'admission']) {
  test(`destructive participant rejects ${denied} without calling DDL`, async () => {
    const owner = fixture();
    const lease = await runtime.acquireLease(config, owner.options);
    const f = fixture({ [denied]: async () => ({ rows: [{ safe: false }] }) });
    let callbackRan = false;
    await assert.rejects(
      runtime.withGuardedDatabase(
        config,
        lease.environment,
        async () => {
          callbackRan = true;
        },
        f.options,
      ),
    );
    assert.equal(callbackRan, false);
    assert.equal(f.calls.at(-1), 'end');
    await lease.close({ participantsStopped: true });
  });
}
test('migration failure stops callback and preserves failure together with closing error', async () => {
  const owner = fixture();
  const lease = await runtime.acquireLease(config, owner.options);
  const f = fixture({ admission: async () => ({ rows: [{ safe: true }] }) });
  const primary = new Error('migration SQL failure'),
    close = new Error('pool close failure');
  f.client.end = async () => {
    throw close;
  };
  await assert.rejects(
    runtime.withGuardedDatabase(
      config,
      lease.environment,
      async () => {
        throw primary;
      },
      f.options,
    ),
    (error) => {
      assert.deepEqual(error.errors, [primary, close]);
      return true;
    },
  );
  await lease.close({ participantsStopped: true });
});

test('raw Jest setup rejects absent launcher lease without opening a connection', () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const source = fs.readFileSync(
    require.resolve('./e2e-environment.cjs'),
    'utf8',
  );
  const synthetic = {
    E2E_DB_HOST: config.host,
    E2E_DB_PORT: String(config.port),
    E2E_DB_USERNAME: config.username,
    E2E_DB_PASSWORD: config.password,
    E2E_DB_NAME: config.database,
    E2E_DB_RESET_CONFIRM: config.database,
  };
  const api = {
    resolveConfig: () => runtime.resolveConfig(synthetic),
    readLease: (config) => runtime.readLease(config, synthetic),
    configureEnvironment: () =>
      assert.fail('profile must not be applied after rejected admission'),
  };
  assert.throws(
    () => vm.runInNewContext(source, { require: () => api }),
    /lease/,
  );
});

test('test AppModule explicitly disables dotenv before importing application providers', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(
    require.resolve('../src/app.module.ts'),
    'utf8',
  );
  const expression = /ConfigModule\.forRoot\((\{[\s\S]*?\})\)/.exec(
    source,
  )?.[1];
  assert.ok(expression);
  const options = new Function('process', `return (${expression});`);
  assert.equal(options({ env: { NODE_ENV: 'test' } }).ignoreEnvFile, true);
  assert.equal(
    options({ env: { NODE_ENV: 'development' } }).ignoreEnvFile,
    false,
  );
});
