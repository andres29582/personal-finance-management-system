const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { run } = require('./e2e-runner.cjs');
const env = {
  E2E_DB_HOST: '127.0.0.1',
  E2E_DB_PORT: '55434',
  E2E_DB_USERNAME: 'finance_e2e_owner',
  E2E_DB_PASSWORD: 'synthetic-only',
  E2E_DB_NAME: 'finance_e2e_mock',
  E2E_DB_RESET_CONFIRM: 'finance_e2e_mock',
};
function fixture(action, closeError) {
  const calls = [];
  let onLost;
  const child = new EventEmitter();
  child.pid = 123;
  child.kill = () => {
    calls.push('kill');
    queueMicrotask(() => child.emit('close', null, 'SIGTERM'));
    return true;
  };
  const lease = {
    healthy: true,
    environment: {},
    close: async (value) => {
      calls.push(['lease-close', value]);
      if (closeError) throw closeError;
    },
  };
  return {
    calls,
    lease,
    dependencies: {
      acquireLease: async (_config, options) => {
        onLost = options.onLost;
        return lease;
      },
      spawn: (_exe, args, options) => {
        calls.push(['spawn', args, options.env]);
        queueMicrotask(() => action(child, () => onLost()));
        return child;
      },
    },
  };
}
test('launcher holds lease until child close and closes a known completed run', async () => {
  const f = fixture((child) => child.emit('close', 0, null));
  await run(env, ['--json'], f.dependencies);
  assert.equal(f.calls[0][0], 'spawn');
  assert.equal(f.calls[0][2].NODE_ENV, 'test');
  assert.deepEqual(f.calls.at(-1), [
    'lease-close',
    { participantsStopped: true },
  ]);
});
test('launcher preserves child failure plus closing failure', async () => {
  const close = new Error('claim close failure');
  const f = fixture((child) => child.emit('close', 1, null), close);
  await assert.rejects(run(env, [], f.dependencies), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors[1], close);
    return true;
  });
  assert.deepEqual(f.calls.at(-1), [
    'lease-close',
    { participantsStopped: false },
  ]);
});
test('coordinator failure stops its child and is never treated as success', async () => {
  const f = fixture((_child, lost) => lost());
  await assert.rejects(run(env, [], f.dependencies), /coordinator/);
  assert.ok(f.calls.includes('kill'));
  assert.deepEqual(f.calls.at(-1), [
    'lease-close',
    { participantsStopped: false },
  ]);
});
test('invalid destination is rejected before spawning or opening a lease', async () => {
  let touched = false;
  await assert.rejects(
    run({}, [], {
      acquireLease: async () => {
        touched = true;
      },
    }),
  );
  assert.equal(touched, false);
});
