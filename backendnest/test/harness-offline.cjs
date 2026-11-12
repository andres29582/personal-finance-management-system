const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const mode = process.argv[2];
assert.equal(process.argv.length, 3);
assert.ok(['portable', 'windows'].includes(mode), 'Select portable or windows');
const ownership = 'actual synthetic Windows job';
const files = [
  'e2e-runner.spec.cjs',
  'e2e-runtime.spec.cjs',
  'access-browser-runner.spec.cjs',
  'financial-closure-runner.spec.cjs',
  'session-harness/u6.spec.cjs',
  'session-harness/u6-runtime.spec.cjs',
  'session-harness/u6-owned.spec.cjs',
  'session-harness/u6-case-proof.spec.cjs',
  'session-harness/u5-poll.spec.cjs',
  'session-harness/u5-deployment.spec.cjs',
  'session-harness/runner-cleanup.spec.cjs',
  'session-harness/p4-proof.spec.cjs',
  'session-harness/e2e-lease-compat.spec.cjs',
];
if (mode === 'windows')
  assert.equal(process.platform, 'win32', 'Windows Job proof requires Windows');
else
  console.log(
    'N/A: two Windows Job cases run separately in the Windows ownership job.',
  );
const result = spawnSync(
  process.execPath,
  [
    '--test',
    '--test-concurrency=1',
    '--test-timeout=120000',
    mode === 'windows' ? '--test-name-pattern' : '--test-skip-pattern',
    ownership,
    ...(mode === 'windows' ? ['session-harness/u6-owned.spec.cjs'] : files).map(
      (file) => path.join(__dirname, file),
    ),
  ],
  { windowsHide: true, stdio: 'inherit', timeout: 210000 },
);
if (result.error)
  console.error('Offline harness did not complete:', result.error.code);
process.exitCode = result.status ?? 1;
