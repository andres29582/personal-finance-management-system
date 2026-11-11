const { test } = require('node:test');
require('./u6-runtime.spec.cjs');
require('./u6-owned.spec.cjs');
require('./u6-case-proof.spec.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const u6 = require('./u6.cjs');

test('CLI has a finite allowlist and no arbitrary command or output path', () => {
  assert.equal(u6.parseArgs([]).mode, 'OFFLINE_CHECKS');
  for (const args of [
    ['--mode=unknown'],
    ['--checks=../c6'],
    ['--checks=u6-unit,u6-unit'],
    ['--output=../../.env'],
    ['--case=C6'],
    ['--mode=DISPOSABLE_RUNTIME'],
    ['--mode=TARGET_VALIDATION', '--checks=config-unit'],
    ['--command=node'],
  ])
    assert.throws(() => u6.parseArgs(args));
  assert.equal(
    u6.parseArgs(['--mode=DISPOSABLE_RUNTIME', '--case=C6']).case,
    'C6',
  );
});

function fixture() {
  return u6.makeManifest(
    u6.parseArgs(['--checks=u6-unit']),
    u6.requiredSource.map((name) => ({
      path: name,
      sha256: 'a'.repeat(64),
    })),
  );
}

test('local proof never admits target traffic or closes U6', () => {
  const manifest = fixture();
  manifest.checks[0].status = 'PASS';
  manifest.checks[0].exitCode = 0;
  manifest.checks[0].durationMs = 1;
  manifest.localVerification = 'PARTIAL_PASS';
  assert.doesNotThrow(() => u6.validateManifest(manifest));
  assert.equal(manifest.target, 'PRODUCTION_BLOCKED');
  assert.equal(manifest.closure, 'U6_ETAPA2_OPEN');
  assert.equal(manifest.globalTypes, 'BLOCKED');
});

test('portable evidence rejects unknown fields, missing fields and fake secret injection', () => {
  for (const secret of [
    'password=fake-secret',
    'postgres://fake:fake@host/db',
    'fake\nAuthorization: Bearer fake.jwt.token',
    'Error: fake\n at fake (/private/file:1)',
  ]) {
    const manifest = fixture();
    manifest.unexpected = secret;
    assert.throws(() => u6.validateManifest(manifest));
    delete manifest.unexpected;
    manifest.checks[0].status = secret;
    assert.throws(() => u6.validateManifest(manifest));
    manifest.checks[0].status = 'NOT_TESTED';
    manifest.source[0].path = secret;
    assert.throws(() => u6.validateManifest(manifest));
  }
  for (const field of ['target', 'source', 'checks', 'globalTypes']) {
    const manifest = fixture();
    delete manifest[field];
    assert.throws(() => u6.validateManifest(manifest));
  }
  const manifest = fixture();
  manifest.checks[0].password = 'fake';
  assert.throws(() => u6.validateManifest(manifest));
});

test('artifact checksum and source identities fail closed', () => {
  const bytes = Buffer.from(JSON.stringify(fixture()));
  assert.doesNotThrow(() => u6.verifyArtifact(bytes, u6.sha256(bytes)));
  assert.throws(() =>
    u6.verifyArtifact(
      Buffer.concat([bytes, Buffer.from(' ')]),
      u6.sha256(bytes),
    ),
  );
  assert.throws(() => u6.verifyArtifact(bytes, undefined));
  const manifest = fixture();
  manifest.source[0].sha256 = 'wrong';
  assert.throws(() => u6.validateManifest(manifest));
  manifest.source[0].sha256 = 'a'.repeat(64);
  manifest.source[0].path = '../private.env';
  assert.throws(() => u6.validateManifest(manifest));
  manifest.source = [];
  assert.throws(() => u6.validateManifest(manifest));
  const missing = fixture();
  missing.source.pop();
  assert.throws(() => u6.validateManifest(missing));
});

test('only known source files enter inventory; private and generated files do not', () => {
  for (const name of [
    'backendnest/.env',
    'backendnest/.env.production',
    '.tmp/proof.json',
    'backendnest/node_modules/package.json',
    'frontend/dist/index.js',
    'backendnest/.dev-dist/main.js',
    'backendnest/.dev-dist-localhost/main.js',
    'frontend/.expo/types/router.d.ts',
    'frontend/web-build/index.js',
    'backendnest/.nest-onedrive-safe.tsconfig.json',
    'backendnest/tsconfig.onedrive-safe.json',
    'frontend/expo-env.d.ts',
    '../src/x.ts',
    'docs/password.txt',
    '.git/config',
    'docs/fake\nsecret.md',
    'docs/fake.md\n',
  ]) {
    assert.equal(u6.isSourcePath(name), false, name);
  }
  for (const name of [
    'backendnest/src/auth/auth.service.ts',
    'backendnest/.env.example',
    'backendnest/.env.production.example',
    'frontend/package-lock.json',
    '.github/workflows/ci.yml',
    '.gitignore',
    'backendnest/Dockerfile',
    'docs/operacao/U5_PREDEPLOY_CHECK.sql',
  ]) {
    assert.equal(u6.isSourcePath(name), true, name);
  }
});

test('blocked runtime and target perform zero command launches', async () => {
  for (const args of [
    ['--mode=TARGET_VALIDATION'],
    ['--mode=DISPOSABLE_RUNTIME', '--case=C6'],
  ]) {
    let launches = 0;
    const manifest = fixture();
    const options = u6.parseArgs(args);
    Object.assign(manifest, u6.makeManifest(options, manifest.source));
    await u6.runChecks(options, manifest, () => {
      launches++;
    });
    assert.equal(launches, 0);
    assert.deepEqual(manifest.checks, []);
    assert.equal(manifest.localVerification, 'BLOCKED');
  }
});

test('offline checks stop on first failure and preserve unexecuted status', async () => {
  const options = u6.parseArgs(['--checks=u6-unit,config-unit']);
  const manifest = u6.makeManifest(options, fixture().source);
  let launches = 0;
  await u6.runChecks(options, manifest, async () => {
    launches++;
    return { exitCode: 1, durationMs: 2 };
  });
  assert.equal(launches, 1);
  assert.equal(manifest.checks[0].status, 'FAILED');
  assert.equal(manifest.checks[1].status, 'NOT_TESTED');
});

test('C6 restore fails fast and never reaches post-restore continuation on nonzero exit', async () => {
  const source = fs.readFileSync(path.join(__dirname, 'c6.cjs'), 'utf8');
  const command = source.slice(
    source.indexOf('async function command('),
    source.indexOf('\nasync function sqlErrorScenario('),
  );
  const restore = source
    .slice(source.indexOf('async function main('))
    .match(/await command\('pg_restore', \[[\s\S]*?\]\);/)[0];
  assert.match(restore, /'--exit-on-error'/);
  let identities = 0;
  let continued = false;
  const context = vm.createContext({
    db: {},
    identity: async () => {
      identities++;
    },
    fs: { openSync: () => 1, closeSync: () => {} },
    path,
    root: 'synthetic-root',
    args: ['-d', 'synthetic'],
    process: {
      env: { SESSION_HARNESS_PG_BIN: 'synthetic' },
      platform: process.platform,
    },
    setTimeout,
    clearTimeout,
    Error,
    spawn: (_executable, argv, options) => {
      assert.ok(argv.includes('--exit-on-error'));
      assert.equal(options.shell, false);
      const child = new EventEmitter();
      child.kill = () => {};
      queueMicrotask(() => child.emit('exit', 1));
      return child;
    },
    continuation: () => {
      continued = true;
    },
  });
  await assert.rejects(
    vm.runInContext(
      command + '\n(async () => {' + restore + '\ncontinuation(); })()',
      context,
    ),
    /pg_restore exit 1/,
  );
  assert.equal(identities, 1, 'Only the pre-command identity check executes');
  assert.equal(continued, false);
});

test('maintained runner admits only the finite native C6 SQL-error selector', () => {
  const source = fs.readFileSync(path.join(__dirname, 'runner.cjs'), 'utf8');
  const selection = source.slice(
    source.indexOf('const selected ='),
    source.indexOf('const nonce ='),
  );
  const select = (args) =>
    vm.runInNewContext(selection, {
      assert,
      process: { argv: ['node', 'runner.cjs', ...args] },
    });
  assert.doesNotThrow(() => select(['C6_SQL_ERROR']));
  assert.doesNotThrow(() => select(['C6']));
  for (const args of [
    [],
    ['c6_sql_error'],
    ['../C6_SQL_ERROR'],
    ['C6_SQL_ERROR', 'retry'],
  ])
    assert.throws(() => select(args));
});

const c6Negative = require('./c6-negative.cjs');
const syntheticOwner = 'finance_e2e_fixture_owner';
const syntheticToc =
  [
    `101; 1259 1001 TABLE public after ${syntheticOwner}`,
    `102; 1259 1002 TABLE public before ${syntheticOwner}`,
    `103; 1259 1003 TABLE public error ${syntheticOwner}`,
  ].join('\n') + '\n';
const duplicateDiagnostic =
  'pg_restore: error: could not execute query: ERROR:  relation "error" already exists\nCommand was: CREATE TABLE public.error (\n    marker text\n);\n\n';
const ignoredError = 'pg_restore: warning: errors ignored on restore: 1\n';

function negativeFixture() {
  const native = {
    exitCode: 1,
    signal: null,
    cause: 'exit',
    diagnosticCategory: 'duplicate_table',
    observedSqlState: null,
  };
  return {
    case: 'C6_SQL_ERROR',
    status: 'completed',
    intendedNegative: true,
    toc: {
      entryTypes: ['TABLE', 'TABLE', 'TABLE'],
      order: ['before', 'error', 'after'],
      entries: 3,
    },
    failFast: {
      native: { ...native },
      sentinels: {
        beforeExists: true,
        errorExists: true,
        markerPreserved: true,
        afterExists: false,
      },
    },
    control: {
      native: { ...native },
      sentinels: {
        beforeExists: true,
        errorExists: true,
        markerPreserved: true,
        afterExists: true,
      },
    },
    normalContinuation: { http: 0, authority: 0 },
    counts: { nativeRestores: 2, expectedSqlErrors: 2, passed: 2 },
  };
}

test('C6 TOC admits exactly three simple TABLEs and fixes before/error/after order', () => {
  const list = c6Negative.orderedToc(
    '; synthetic header\n' + syntheticToc,
    syntheticOwner,
  );
  assert.deepEqual(
    list
      .trim()
      .split('\n')
      .map((line) => line.split(' ')[5]),
    ['before', 'error', 'after'],
  );
  assert.equal(c6Negative.orderedToc(list, syntheticOwner), list);
  for (const text of [
    syntheticToc.replace(/^.*\n/, ''),
    syntheticToc + `104; 1259 1004 TABLE public extra ${syntheticOwner}\n`,
    syntheticToc.replace('TABLE public after', 'SEQUENCE public after'),
    syntheticToc.replace('public after', 'public error'),
    syntheticToc.replace('102;', '101;'),
    syntheticToc.replace(syntheticOwner, 'finance_e2e_other_owner'),
    syntheticToc + 'arbitrary command\n',
  ])
    assert.throws(() => c6Negative.orderedToc(text, syntheticOwner));
});

test('C6 native diagnostic admits only intended collision; SQLSTATE is observed or null', () => {
  const status = { exitCode: 1, signal: null, cause: 'exit' };
  assert.equal(
    c6Negative.classifyRestore(status, duplicateDiagnostic, false)
      .observedSqlState,
    null,
  );
  assert.equal(
    c6Negative.classifyRestore(
      status,
      duplicateDiagnostic.replace('ERROR:  ', 'ERROR: 42P07: '),
      false,
    ).observedSqlState,
    '42P07',
  );
  assert.equal(
    c6Negative.classifyRestore(status, duplicateDiagnostic + ignoredError, true)
      .diagnosticCategory,
    'duplicate_table',
  );
  for (const bad of [
    { ...status, exitCode: 0 },
    { ...status, exitCode: 2 },
    { ...status, exitCode: null, signal: 'SIGTERM' },
    { ...status, cause: 'timeout' },
    { ...status, cause: 'spawn-error' },
  ])
    assert.throws(() =>
      c6Negative.classifyRestore(bad, duplicateDiagnostic, false),
    );
  for (const stderr of [
    'pg_restore: connection refused',
    'pg_restore: input file is invalid',
    duplicateDiagnostic.replace('already exists', 'permission denied'),
    duplicateDiagnostic.replace('"error"', '"unexpected"'),
    duplicateDiagnostic.replace(
      'CREATE TABLE public.error',
      'DROP TABLE public.error',
    ),
    duplicateDiagnostic.replace('ERROR:  ', 'ERROR: 42501: '),
    duplicateDiagnostic + 'pg_restore: error: unexpected second failure\n',
    duplicateDiagnostic + ignoredError,
  ])
    assert.throws(() => c6Negative.classifyRestore(status, stderr, false));
  assert.throws(() =>
    c6Negative.classifyRestore(status, duplicateDiagnostic, true),
  );
});

test('C6 native-negative importer requires closed proof, sentinels, control and zero continuation', () => {
  assert.doesNotThrow(() => c6Negative.validateNegative(negativeFixture()));
  for (const change of [
    (p) => {
      p.extra = 'password=fake';
    },
    (p) => {
      delete p.failFast;
    },
    (p) => {
      p.intendedNegative = false;
    },
    (p) => {
      p.status = 'failed';
    },
    (p) => {
      p.toc.order.reverse();
    },
    (p) => {
      p.failFast.sentinels.beforeExists = false;
    },
    (p) => {
      p.failFast.sentinels.afterExists = true;
    },
    (p) => {
      p.failFast.sentinels.markerPreserved = false;
    },
    (p) => {
      p.control.sentinels.afterExists = false;
    },
    (p) => {
      p.control.native.cause = 'timeout';
    },
    (p) => {
      p.control.native.stderr = duplicateDiagnostic;
    },
    (p) => {
      p.normalContinuation.http = 1;
    },
    (p) => {
      p.normalContinuation.authority = 1;
    },
    (p) => {
      p.counts.nativeRestores = 1;
    },
  ]) {
    const proof = negativeFixture();
    change(proof);
    assert.throws(() => c6Negative.validateNegative(proof));
  }
});

test('C6 SQL-error runtime cleanup cannot qualify absent owner/ports/source/external readbacks', () => {
  const runtime = {
    case: 'C6_SQL_ERROR',
    status: 'completed',
    backendNotStarted: true,
    cleanup: {
      commandChildrenExited: true,
      backendExited: false,
      pgStopped: true,
      portsFree: true,
    },
    frozenSourceUnchanged: true,
    externalUnchanged: true,
  };
  assert.doesNotThrow(() => c6Negative.validateCleanup(runtime));
  for (const field of [
    'backendNotStarted',
    'frozenSourceUnchanged',
    'externalUnchanged',
  ]) {
    const bad = structuredClone(runtime);
    delete bad[field];
    assert.throws(() => c6Negative.validateCleanup(bad));
  }
  for (const field of ['commandChildrenExited', 'pgStopped', 'portsFree']) {
    const bad = structuredClone(runtime);
    bad.cleanup[field] = false;
    assert.throws(() => c6Negative.validateCleanup(bad));
  }
});

test('C6 SQL-error branch returns before authority or normal HTTP continuation', async () => {
  const source = fs.readFileSync(path.join(__dirname, 'c6.cjs'), 'utf8');
  const boundary = source.slice(
    source.indexOf('async function main()'),
    source.indexOf('  const fixtures = []'),
  );
  let connects = 0,
    negatives = 0,
    authorities = 0;
  const context = vm.createContext({
    db: {
      connect: async () => {
        connects++;
      },
    },
    negative: true,
    proof: { normalContinuation: { http: 0, authority: 0 } },
    sqlErrorScenario: async () => {
      negatives++;
    },
    initializeAuthority: async () => {
      authorities++;
    },
  });
  await vm.runInContext(boundary + '\n}\nmain()', context);
  assert.equal(connects, 1);
  assert.equal(negatives, 1);
  assert.equal(authorities, 0);
  assert.deepEqual(
    { ...context.proof.normalContinuation },
    { http: 0, authority: 0 },
  );
});

test('shared C6 native command uses fixed phase logs/flags and rejects timeout', async () => {
  const source = fs.readFileSync(path.join(__dirname, 'c6.cjs'), 'utf8');
  const boundary = source.slice(
    source.indexOf('async function command('),
    source.indexOf('\nasync function sqlErrorScenario('),
  );
  const logs = [],
    invocations = [];
  let identities = 0,
    timeout = false;
  const context = vm.createContext({
    db: {},
    identity: async () => {
      identities++;
    },
    path,
    root: 'synthetic-root',
    fs: {
      openSync: (name) => {
        logs.push(name);
        return 1;
      },
      closeSync: () => {},
    },
    process: {
      env: {
        SESSION_HARNESS_PG_BIN: 'synthetic',
        SESSION_HARNESS_CASE: 'C6_SQL_ERROR',
      },
      platform: process.platform,
    },
    setTimeout: (fn, ms) => setTimeout(fn, timeout && ms === 45000 ? 1 : ms),
    clearTimeout,
    Error,
    spawn: (executable, args, options) => {
      invocations.push({ executable, args, options });
      const child = new EventEmitter();
      child.kill = () => {
        queueMicrotask(() => child.emit('exit', null, 'SIGTERM'));
      };
      if (!timeout) queueMicrotask(() => child.emit('exit', 1, null));
      return child;
    },
  });
  vm.runInContext(boundary, context);
  const flags = ['--no-owner', '--no-privileges'];
  const stopped = await context.command(
    'pg_restore',
    [...flags, '--exit-on-error'],
    'negative-stop',
  );
  const control = await context.command(
    'pg_restore',
    flags,
    'negative-control',
  );
  assert.equal(stopped.exitCode, 1);
  assert.equal(control.exitCode, 1);
  assert.equal(invocations.length, 2);
  assert.equal(identities, 2);
  assert.equal(new Set(logs).size, 4);
  assert.ok(invocations[0].args.includes('--exit-on-error'));
  assert.ok(!invocations[1].args.includes('--exit-on-error'));
  for (const { options } of invocations) {
    assert.equal(options.shell, false);
    assert.equal(options.windowsHide, true);
    assert.equal(options.env.LC_ALL, 'C');
    assert.equal(options.cwd, path.join('synthetic-root', 'run'));
  }
  await assert.rejects(
    () => context.command('pg_restore', flags, 'arbitrary-label'),
    /Unsupported/,
  );
  await assert.rejects(
    () =>
      context.command('pg_restore', [...flags, '--clean'], 'negative-control'),
    /flags/,
  );
  await assert.rejects(
    () => context.command('pg_restore', flags, 'negative-stop'),
    /flags/,
  );
  context.process.env.SESSION_HARNESS_CASE = 'C6';
  await assert.rejects(
    () => context.command('pg_restore', flags, 'negative-control'),
    /Unsupported/,
  );
  context.process.env.SESSION_HARNESS_CASE = 'C6_SQL_ERROR';
  timeout = true;
  await assert.rejects(
    () => context.command('pg_restore', flags, 'negative-control'),
    /timeout/,
  );
});

test('runner imports C6 native-negative proof rather than trusting child exit zero', () => {
  const source = fs.readFileSync(path.join(__dirname, 'runner.cjs'), 'utf8');
  const boundary = source.slice(
    source.search(/      const file =\s+selected === 'C6'/),
    source.indexOf("    } else if (selected === 'C7C8')"),
  );
  const importProof = (result) => {
    const proof = {};
    vm.runInNewContext(boundary, {
      selected: 'C6_SQL_ERROR',
      JSON,
      path,
      root: 'synthetic-root',
      proof,
      assert,
      validateNegative: c6Negative.validateNegative,
      fs: {
        readFileSync: (name) => {
          assert.equal(
            name,
            path.join('synthetic-root', 'c6-sql-error-proof.json'),
          );
          return JSON.stringify(result);
        },
      },
    });
    return proof;
  };
  assert.equal(importProof(negativeFixture()).counts.passed, 2);
  assert.throws(() =>
    importProof({ status: 'completed', case: 'C6_SQL_ERROR' }),
  );
  const bad = negativeFixture();
  bad.control.sentinels.afterExists = false;
  assert.throws(() => importProof(bad));
});
