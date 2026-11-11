const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname, '../../..');
const vm = require('node:vm');

// Stop at the first pg import: exercise the real entry guard without a DB/child.
async function rootGuard(env, { owner, symlink, redirected } = {}) {
  const root = env.SESSION_HARNESS_ARTIFACTS;
  const fakeFs = {
    existsSync: () => true,
    lstatSync: (file) => ({
      isSymbolicLink: () => file === symlink,
      isDirectory: () => file === root,
    }),
    realpathSync: {
      native: (file) => (file === redirected ? file + '-other' : file),
    },
    readFileSync: (file) => {
      assert.equal(file, path.join(root, 'u5d-owner.json'));
      if (!owner) throw Error('Missing owner marker');
      return JSON.stringify(owner);
    },
  };
  function load(name) {
    if (name === 'node:fs') return fakeFs;
    if (name.endsWith(path.join('node_modules', 'pg')))
      throw Error('ROOT_ACCEPTED_NO_DB');
    if (name === './u6-owned.cjs') {
      const context = { require: load, module: { exports: {} }, __dirname };
      vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, name), 'utf8'),
        context,
      );
      return context.module.exports;
    }
    return require(name);
  }
  const context = {
    require: load,
    module: { exports: {} },
    __dirname,
    __filename: path.join(__dirname, 'u5-deployment.cjs'),
    process: { env, argv: [] },
  };
  vm.runInNewContext(
    fs.readFileSync(context.__filename, 'utf8') +
      '\nmodule.exports.entry = main;',
    context,
  );
  try {
    await context.module.exports.entry();
    assert.fail('Guard must stop before database access');
  } catch (error) {
    return error.message === 'ROOT_ACCEPTED_NO_DB';
  }
}

const rootId = '12345678-1234-4234-8234-123456789abc';
function rootFixture() {
  const binding = {
    case: 'U5D',
    root: '.tmp/u6-runtime-' + rootId,
    token: 'abcdef12-1234-4234-8234-123456789abc',
    candidate: 'a'.repeat(64),
    runnerCandidate: 'b'.repeat(64),
  };
  return {
    binding,
    env: {
      SESSION_HARNESS_CASE: 'U5D',
      DB_HOST: '127.0.0.1',
      DB_PORT: '55434',
      SESSION_HARNESS_ARTIFACTS: path.join(repo, binding.root),
      U6_COORDINATOR_BINDING: JSON.stringify(binding),
    },
  };
}

test('U5D accepts the actual coordinated owned root before any pg import', async () => {
  const { env, binding } = rootFixture();
  assert.equal(await rootGuard(env, { owner: binding }), true);
});

test('U5D keeps the strict legacy root and rejects arbitrary paths', async () => {
  const { env } = rootFixture();
  delete env.U6_COORDINATOR_BINDING;
  const legacy = path.join(repo, '.tmp/session-harness-u5d-' + 'a'.repeat(32));
  assert.equal(
    await rootGuard({ ...env, SESSION_HARNESS_ARTIFACTS: legacy }),
    true,
  );
  for (const root of [
    legacy + '/child',
    legacy + '-sibling',
    legacy.slice(0, -1),
    legacy.toUpperCase(),
    path.join(repo, '.tmp/arbitrary'),
    path.join(repo, '.tmp-sibling', path.basename(legacy)),
    path.join(repo, 'elsewhere', path.basename(legacy)),
    legacy + path.sep + '..' + path.sep + path.basename(legacy),
    '.tmp/' + path.basename(legacy),
  ])
    assert.equal(
      await rootGuard({ ...env, SESSION_HARNESS_ARTIFACTS: root }),
      false,
      root,
    );
});

test('U5D requires matching coordinated case, root, owner and closed binding', async () => {
  const { env, binding } = rootFixture();
  assert.equal(await rootGuard(env), false);
  assert.equal(
    await rootGuard(env, { owner: { ...binding, token: rootId } }),
    false,
  );
  for (const wrong of [
    { ...binding, case: 'C6' },
    {
      ...binding,
      root: '.tmp/u6-runtime-abcdef12-1234-4234-8234-123456789abc',
    },
    { ...binding, root: '.tmp/u6-runtime-' + 'a'.repeat(36) },
    { ...binding, token: 'bad' },
    { ...binding, candidate: 'bad' },
    { ...binding, runnerCandidate: 'bad' },
    { ...binding, extra: true },
  ]) {
    assert.equal(await rootGuard(env, { owner: wrong }), false);
    assert.equal(
      await rootGuard(
        { ...env, U6_COORDINATOR_BINDING: JSON.stringify(wrong) },
        { owner: wrong },
      ),
      false,
    );
  }
  for (const raw of ['', '{', 'null'])
    assert.equal(
      await rootGuard(
        { ...env, U6_COORDINATOR_BINDING: raw },
        { owner: binding },
      ),
      false,
    );
});

