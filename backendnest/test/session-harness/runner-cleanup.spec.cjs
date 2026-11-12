const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { settleCleanup } = require('./u6-runtime.cjs');
const source = fs.readFileSync(path.join(__dirname, 'runner.cjs'), 'utf8');
const start = source.indexOf('  // Preserve primary failures');
const end = source.indexOf('\n}\nmain()', start);
assert.ok(start > 0 && end > start);
const tail = source.slice(start, end);

async function run({
  primary,
  cleanupFailure,
  malformed = false,
  cancelled = false,
} = {}) {
  const calls = [];
  const context = {
    primaryFailed: primary !== undefined,
    primaryFailure: primary,
    cancellation: { cancelled, beginCleanup: () => calls.push('begin') },
    proof: { status: 'completed', externalBefore: { identity: 'same' } },
    counts: {},
    selected: 'U5B',
    root: 'synthetic',
    path,
    assert,
    settleCleanup,
    fs: { existsSync: () => malformed, readFileSync: () => '{' },
    cleanup: async () => {
      calls.push('cleanup');
      if (cleanupFailure) throw cleanupFailure;
    },
    integrity: () => calls.push('integrity'),
    frozen: [],
    external: async () => {
      calls.push('external');
      return { identity: 'same' };
    },
    validateCleanup: () => calls.push('validate'),
  };
  let failure;
  try {
    await vm.runInNewContext('(async () => {' + tail + '\n})()', context, {
      timeout: 1000,
    });
  } catch (error) {
    failure = error;
  }
  return { calls, failure, proof: context.proof };
}
test('keeps the original work error together with cleanup errors and performs readbacks', async () => {
  const primary = Error('original failure'),
    cleanupFailure = Error('cleanup failure');
  const result = await run({ primary, cleanupFailure });
  assert.deepEqual(result.failure.errors, [primary, cleanupFailure]);
  assert.deepEqual(result.calls, ['begin', 'cleanup', 'integrity', 'external']);
});
test('malformed child evidence cannot bypass cleanup or source/external readback', async () => {
  const result = await run({ malformed: true });
  assert.equal(result.failure.errors.length, 1);
  assert.deepEqual(result.calls, ['begin', 'cleanup', 'integrity', 'external']);
});
test('cancellation remains a failure after all cleanup and readbacks', async () => {
  const result = await run({ cancelled: true });
  assert.equal(result.failure.errors.length, 1);
  assert.match(result.failure.errors[0].message, /cancelled/);
  assert.equal(result.proof.status, 'cancelled');
  assert.deepEqual(result.calls, ['begin', 'cleanup', 'integrity', 'external']);
});
