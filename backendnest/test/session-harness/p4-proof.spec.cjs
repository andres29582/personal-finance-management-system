const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const proof = require('./p4-proof.cjs');
const pg16 = require('./p4-pg16.cjs');

test('the U6 entrypoint used by both P4 paths registers portable tests without Windows jobs', () => {
  const vm = require('node:vm');
  const { createRequire } = require('node:module');
  const registered = [];
  const loaded = new Set();
  const load = (file) => {
    if (loaded.has(file)) return;
    loaded.add(file);
    const localRequire = createRequire(file);
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
      __dirname: path.dirname(file),
      module: { exports: {} },
      require: (id) => {
        if (id === 'node:test')
          return { test: (name) => registered.push(name) };
        if (id.endsWith('.spec.cjs')) return load(localRequire.resolve(id));
        return localRequire(id);
      },
      process: { platform: 'linux' },
    });
  };
  load(path.join(__dirname, 'u6.spec.cjs'));
  assert.ok(registered.length > 20);
  assert.ok(registered.some((name) => name.startsWith('owned transport')));
  assert.equal(
    registered.some((name) => name.startsWith('actual synthetic Windows job')),
    false,
  );
  const portableCount = registered.length;
  load(path.join(__dirname, 'u6-windows.spec.cjs'));
  assert.equal(registered.length - portableCount, 2);
  assert.ok(
    registered
      .slice(portableCount)
      .every((name) => name.startsWith('actual synthetic Windows job')),
  );
});

function fixture() {
  const phase = (afterExists) => ({
    native: {
      exitCode: 1,
      signal: null,
      cause: 'exit',
      diagnosticCategory: 'duplicate_table',
      observedSqlState: null,
    },
    sentinels: {
      beforeExists: true,
      errorExists: true,
      markerPreserved: true,
      afterExists,
    },
  });
  return {
    schemaVersion: 1,
    scope: 'P4_PG16_ONLY',
    commit: 'a'.repeat(40),
    runId: '123456',
    attempt: '1',
    sourceSha256: 'b'.repeat(64),
    versions: {
      node: 'v22.14.0',
      server: 160008,
      dump: '16.8',
      restore: '16.8',
    },
    checks: proof.CHECKS.map(([id]) => ({
      id,
      status: 'PASS',
      exitCode: 0,
      durationMs: 1,
    })),
    negative: {
      case: 'C6_SQL_ERROR',
      status: 'completed',
      intendedNegative: true,
      toc: {
        entryTypes: ['TABLE', 'TABLE', 'TABLE'],
        order: ['before', 'error', 'after'],
        entries: 3,
      },
      failFast: phase(false),
      control: phase(true),
      normalContinuation: { http: 0, authority: 0 },
      counts: { nativeRestores: 2, expectedSqlErrors: 2, passed: 2 },
    },
    e2e: { suites: 1, tests: 2, passedAssertionResults: 2 },
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
  };
}
const expected = { commit: 'a'.repeat(40), runId: '123456', attempt: '1' };

test('closed PG16 proof admits only the complete bounded remote result', () => {
  assert.equal(proof.validate(fixture(), expected).production, 'BLOCKED');
});

test('all unknown fields, including nested credentials and raw logs, are rejected', () => {
  for (const group of [
    '',
    'versions',
    'policy',
    'cleanup',
    'negative',
    'negative.failFast.native',
    'e2e',
    'checks.0',
  ]) {
    const value = fixture();
    const target = group
      ? group.split('.').reduce((node, key) => node[key], value)
      : value;
    target.raw = '/home/private/password=synthetic';
    assert.throws(() => proof.validate(value, expected));
  }
});

test('privacy strings cannot enter any admitted scalar slot', () => {
  const walk = (node, prefix = []) =>
    Object.entries(node).flatMap(([key, value]) =>
      value && typeof value === 'object'
        ? walk(value, [...prefix, key])
        : [[...prefix, key]],
    );
  for (const keys of walk(fixture())) {
    for (const injection of [
      'secret@example.test',
      'postgres://fake:fake@host/db',
      '/home/private',
      'Bearer fake.jwt',
      'C:\\private\\.env',
      'line\n::warning::raw',
    ]) {
      const value = fixture();
      const target = keys.slice(0, -1).reduce((node, key) => node[key], value);
      target[keys.at(-1)] = injection;
      assert.throws(() => proof.validate(value, expected));
    }
  }
});

test('commit, run, attempt and caller binding are required independently', () => {
  for (const key of ['commit', 'runId', 'attempt']) {
    assert.throws(() =>
      proof.validate(fixture(), {
        ...expected,
        [key]: key === 'commit' ? 'c'.repeat(40) : '2',
      }),
    );
    const value = fixture();
    delete value[key];
    assert.throws(() => proof.validate(value, expected));
  }
  assert.throws(() => proof.validate(fixture(), {}));
});

