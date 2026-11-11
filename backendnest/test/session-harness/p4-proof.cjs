const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateNegative } = require('./c6-negative.cjs');
const CHECKS = [
  ['types-full', 120000],
  ['types-build', 120000],
  ['u6-test', 60000],
  ['u6-check', 660000],
  ['pg16-negative', 180000],
  ['pg16-e2e', 900000],
];
const FILES = ['proof.json', 'proof.sha256'];
const sha256 = (bytes) =>
  crypto.createHash('sha256').update(bytes).digest('hex');
const keys = (value, fields) => {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...fields].sort());
};
function binding(value) {
  keys(value, ['commit', 'runId', 'attempt']);
  assert.equal(typeof value.commit, 'string');
  assert.match(value.commit, /^[a-f0-9]{40}$/);
  for (const name of ['runId', 'attempt']) {
    assert.equal(typeof value[name], 'string');
    assert.match(value[name], /^[1-9][0-9]{0,19}$/);
  }
  return value;
}
function validate(value, expected) {
  binding(expected);
  keys(value, [
    'schemaVersion',
    'scope',
    'commit',
    'runId',
    'attempt',
    'sourceSha256',
    'versions',
    'checks',
    'negative',
    'e2e',
    'cleanup',
    'policy',
    'closure',
    'production',
  ]);
  for (const name of ['commit', 'runId', 'attempt'])
    assert.equal(value[name], expected[name]);
  assert.equal(value.schemaVersion, 1);
  assert.equal(value.scope, 'P4_PG16_ONLY');
  assert.equal(typeof value.sourceSha256, 'string');
  assert.match(value.sourceSha256, /^[a-f0-9]{64}$/);
  keys(value.versions, ['node', 'server', 'dump', 'restore']);
  assert.equal(typeof value.versions.node, 'string');
  assert.match(value.versions.node, /^v22\.[0-9]{1,3}\.[0-9]{1,3}$/);
  assert.ok(
    Number.isInteger(value.versions.server) &&
      value.versions.server >= 160000 &&
      value.versions.server < 170000,
  );
  for (const name of ['dump', 'restore']) {
    assert.equal(typeof value.versions[name], 'string');
    assert.match(value.versions[name], /^16\.[0-9]{1,3}$/);
  }
  assert.ok(Array.isArray(value.checks));
  assert.equal(value.checks.length, CHECKS.length);
  CHECKS.forEach(([id, cap], i) => {
    const check = value.checks[i];
    keys(check, ['id', 'status', 'exitCode', 'durationMs']);
    assert.equal(check.id, id);
    assert.equal(check.status, 'PASS');
    assert.equal(check.exitCode, 0);
    assert.ok(
      Number.isInteger(check.durationMs) &&
        check.durationMs >= 0 &&
        check.durationMs <= cap,
    );
  });
  validateNegative(value.negative);
  keys(value.e2e, ['suites', 'tests', 'passedAssertionResults']);
  for (const count of Object.values(value.e2e))
    assert.ok(Number.isInteger(count) && count > 0 && count < 100000);
  assert.equal(value.e2e.passedAssertionResults, value.e2e.tests);
  assert.ok(value.e2e.suites <= value.e2e.tests);
  assert.deepEqual(value.cleanup, {
    databasesRemoved: true,
    rolesRemoved: true,
    archiveRemoved: true,
    commandGroupsExited: true,
    service: 'GITHUB_JOB_OWNED',
  });
  assert.deepEqual(value.policy, {
    audience: 'PUBLIC',
    custodian: 'REPOSITORY_OWNER',
    artifactRetentionDays: 7,
    removal: 'OWNER_DELETE_AND_VERIFY',
  });
  assert.equal(value.closure, 'U6_ETAPA2_OPEN');
  assert.equal(value.production, 'BLOCKED');
  return value;
}
function verify(bytes, checksum, expected) {
  assert.ok(
    Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 32768,
  );
  assert.equal(typeof checksum, 'string');
  assert.match(checksum, /^[a-f0-9]{64}\n$/);
  assert.equal(sha256(bytes) + '\n', checksum);
  const value = validate(JSON.parse(bytes.toString('utf8')), expected);
  assert.equal(bytes.toString('utf8'), JSON.stringify(value, null, 2) + '\n');
  return value;
}
function read(root, expected) {
  assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
  assert.deepEqual(fs.readdirSync(root).sort(), FILES);
  for (const name of FILES) {
    const stat = fs.lstatSync(path.join(root, name));
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 32768);
  }
  return verify(
    fs.readFileSync(path.join(root, FILES[0])),
    fs.readFileSync(path.join(root, FILES[1]), 'utf8'),
    expected,
  );
}
function write(root, value, expected) {
  validate(value, expected);
  assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
  assert.deepEqual(fs.readdirSync(root), []);
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  fs.writeFileSync(path.join(root, FILES[0]), bytes, { flag: 'wx' });
  fs.writeFileSync(path.join(root, FILES[1]), sha256(bytes) + '\n', {
    flag: 'wx',
  });
  read(root, expected);
}
function e2eSummary(value) {
  assert.equal(value.success, true);
  assert.equal(value.wasInterrupted, false);
  assert.equal(
    value.numFailedTests +
      value.numPendingTests +
      value.numRuntimeErrorTestSuites +
      value.numFailedTestSuites +
      value.numPendingTestSuites,
    0,
  );
  assert.equal(value.numPassedTests, value.numTotalTests);
  assert.equal(value.numPassedTestSuites, value.numTotalTestSuites);
  const results = value.testResults.flatMap((item) => item.assertionResults);
  assert.ok(
    results.length > 0 && results.every((item) => item.status === 'passed'),
  );
  assert.equal(results.length, value.numPassedTests);
  return {
    suites: value.numPassedTestSuites,
    tests: value.numPassedTests,
    passedAssertionResults: results.length,
  };
}
module.exports = {
  CHECKS,
  binding,
  validate,
  verify,
  read,
  write,
  sha256,
  e2eSummary,
};
if (require.main === module) {
  try {
    assert.deepEqual(process.argv.slice(2), ['--readback']);
    const result = read(
      path.resolve(__dirname, '../../../.tmp/p4-download'),
      binding({
        commit: process.env.P4_APPROVED_COMMIT,
        runId: process.env.GITHUB_RUN_ID,
        attempt: process.env.GITHUB_RUN_ATTEMPT,
      }),
    );
    assert.equal(
      result.sourceSha256,
      require('./u6-runtime.cjs').candidateHash(
        require('./u6.cjs').inventory(),
      ),
    );
    console.log('P4_DOWNLOAD_READBACK_PASS; U6_OPEN; PRODUCTION_BLOCKED');
  } catch {
    console.error('P4_DOWNLOAD_READBACK_REJECTED');
    process.exitCode = 1;
  }
}
