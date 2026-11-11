const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { once } = require('node:events');
const {
  cleanEnv,
  launchOwner,
  assignJob,
  waitExit,
  repo,
} = require('./u6-owned.cjs');
const { validateBinding } = require('./u6-runtime.cjs');
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
for (const orphan of [false, true])
  test(
    'actual synthetic Windows job ' +
      (orphan
        ? 'refuses orphan success and contains descendant'
        : 'cancellation permits owner and descendant cleanup'),
    { timeout: 60000 },
    async () => {
      assert.equal(process.platform, 'win32');
      const root = fs.mkdtempSync(path.join(repo, '.tmp/u6-owned-pure-'));
      const binding = {
        case: 'C6',
        candidate: 'a'.repeat(64),
        runnerCandidate: 'b'.repeat(64),
        token: crypto.randomUUID(),
        root: '.tmp/u6-runtime-' + crypto.randomUUID(),
      };
      const child = launchOwner(
        path.join(__dirname, 'u6-synthetic-owner.cjs'),
        orphan ? ['orphan'] : [],
        binding,
        root,
      );
      let job;
      try {
        const [hello] = await once(child, 'message');
        validateBinding(hello, binding, 'owned');
        job = await assignJob(child, root);
        const completed = orphan
          ? waitExit(child, 10000)
          : once(child, 'message');
        child.send({ schemaVersion: 2, type: 'go', ...binding });
        if (orphan) {
          assert.equal((await completed).code, 0);
          await assert.rejects(() => job.finish(), /Owned descendants/);
        } else {
          const [done] = await completed;
          validateBinding(done, binding, 'complete');
          child.send({ schemaVersion: 2, type: 'cancel', ...binding });
          assert.equal((await waitExit(child, 10000)).code, 0);
          assert.equal(await job.finish(), true);
        }
      } finally {
        if (child.connected)
          child.send({ schemaVersion: 2, type: 'cancel', ...binding });
        job?.abandon();
      }
    },
  );