test('failed, skipped, repeated or out-of-order checks never qualify', () => {
  for (const mutate of [
    (v) => v.checks.pop(),
    (v) => v.checks.reverse(),
    (v) => v.checks.push(v.checks[0]),
    (v) => (v.checks[0].status = 'NOT_TESTED'),
    (v) => (v.checks[0].exitCode = 1),
    (v) => (v.checks[0].durationMs = 1e12),
  ]) {
    const value = fixture();
    mutate(value);
    assert.throws(() => proof.validate(value, expected));
  }
});

test('wrong PG major, missing E2E and incomplete cleanup fail closed', () => {
  for (const mutate of [
    (v) => (v.versions.server = 180003),
    (v) => (v.versions.dump = '18.3'),
    (v) => (v.versions.restore = '15.8'),
    (v) => (v.e2e.passedAssertionResults = 0),
    (v) => (v.cleanup.rolesRemoved = false),
    (v) => (v.negative.failFast.sentinels.afterExists = true),
    (v) => (v.closure = 'CLOSED'),
  ]) {
    const value = fixture();
    mutate(value);
    assert.throws(() => proof.validate(value, expected));
  }
});

test('download readback requires exact two-file allowlist, bytes, checksum and origin', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p4-proof-test-'));
  try {
    proof.write(root, fixture(), expected);
    assert.equal(proof.read(root, expected).commit, expected.commit);
    fs.writeFileSync(path.join(root, 'raw.log'), 'synthetic');
    assert.throws(() => proof.read(root, expected));
    fs.unlinkSync(path.join(root, 'raw.log'));
    fs.appendFileSync(path.join(root, 'proof.json'), ' ');
    assert.throws(() => proof.read(root, expected));
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

test('checksum rewrite does not bypass schema validation', () => {
  const value = fixture();
  value.privatePath = '/private';
  const bytes = Buffer.from(JSON.stringify(value));
  assert.throws(() =>
    proof.verify(bytes, proof.sha256(bytes) + '\n', expected),
  );
  assert.throws(() =>
    proof.verify(Buffer.alloc(100000), 'a'.repeat(64) + '\n', expected),
  );
});

test('PG16 config is fixed to explicit disposable GitHub Linux CI, not local DB', () => {
  const env = {
    GITHUB_ACTIONS: 'true',
    RUNNER_OS: 'Linux',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    P4_APPROVAL: 'P4_PUBLIC_7D_OWNER_CUSTODY',
    GITHUB_SHA: expected.commit,
    P4_APPROVED_COMMIT: expected.commit,
    GITHUB_RUN_ID: expected.runId,
    GITHUB_RUN_ATTEMPT: expected.attempt,
  };
  assert.equal(pg16.configuration(env, 'linux').port, 55436);
  for (const [key, value] of [
    ['GITHUB_ACTIONS', 'false'],
    ['RUNNER_OS', 'Windows'],
    ['GITHUB_EVENT_NAME', 'pull_request_target'],
    ['P4_APPROVAL', 'yes'],
    ['P4_APPROVED_COMMIT', 'b'.repeat(40)],
    ['GITHUB_RUN_ID', '../unsafe'],
  ]) {
    assert.throws(() => pg16.configuration({ ...env, [key]: value }, 'linux'));
  }
  assert.throws(() => pg16.configuration(env, 'win32'));
});

test('native duplicate-table classifier rejects arbitrary failures and wrong TOC', () => {
  const c6 = require('./c6-negative.cjs');
  assert.throws(() =>
    c6.classifyRestore(
      { exitCode: 1, signal: null, cause: 'exit' },
      'connection refused',
      false,
    ),
  );
  assert.throws(() =>
    c6.orderedToc(
      '1; 1259 1 TABLE other before finance_e2e_ci\n',
      'finance_e2e_ci',
    ),
  );
});

test('manual workflow has no automatic trigger, private upload, cache or privileged token', () => {
  const yaml = fs.readFileSync(
    path.join(__dirname, '../../../.github/workflows/p4-proof.yml'),
    'utf8',
  );
  assert.match(yaml, /workflow_dispatch:/);
  assert.doesNotMatch(
    yaml,
    /pull_request|\n {2}push:|\balways\(\)|\*|secrets\.|cache:|actions: write/,
  );
  assert.match(yaml, /contents: read/);
  assert.match(yaml, /retention-days: 7/);
  assert.equal(
    [...yaml.matchAll(/uses: actions\/[a-z-]+@([a-f0-9]{40})/g)].length,
    4,
  );
  assert.match(
    yaml,
    /\.tmp\/p4-export\/proof.json\s+\.tmp\/p4-export\/proof.sha256/,
  );
});

test('PG16 negative adapter simulates both native branches under restricted owner and removes only owned resources', async () => {
  const vm = require('node:vm');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p4-pg16-test-'));
  const clients = [],
    statements = [],
    commands = [];
  let role = false,
    database = false,
    after = false;
  class Client {
    constructor(config) {
      this.config = config;
      clients.push(this);
    }
    on() {}
    async connect() {}
    async end() {
      this.ended = true;
    }
    async query(sql) {
      statements.push({ sql, user: this.config.user });
      if (sql.startsWith('CREATE ROLE')) role = true;
      if (sql.startsWith('CREATE DATABASE')) database = true;
      if (sql.startsWith('DROP DATABASE')) database = false;
      if (sql.startsWith('DROP ROLE')) role = false;
      if (sql.includes('FROM pg_roles WHERE rolname=$1'))
        return { rows: [{ count: role ? 1 : 0 }] };
      if (
        sql.includes('FROM pg_database WHERE datname=$1') &&
        sql.startsWith('SELECT count')
      )
        return { rows: [{ count: database ? 1 : 0 }] };
      if (sql.startsWith('SELECT pg_get_userbyid'))
        return {
          rows: [
            {
              owner: 'finance_e2e_123456_1_negative_owner',
              marker: 'finance-e2e-disposable',
            },
          ],
        };
      if (sql.includes('AS safe')) return { rows: [{ safe: true }] };
      if (sql.startsWith('SELECT to_regclass'))
        return { rows: [{ before: true, error: true, after }] };
      if (sql === 'SELECT marker FROM public.error')
        return { rows: [{ marker: 'synthetic-preserved' }] };
      return { rows: [] };
    }
  }
  const sandbox = {
    module: { exports: {} },
    require: (name) => {
      if (name === 'pg') return { Client };
      if (name === './c6-negative.cjs') {
        const c6 = require(name);
        return {
          ...c6,
          validateNegative: (value) =>
            c6.validateNegative(JSON.parse(JSON.stringify(value))),
        };
      }
      return require(name);
    },
    process,
    Buffer,
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'p4-pg16.cjs'), 'utf8'),
    sandbox,
  );
  const execute = async (bin, args, cap, env, expectedExit) => {
    commands.push({ bin, args, cap, env, expectedExit });
    assert.match(env.PGUSER, /^finance_e2e_/);
    assert.notEqual(env.PGUSER, 'postgres');
    if (bin.endsWith('pg_dump'))
      fs.writeFileSync(args.at(-1), 'synthetic archive');
    if (args[0] === '--list')
      return {
        stdout:
          ['after', 'before', 'error']
            .map(
              (name, i) =>
                `${i + 1}; 1259 ${i + 2} TABLE public ${name} ${env.PGUSER}`,
            )
            .join('\n') + '\n',
      };
    after = !args.includes('--exit-on-error');
    return {
      exitCode: 1,
      signal: null,
      stderr:
        'pg_restore: error: could not execute query: ERROR: relation "error" already exists\nCommand was: CREATE TABLE public.error (\n    marker text\n);\n' +
        (after ? 'pg_restore: warning: errors ignored on restore: 1\n' : ''),
    };
  };
  try {
    const value = await sandbox.module.exports.negative(
      { ...expected, host: '127.0.0.1', port: 55436 },
      root,
      execute,
    );
    assert.equal(value.counts.passed, 2);
    assert.deepEqual(
      commands
        .filter((c) => c.expectedExit === 1)
        .map((c) => c.args.includes('--exit-on-error')),
      [true, false],
    );
    assert.equal(
      statements.filter(
        (s) =>
          s.user === 'postgres' &&
          /CREATE TABLE|INSERT INTO|DROP TABLE/.test(s.sql),
      ).length,
      0,
    );
    assert.match(
      statements.find((s) => s.sql.startsWith('CREATE ROLE')).sql,
      /NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS$/,
    );
    assert.equal(role || database, false);
    assert.ok(clients.every((c) => c.ended));
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

test('client version parsing rejects a different major and injected diagnostics', () => {
  assert.equal(
    pg16.clientVersion(
      'pg_dump (PostgreSQL) 16.8 (Ubuntu 16.8-1.pgdg24.04+1)\n',
      'pg_dump',
    ),
    '16.8',
  );
  for (const text of [
    'pg_dump (PostgreSQL) 18.3\n',
    'pg_dump (PostgreSQL) 16.8\n/private\n',
  ])
    assert.throws(() => pg16.clientVersion(text, 'pg_dump'));
});

test('remote command environment never inherits local dotenv or service credentials', () => {
  const env = require('./p4-ci.cjs').baseEnv('/synthetic-private-root');
  assert.deepEqual(
    Object.keys(env).sort(),
    [
      'CI',
      'HOME',
      'LANG',
      'LC_ALL',
      'NODE_ENV',
      'PATH',
      'TEMP',
      'TMP',
      'TMPDIR',
      'TZ',
    ].sort(),
  );
  assert.equal(env.NODE_ENV, 'test');
});

module.exports = { fixture, expected };

test('installed Jest JSON projection needs no omitted todo/assertion-count fields', () => {
  const value = {
    success: true,
    wasInterrupted: false,
    numFailedTests: 0,
    numPendingTests: 0,
    numRuntimeErrorTestSuites: 0,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    numPassedTests: 1,
    numTotalTests: 1,
    numPassedTestSuites: 1,
    numTotalTestSuites: 1,
    testResults: [{ assertionResults: [{ status: 'passed' }] }],
  };
  assert.deepEqual(proof.e2eSummary(value), {
    suites: 1,
    tests: 1,
    passedAssertionResults: 1,
  });
  for (const mutate of [
    (v) => (v.wasInterrupted = true),
    (v) => (v.numPendingTests = 1),
    (v) => (v.numPendingTestSuites = 1),
    (v) => (v.numFailedTests = 1),
    (v) => (v.numFailedTestSuites = 1),
    (v) => (v.testResults[0].assertionResults[0].status = 'skipped'),
    (v) => (v.numTotalTests = 2),
    (v) => delete v.numRuntimeErrorTestSuites,
  ]) {
    const copy = JSON.parse(JSON.stringify(value));
    mutate(copy);
    assert.throws(() => proof.e2eSummary(copy));
  }
});

test('synthetic command groups capture secrets privately and reject failure, timeout or surviving descendant', async () => {
  const vm = require('node:vm');
  const { EventEmitter } = require('node:events');
  const { PassThrough } = require('node:stream');
  for (const mode of ['success', 'failure', 'timeout', 'descendant']) {
    const child = new EventEmitter();
    child.pid = 43210;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    const output = [],
      kills = [];
    const fakeProcess = {
      platform: 'linux',
      execPath: process.execPath,
      kill: (pid, signal) => {
        kills.push({ pid, signal });
        if (signal === 0 && mode !== 'descendant')
          throw Object.assign(Error('absent'), { code: 'ESRCH' });
        if (signal === 'SIGKILL' && mode === 'timeout')
          setImmediate(() => child.emit('close', null, 'SIGKILL'));
      },
    };
    const sandbox = {
      __dirname,
      module: { exports: {} },
      process: fakeProcess,
      AbortController,
      Buffer,
      setTimeout,
      clearTimeout,
      console: { log: (v) => output.push(v), error: (v) => output.push(v) },
      require: (name) =>
        name === 'node:child_process'
          ? {
              spawn: (_command, _args, options) => {
                assert.equal(options.detached, true);
                assert.equal(options.shell, false);
                if (mode !== 'timeout')
                  setImmediate(() => {
                    child.stdout.write('synthetic-password=private');
                    child.stderr.write('/private/raw');
                    child.emit('close', mode === 'failure' ? 1 : 0, null);
                  });
                return child;
              },
            }
          : require(name),
    };
    vm.runInNewContext(
      fs.readFileSync(path.join(__dirname, 'p4-ci.cjs'), 'utf8'),
      sandbox,
    );
    const run = sandbox.module.exports.execute(
      '/synthetic/command',
      [],
      50,
      {},
    );
    if (mode === 'success')
      assert.equal((await run).stdout, 'synthetic-password=private');
    else await assert.rejects(run);
    assert.deepEqual(output, []);
    if (['timeout', 'descendant'].includes(mode))
      assert.ok(
        kills.some((item) => item.pid === -43210 && item.signal === 'SIGKILL'),
      );
  }
});

test('parsed manual workflow preserves the one-run approval, finite caps and exact upload contract', () => {
  const yaml = require('js-yaml').load(
    fs.readFileSync(
      path.join(__dirname, '../../../.github/workflows/p4-proof.yml'),
      'utf8',
    ),
  );
  assert.deepEqual(Object.keys(yaml.on), ['workflow_dispatch']);
  assert.deepEqual(yaml.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(yaml.jobs), ['proof']);
  const job = yaml.jobs.proof;
  assert.equal(job['timeout-minutes'], 45);
  assert.equal(job.services.postgres.image, 'postgres:16');
  assert.match(job.services.postgres.options, /--log-driver=none/);
  const upload = job.steps.find((step) => step.id === 'export');
  assert.equal(
    upload.with.path.trim(),
    '.tmp/p4-export/proof.json\n.tmp/p4-export/proof.sha256',
  );
  assert.equal(upload.with['include-hidden-files'], true);
  assert.equal(upload.with['retention-days'], 7);
  assert.equal(upload.with['if-no-files-found'], 'error');
  for (const step of job.steps) {
    assert.equal(step.if, undefined);
    assert.equal(step['continue-on-error'], undefined);
    if (step.run) assert.ok(Number.isInteger(step['timeout-minutes']));
  }
});
