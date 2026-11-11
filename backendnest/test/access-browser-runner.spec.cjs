const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { ports, staticFile, run } = require('./access-browser-runner.cjs');

test('access runner refuses missing disposable configuration before allocating resources', async () => {
  await assert.rejects(run({}), /Explicit|E2E|disposable/i);
});
test('access runner rejects privileged, equal and malformed listener ports', () => {
  for (const env of [
    { ACCESS_API_PORT: '80' },
    { ACCESS_API_PORT: '4319', ACCESS_WEB_PORT: '4319' },
    { ACCESS_WEB_PORT: 'not-a-port' },
  ])
    assert.throws(() => ports(env));
});
test('static access server confines encoded traversal to its generated export', () => {
  const root = path.resolve('access-export');
  assert.equal(staticFile(root, '/login'), path.join(root, 'login'));
  assert.throws(() => staticFile(root, '/..%2f..%2fprivate'));
  assert.throws(() => staticFile(root, '/%5c..%5c..%5cprivate'));
});