test('U5D rejects symbolic and redirected roots or ancestors', async () => {
  const { env, binding } = rootFixture();
  for (const file of [
    env.SESSION_HARNESS_ARTIFACTS,
    path.join(repo, '.tmp'),
    repo,
  ]) {
    assert.equal(
      await rootGuard(env, { owner: binding, symlink: file }),
      false,
    );
    assert.equal(
      await rootGuard(env, { owner: binding, redirected: file }),
      false,
    );
  }
  assert.equal(
    await rootGuard(env, {
      owner: binding,
      symlink: path.join(env.SESSION_HARNESS_ARTIFACTS, 'u5d-owner.json'),
    }),
    false,
  );
});
function assertReadOnly(sql) {
  // Keep the DO body visible; only SQL string literals are irrelevant to keywords.
  const statements = sql.replace(/'(?:''|[^'])*'/g, "''");
  assert.doesNotMatch(
    statements,
    /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|EXECUTE|CALL|COPY)\b/i,
  );
}
test('manual gate is a bounded read-only catalog check, not startup mutation', () => {
  const sql = fs.readFileSync(
    path.join(repo, 'docs/operacao/U5_PREDEPLOY_CHECK.sql'),
    'utf8',
  );
  assert.match(sql, /BEGIN READ ONLY/);
  assert.match(sql, /statement_timeout = '10s'/);
  assert.match(sql, /auth_session_policy_shape/);
  assert.match(sql, /auth_session_reauthentication_attempts_check/);
  assert.match(sql, /auth_session_owner_authenticated_idx/);
  assertReadOnly(sql);
  assert.doesNotThrow(() =>
    assertReadOnly("SELECT 'ON DELETE CASCADE; CREATE; ''DELETE'''"),
  );
  for (const mutation of [
    'CREATE TABLE x(id int)',
    'DELETE FROM x',
    'EXECUTE command',
    'CALL procedure()',
    'COPY x TO STDOUT',
  ])
    assert.throws(() =>
      assertReadOnly('DO $gate$ BEGIN ' + mutation + '; END $gate$;'),
    );
});
test('CI uses a marked sole-owned restricted database with exact confirmation', () => {
  const yaml = fs.readFileSync(
    path.join(repo, '.github/workflows/ci.yml'),
    'utf8',
  );
  assert.match(yaml, /image: postgres:16/);
  assert.match(yaml, /E2E_DB_USERNAME: finance_e2e_ci_owner/);
  assert.match(yaml, /E2E_DB_RESET_CONFIRM: finance_e2e_ci/);
  assert.match(
    yaml,
    /NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/,
  );
  assert.match(
    yaml,
    /COMMENT ON DATABASE finance_e2e_ci IS 'finance-e2e-disposable'/,
  );
});
test('quota branch uses elapsed database time and never extends authority', () => {
  const { expectedQuotaBranch } = require('./u5-deployment.cjs');
  assert.equal(expectedQuotaBranch('1000000', '60999999'), 'deny');
  assert.equal(expectedQuotaBranch('1000000', '61000000'), 'renew');
  assert.throws(() => expectedQuotaBranch('1000000', '999999'));
});
test('only the known outbox CHECK rendering pair can canonicalize', () => {
  const {
    canonicalConstraints,
    OUTBOX_CHECKS,
  } = require('./u5-deployment.cjs');
  const row = {
    table_name: 'password_changed_outbox',
    conname: 'password_changed_state',
    definition: OUTBOX_CHECKS[0],
  };
  assert.deepEqual(
    canonicalConstraints([row]),
    canonicalConstraints([{ ...row, definition: OUTBOX_CHECKS[1] }]),
  );
  assert.throws(() =>
    canonicalConstraints([{ ...row, definition: 'CHECK (true)' }]),
  );
  assert.equal(
    canonicalConstraints([
      { ...row, conname: 'other', definition: 'CHECK (true)' },
    ])[0].definition,
    'CHECK (true)',
  );
});
