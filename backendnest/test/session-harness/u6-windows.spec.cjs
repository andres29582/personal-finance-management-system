const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { once } = require('node:events');
const {
  launchOwner,
  assignJob,
  waitExit,
  repo,
  cleanEnv,
} = require('./u6-owned.cjs');
const { validateBinding } = require('./u6-runtime.cjs');

// Cold hosted Windows images can spend the guardian handshake window loading
// PowerShell's C# compiler. Qualify that dependency before launching owned work.
// The existing 3-minute CI step, 60-second cases and guardian caps stay unchanged.
before(
  () => {
    assert.equal(process.platform, 'win32');
    fs.mkdirSync(path.join(repo, '.tmp'), { recursive: true });
    const root = fs.mkdtempSync(path.join(repo, '.tmp/u6-compiler-'));
    const fd = fs.openSync(path.join(root, 'compiler-private.log'), 'wx');
    let result;
    try {
      result = spawnSync(
        path.join(
          process.env.SystemRoot,
          'System32/WindowsPowerShell/v1.0/powershell.exe',
        ),
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          "Add-Type -TypeDefinition 'public static class U6CompilerProbe { public static int Ready() { return 1; } }'; if ([U6CompilerProbe]::Ready() -ne 1) { exit 1 }",
        ],
        {
          cwd: root,
          env: cleanEnv(root),
          shell: false,
          windowsHide: true,
          stdio: ['ignore', fd, fd],
          timeout: 55000,
        },
      );
    } finally {
      fs.closeSync(fd);
    }
    assert.equal(
      result.error,
      undefined,
      'PowerShell compiler preflight unavailable',
    );
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, 'PowerShell compiler preflight failed');
  },
  { timeout: 60000 },
);

for (const orphan of [false, true])
  test(
    'actual synthetic Windows job ' +
      (orphan
        ? 'refuses orphan success and contains descendant'
        : 'cancellation permits owner and descendant cleanup'),
    { timeout: 60000 },
    async () => {
      assert.equal(process.platform, 'win32');
      fs.mkdirSync(path.join(repo, '.tmp'), { recursive: true });
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
