const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanEnv } = require('./u6-owned.cjs');
test('owned transport has a closed clean environment without inherited database or provider secrets', () => {
  const env = cleanEnv('synthetic');
  assert.equal(env.NODE_OPTIONS, undefined);
  assert.equal(env.DB_HOST, undefined);
  assert.equal(env.PGPASSWORD, undefined);
  assert.deepEqual(
    Object.keys(env).sort(),
    [
      'NODE_ENV',
      'PATH',
      'ProgramFiles',
      'SystemRoot',
      'TEMP',
      'TMP',
      'TZ',
      'WINDIR',
    ].sort(),
  );
});
