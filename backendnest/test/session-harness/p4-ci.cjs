const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const proof = require('./p4-proof.cjs');
const pg16 = require('./p4-pg16.cjs');
const u6 = require('./u6.cjs');
const { candidateHash } = require('./u6-runtime.cjs');
const repo = path.resolve(__dirname, '../../..');
const backend = path.join(repo, 'backendnest');
const controller = new AbortController();
const baseEnv = (root) => ({
  PATH: path.dirname(process.execPath) + ':/usr/bin:/bin',
  HOME: root,
  TMPDIR: root,
  TEMP: root,
  TMP: root,
  NODE_ENV: 'test',
  CI: 'true',
  TZ: 'UTC',
  LC_ALL: 'C',
  LANG: 'C',
});

// Public stdout/stderr never receives tool output, arguments, diagnostics or paths.
function execute(command, args, capMs, env, expectedExit = 0) {
  assert.equal(process.platform, 'linux');
  assert.equal(controller.signal.aborted, false);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: backend,
      shell: false,
      detached: true,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '',
      stderr = '',
      rejected = false;
    const stop = () => {
      rejected = true;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* The owned process group may have exited before cancellation. */
      }
    };
    const timer = setTimeout(stop, capMs);
    controller.signal.addEventListener('abort', stop, { once: true });
    for (const [stream, key] of [
      [child.stdout, 'stdout'],
      [child.stderr, 'stderr'],
    ]) {
      stream.on('data', (chunk) => {
        if (key === 'stdout') stdout += chunk.toString('utf8');
        else stderr += chunk.toString('utf8');
        if (stdout.length + stderr.length > 16 * 1024 * 1024) stop();
      });
    }
    child.once('error', () => {
      rejected = true;
    });
    child.once('close', (exitCode, signal) => {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', stop);
      try {
        // A completed root with a surviving descendant is a failure, not cleanup proof.
        try {
          process.kill(-child.pid, 0);
          stop();
        } catch (error) {
          assert.equal(error.code, 'ESRCH');
        }
        assert.equal(rejected, false);
        assert.equal(signal, null);
        assert.equal(exitCode, expectedExit);
        resolve({ stdout, stderr, exitCode, signal });
      } catch {
        reject(Error('P4_COMMAND_REJECTED'));
      }
    });
  });
}
async function main() {
  assert.equal(process.argv.length, 2);
  const config = pg16.configuration(process.env);
  assert.match(process.version, /^v22\./);
  const expected = proof.binding({
    commit: config.commit,
    runId: config.runId,
    attempt: config.attempt,
  });
  const tmp = path.join(repo, '.tmp');
  fs.mkdirSync(tmp, { recursive: true });
  assert.equal(fs.lstatSync(tmp).isSymbolicLink(), false);
  const root = fs.mkdtempSync(path.join(tmp, 'p4-private-'));
  fs.chmodSync(root, 0o700);
  const env = baseEnv(root);
  const command = (cmd, args, cap, extra = {}, exit = 0) =>
    execute(cmd, args, cap, { ...env, ...extra }, exit);
  const node = (args, cap, extra) =>
    command(process.execPath, args, cap, extra);
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const head = await command(
      '/usr/bin/git',
      ['-C', repo, 'rev-parse', 'HEAD'],
      10000,
    );
    assert.equal(head.stdout.trim(), config.commit);
    await command(
      '/usr/bin/git',
      ['-C', repo, 'diff', '--no-ext-diff', '--exit-code', 'HEAD', '--'],
      10000,
    );
    assert.equal(
      (
        await command(
          '/usr/bin/git',
          ['-C', repo, 'ls-files', '--others', '--exclude-standard'],
          10000,
        )
      ).stdout,
      '',
    );
    const source = u6.inventory();
    const checks = [];
    const check = async (id, action) => {
      assert.equal(proof.CHECKS[checks.length][0], id);
      const start = Date.now();
      const value = await action();
      const durationMs = Date.now() - start;
      assert.ok(durationMs <= proof.CHECKS[checks.length][1]);
      checks.push({ id, status: 'PASS', exitCode: 0, durationMs });
      console.log('P4_CHECK_PASS:' + id);
      return value;
    };
    await check('types-full', () =>
      node(
        [
          'node_modules/typescript/bin/tsc',
          '--noEmit',
          '--incremental',
          'false',
          '-p',
          'tsconfig.json',
        ],
        120000,
      ),
    );
    await check('types-build', () =>
      node(
        [
          'node_modules/typescript/bin/tsc',
          '--noEmit',
          '--incremental',
          'false',
          '-p',
          'tsconfig.build.json',
        ],
        120000,
      ),
    );
    await node(['test/session-harness/p4-proof.spec.cjs'], 60000);
    await check('u6-test', () =>
      node(['test/session-harness/u6.spec.cjs'], 60000),
    );
    await check('u6-check', async () => {
      const result = await node(
        ['test/session-harness/u6.cjs', '--mode=OFFLINE_CHECKS'],
        660000,
      );
      const summary = JSON.parse(result.stdout.trim().split('\n').at(-1));
      assert.match(
        summary.evidence,
        /^\.tmp\/u6-[A-Za-z0-9_-]+\/portable\/manifest\.json$/,
      );
      const file = path.join(repo, summary.evidence);
      const value = u6.verifyArtifact(
        fs.readFileSync(file),
        fs
          .readFileSync(
            path.join(path.dirname(file), 'manifest.sha256'),
            'utf8',
          )
          .trim(),
      );
      assert.equal(value.mode, 'OFFLINE_CHECKS');
      assert.equal(value.globalTypes, 'PASS');
      assert.equal(value.checks.length, 6);
      assert.ok(value.checks.every((item) => item.status === 'PASS'));
      assert.equal(value.remoteCI, 'NOT_TESTED'); // Historical U6 schema is deliberately unchanged.
      assert.deepEqual(value.source, source);
    });
    const server = await pg16.freshService(config);
    const dump = pg16.clientVersion(
      (await command(path.join(pg16.BIN, 'pg_dump'), ['--version'], 10000))
        .stdout,
      'pg_dump',
    );
    const restore = pg16.clientVersion(
      (await command(path.join(pg16.BIN, 'pg_restore'), ['--version'], 10000))
        .stdout,
      'pg_restore',
    );
    const negative = await check('pg16-negative', () =>
      pg16.negative(config, root, command),
    );
    const e2e = await check('pg16-e2e', () =>
      pg16.withDatabase(config, 'e2e', async ({ name, owner, password }) => {
        const output = path.join(root, 'e2e.json');
        await node(
          [
            'test/e2e-runner.cjs',
            '--no-cache',
            '--json',
            '--outputFile',
            output,
          ],
          900000,
          {
            E2E_DB_HOST: config.host,
            E2E_DB_PORT: String(config.port),
            E2E_DB_USERNAME: owner,
            E2E_DB_PASSWORD: password,
            E2E_DB_NAME: name,
            E2E_DB_RESET_CONFIRM: name,
          },
        );
        return proof.e2eSummary(JSON.parse(fs.readFileSync(output, 'utf8')));
      }),
    );
    assert.deepEqual(u6.inventory(), source);
    await command(
      '/usr/bin/git',
      ['-C', repo, 'diff', '--no-ext-diff', '--exit-code', 'HEAD', '--'],
      10000,
    );
    // Remove every private archive/report before constructing the portable export.
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
    const exportRoot = path.join(tmp, 'p4-export');
    fs.mkdirSync(exportRoot);
    proof.write(
      exportRoot,
      {
        schemaVersion: 1,
        scope: 'P4_PG16_ONLY',
        ...expected,
        sourceSha256: candidateHash(source),
        versions: { node: process.version, server, dump, restore },
        checks,
        negative,
        e2e,
        cleanup: {
          databasesRemoved: true,
          rolesRemoved: true,
          archiveRemoved: true,
          commandGroupsExited: true,
          service: 'GITHUB_JOB_OWNED',
        },
        policy: {
          audience: 'PUBLIC',
          custodian: 'REPOSITORY_OWNER',
          artifactRetentionDays: 7,
          removal: 'OWNER_DELETE_AND_VERIFY',
        },
        closure: 'U6_ETAPA2_OPEN',
        production: 'BLOCKED',
      },
      expected,
    );
    console.log(
      'P4_EXPORT_VALIDATED; REMOTE_ACCEPTANCE_REQUIRES_DOWNLOAD_READBACK',
    );
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true });
  }
}
module.exports = { baseEnv, execute };
if (require.main === module)
  main().catch(() => {
    console.error(
      'P4_FAILED_CLOSED; NO_PRIVATE_UPLOAD; U6_OPEN; PRODUCTION_BLOCKED',
    );
    process.exitCode = 1;
  });
