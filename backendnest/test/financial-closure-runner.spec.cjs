const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  ownedData,
  assertOwner,
  assertServer,
  releaseAllowed,
  cleanEnvironment,
} = require('./financial-closure-runner.cjs');
test('rejects stale sentinels and an unrelated server before privileged writes', () => {
  const nonce = 'a'.repeat(32);
  const root = path.resolve(__dirname, '../../.tmp/financial-runtime-' + nonce);
  const data = path.join(root, 'data');
  const owner = { nonce, data, port: 55438 };
  assert.doesNotThrow(() => assertOwner(owner, root, data));
  assert.throws(() =>
    assertOwner({ ...owner, nonce: 'b'.repeat(32) }, root, data),
  );
  assert.throws(() =>
    assertOwner({ ...owner, data: path.dirname(data) }, root, data),
  );
  assert.throws(() => assertOwner({ ...owner, port: 5432 }, root, data));
  assert.doesNotThrow(() =>
    assertServer({ directory: data, port: 55438 }, data),
  );
  assert.throws(() =>
    assertServer({ directory: path.dirname(data), port: 55438 }, data),
  );
  assert.throws(() => assertServer({ directory: data, port: 5432 }, data));
});
test('rejects non-owned cluster shutdown targets', () => {
  assert.throws(() => ownedData('C:/existing', 'C:/existing/data'));
  const root = path.resolve(__dirname, '../../.tmp/financial-selftest');
  assert.equal(
    ownedData(root, path.join(root, 'data')),
    path.join(root, 'data'),
  );
  assert.throws(() => ownedData(root, path.resolve(root, '../data')));
});
test('retains claims after failure, cancellation or incomplete cleanup', () => {
  assert.equal(releaseAllowed(true, false, [], true), true);
  for (const args of [
    [false, false, [], true],
    [true, true, [], true],
    [true, false, [new Error('cleanup')], true],
    [true, false, [], false],
  ])
    assert.equal(releaseAllowed(...args), false);
});
test('does not inherit application database or dotenv destination', () => {
  const env = cleanEnvironment(
    path.resolve(__dirname, '../../.tmp/financial-selftest'),
  );
  assert.equal(env.DB_HOST, undefined);
  assert.equal(env.E2E_DB_HOST, undefined);
  assert.equal(env.EXPO_NO_DOTENV, '1');
});

test('clean environment also works on hosts without Windows system variables', () => {
  const previous = process.env.SystemRoot;
  try {
    delete process.env.SystemRoot;
    const env = cleanEnvironment('synthetic-private-root');
    assert.equal(env.SystemRoot, undefined);
    assert.equal(env.WINDIR, undefined);
    assert.equal(env.PATH.includes('undefined'), false);
    assert.equal(env.DB_PASSWORD, undefined);
  } finally {
    if (previous === undefined) delete process.env.SystemRoot;
    else process.env.SystemRoot = previous;
  }
});
