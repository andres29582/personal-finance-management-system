const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const runtime = require('./u6-runtime.cjs');
const repo = path.resolve(__dirname, '../../..');
const MODES = ['OFFLINE_CHECKS', 'DISPOSABLE_RUNTIME', 'TARGET_VALIDATION'];
const CASES = runtime.CASES;
const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  '.tmp',
  'dist',
  'build',
  'coverage',
  '.expo',
  '.dev-dist',
  '.dev-dist-localhost',
  '.cache',
  'web-build',
  'web-export',
  'playwright-report',
  'test-results',
];
const EXCLUDED_FILES = [
  '.nest-onedrive-safe.tsconfig.json',
  'tsconfig.onedrive-safe.json',
  'expo-env.d.ts',
];
const CHECKS = {
  'types-full': {
    cwd: 'backendnest',
    args: [
      'node_modules/typescript/bin/tsc',
      '--noEmit',
      '--incremental',
      'false',
      '-p',
      'tsconfig.json',
    ],
    capMs: 120000,
  },
  'types-build': {
    cwd: 'backendnest',
    args: [
      'node_modules/typescript/bin/tsc',
      '--noEmit',
      '--incremental',
      'false',
      '-p',
      'tsconfig.build.json',
    ],
    capMs: 120000,
  },
  'u6-unit': {
    cwd: '.',
    args: ['backendnest/test/session-harness/u6.spec.cjs'],
    capMs: 60000,
  },
  'config-unit': {
    cwd: 'backendnest',
    args: [
      'node_modules/jest/bin/jest.js',
      '--runInBand',
      '--no-cache',
      '--runTestsByPath',
      'src/config/database.config.spec.ts',
      'src/config/http-runtime.config.spec.ts',
      'src/config/u6-profiles.spec.ts',
      'src/auth/config/auth-token.config.spec.ts',
      'src/auth/config/password-reset.config.spec.ts',
    ],
    capMs: 180000,
  },
  'deployment-unit': {
    cwd: '.',
    args: ['backendnest/test/session-harness/u5-deployment.spec.cjs'],
    capMs: 60000,
  },
  'poll-unit': {
    cwd: '.',
    args: ['backendnest/test/session-harness/u5-poll.spec.cjs'],
    capMs: 60000,
  },
};
const REQUIRED = [
  '.gitignore',
  '.github/workflows/ci.yml',
  'backendnest/Dockerfile',
  'backendnest/package.json',
  'backendnest/package-lock.json',
  'frontend/package-lock.json',
  'backendnest/test/session-harness/u6.cjs',
  'backendnest/test/session-harness/u6.spec.cjs',
  'backendnest/test/session-harness/u6-runtime.cjs',
  'backendnest/test/session-harness/u6-owned.cjs',
  'backendnest/test/session-harness/u6-case-proof.cjs',
  'backendnest/test/session-harness/u6-source.cjs',
  'backendnest/test/session-harness/u6-job.ps1',
  'backendnest/test/session-harness/c6.cjs',
  'backendnest/.env.example',
  'backendnest/.env.production.example',
  'backendnest/src/config/u6-profiles.spec.ts',
  'docs/operacao/U5_PREDEPLOY_CHECK.sql',
];
const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');
const assert = (value) => {
  if (!value) throw Error('U6 evidence or input rejected');
};
function exactKeys(value, keys) {
  assert(value && typeof value === 'object' && !Array.isArray(value));
  assert(Object.keys(value).sort().join('|') === [...keys].sort().join('|'));
}
function parseArgs(args) {
  const options = {
    mode: 'OFFLINE_CHECKS',
    checks: Object.keys(CHECKS),
    case: null,
    approval: null,
  };
  const seen = new Set();
  for (const arg of args) {
    const match =
      /^--(mode|checks|case|approve-case|approve-candidate|run-ms|cleanup-ms)=(.+)$/.exec(
        arg,
      );
    assert(match && !seen.has(match[1]));
    seen.add(match[1]);
    if (match[1].startsWith('approve-') || match[1].endsWith('-ms')) {
      options.approval ||= {};
      const key = {
        'approve-case': 'case',
        'approve-candidate': 'candidate',
        'run-ms': 'runMs',
        'cleanup-ms': 'cleanupMs',
      }[match[1]];
      options.approval[key] = match[1].endsWith('-ms')
        ? Number(match[2])
        : match[2];
    } else
      options[match[1]] =
        match[1] === 'checks' ? match[2].split(',') : match[2];
  }
  assert(MODES.includes(options.mode));
  if (options.approval) {
    assert(options.mode === 'DISPOSABLE_RUNTIME');
    exactKeys(options.approval, ['case', 'candidate', 'runMs', 'cleanupMs']);
    assert(
      options.approval.case === options.case &&
        /^[a-f0-9]{64}$/.test(options.approval.candidate),
    );
    const limits = runtime.caps(options.case);
    assert(
      options.approval.runMs === limits.runMs &&
        options.approval.cleanupMs === limits.cancelGraceMs,
    );
  }
  assert(
    options.checks.length > 0 &&
      new Set(options.checks).size === options.checks.length,
  );
  assert(options.checks.every((id) => Object.hasOwn(CHECKS, id)));
  assert(
    options.mode === 'OFFLINE_CHECKS'
      ? options.case === null
      : !seen.has('checks'),
  );
  assert(
    options.mode === 'DISPOSABLE_RUNTIME'
      ? CASES.includes(options.case)
      : options.case === null,
  );
  return options;
}
function isSourcePath(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_.\-/]+$/.test(name))
    return false;
  if (/[\r\n]/.test(name)) return false;
  const parts = name.split('/');
  if (EXCLUDED_FILES.includes(parts.at(-1))) return false;
  if (parts.some((part) => !part || part === '..' || part === '.'))
    return false;
  if (parts.some((part) => EXCLUDED_DIRS.includes(part))) return false;
  if (
    parts.some(
      (part) =>
        part.startsWith('.env') && !/^\.env(?:\.[a-z]+)?\.example$/.test(part),
    )
  )
    return false;
  if (['.gitignore', 'backendnest/Dockerfile'].includes(name)) return true;
  return (
    /\.(?:ts|tsx|cts|mts|js|cjs|mjs|json|sql|md|ya?ml|example|ps1)$/.test(name) &&
    (['backendnest', 'frontend', 'docs', '.github'].includes(parts[0]) ||
      ['README.md', 'AGENTS.md'].includes(name))
  );
}
function inventory() {
  const source = [];
  function visit(relative) {
    const absolute = path.join(repo, relative);
    const stat = fs.lstatSync(absolute);
    assert(!stat.isSymbolicLink());
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(absolute).sort()) {
        if (EXCLUDED_DIRS.includes(entry)) continue;
        if (EXCLUDED_FILES.includes(entry)) continue;
        if (
          entry.startsWith('.env') &&
          !/^\.env(?:\.[a-z]+)?\.example$/.test(entry)
        )
          continue;
        visit(relative + '/' + entry);
      }
    } else if (stat.isFile() && isSourcePath(relative)) {
      source.push({
        path: relative,
        sha256: sha256(fs.readFileSync(absolute)),
      });
    }
  }
  for (const name of [
    'backendnest',
    'frontend',
    'docs',
    '.github',
    '.gitignore',
    'README.md',
    'AGENTS.md',
  ]) {
    if (fs.existsSync(path.join(repo, name))) visit(name);
  }
  source.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  assert(REQUIRED.every((name) => source.some((item) => item.path === name)));
  return source;
}
function makeManifest(options, source) {
  return {
    schemaVersion: 2,
    runId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    mode: options.mode,
    case: options.case,
    nodeVersion: process.version,
    source,
    checks:
      options.mode === 'OFFLINE_CHECKS'
        ? options.checks.map((id) => ({
            id,
            capMs: CHECKS[id].capMs,
            status: 'NOT_TESTED',
            exitCode: null,
            durationMs: null,
          }))
        : [],
    localVerification:
      options.mode === 'OFFLINE_CHECKS' ? 'NOT_TESTED' : 'BLOCKED',
    target: 'PRODUCTION_BLOCKED',
    closure: 'U6_ETAPA2_OPEN',
    globalTypes: 'BLOCKED',
    realRestore: 'NOT_TESTED',
    remoteCI: 'NOT_TESTED',
    lifecycleTarget: 'NOT_TESTED',
    runtime: null,
    compilerEvidence: null,
  };
}
function validateManifest(value) {
  exactKeys(value, [
    'schemaVersion',
    'runId',
    'generatedAt',
    'mode',
    'case',
    'nodeVersion',
    'source',
    'checks',
    'localVerification',
    'target',
    'closure',
    'globalTypes',
    'realRestore',
    'remoteCI',
    'lifecycleTarget',
    'runtime',
    'compilerEvidence',
  ]);
  assert(
    value.schemaVersion === 2 &&
      typeof value.runId === 'string' &&
      value.runId.length === 36 &&
      /^[a-f0-9-]{36}$/.test(value.runId),
  );
  assert(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.generatedAt));
  assert(
    typeof value.generatedAt === 'string' && value.generatedAt.length === 24,
  );
  assert(
    typeof value.nodeVersion === 'string' &&
      value.nodeVersion.trim() === value.nodeVersion,
  );
  assert(
    Number.isFinite(Date.parse(value.generatedAt)) &&
      /^v\d+\.\d+\.\d+$/.test(value.nodeVersion),
  );
  assert(MODES.includes(value.mode));
  assert(
    value.mode === 'DISPOSABLE_RUNTIME'
      ? CASES.includes(value.case)
      : value.case === null,
  );
  assert(
    value.target === 'PRODUCTION_BLOCKED' && value.closure === 'U6_ETAPA2_OPEN',
  );
  for (const key of ['realRestore', 'remoteCI', 'lifecycleTarget'])
    assert(value[key] === 'NOT_TESTED');
  assert(Array.isArray(value.source) && value.source.length > 0);
  const paths = new Set();
  for (const item of value.source) {
    exactKeys(item, ['path', 'sha256']);
    assert(
      isSourcePath(item.path) &&
        typeof item.sha256 === 'string' &&
        item.sha256.length === 64 &&
        /^[a-f0-9]{64}$/.test(item.sha256) &&
        !paths.has(item.path),
    );
    paths.add(item.path);
  }
  assert(REQUIRED.every((name) => paths.has(name)));
  assert(Array.isArray(value.checks));
  const ids = new Set();
  for (const item of value.checks) {
    exactKeys(item, ['id', 'capMs', 'status', 'exitCode', 'durationMs']);
    assert(Object.hasOwn(CHECKS, item.id) && !ids.has(item.id));
    ids.add(item.id);
    assert(item.capMs === CHECKS[item.id].capMs);
    assert(['PASS', 'FAILED', 'NOT_TESTED'].includes(item.status));
    if (item.status === 'NOT_TESTED')
      assert(item.exitCode === null && item.durationMs === null);
    else {
      assert(
        Number.isInteger(item.exitCode) &&
          item.exitCode >= -1 &&
          item.exitCode <= 255,
      );
      assert(Number.isInteger(item.durationMs) && item.durationMs >= 0);
      assert(
        item.status === 'PASS' ? item.exitCode === 0 : item.exitCode !== 0,
      );
    }
  }
  const expected =
    value.mode !== 'OFFLINE_CHECKS'
      ? 'BLOCKED'
      : value.checks.some((item) => item.status === 'FAILED')
        ? 'FAILED'
        : value.checks.length &&
            value.checks.every((item) => item.status === 'PASS')
          ? 'PARTIAL_PASS'
          : 'NOT_TESTED';
  assert(value.localVerification === expected);
  if (value.compilerEvidence === null) assert(value.globalTypes === 'BLOCKED');
  else {
    exactKeys(value.compilerEvidence, [
      'sourceSha256',
      'fullExitCode',
      'buildExitCode',
    ]);
    assert(
      value.compilerEvidence.sourceSha256 ===
        runtime.candidateHash(value.source),
    );
    assert(
      value.compilerEvidence.fullExitCode === 0 &&
        value.compilerEvidence.buildExitCode === 0,
    );
    assert(
      ['types-full', 'types-build'].every((id) =>
        value.checks.some(
          (check) => check.id === id && check.status === 'PASS',
        ),
      ),
    );
    assert(value.globalTypes === 'PASS');
  }
  if (value.runtime !== null) {
    exactKeys(value.runtime, [
      'schemaVersion',
      'status',
      'reason',
      'cases',
      'proof',
    ]);
    assert(
      value.mode === 'DISPOSABLE_RUNTIME' && value.runtime.schemaVersion === 2,
    );
    assert(['BLOCKED', 'LOCAL_PASS'].includes(value.runtime.status));
    assert(
      [
        'approval_or_preflight_missing',
        'owner_cleanup_unconfirmed',
        'owner_launch_unavailable',
        'qualified_case',
        'case_or_cleanup_unqualified',
      ].includes(value.runtime.reason),
    );
    exactKeys(value.runtime.cases, CASES);
    for (const name of CASES)
      assert(
        value.runtime.cases[name] ===
          (name === value.case && value.runtime.status === 'LOCAL_PASS'
            ? 'LOCAL_PASS'
            : name === value.case &&
                value.runtime.reason !== 'approval_or_preflight_missing'
              ? 'BLOCKED'
              : 'NOT_TESTED'),
      );
    if (value.runtime.status === 'LOCAL_PASS') {
      exactKeys(value.runtime.proof, [
        'case',
        'passed',
        'rawSha256',
        'runtimeSha256',
        'sourceSha256',
        'ownership',
        'candidate',
      ]);
      assert(value.runtime.proof.case === value.case);
      assert(
        value.runtime.proof.passed ===
          {
            C6: 4,
            C6_SQL_ERROR: 2,
            A8: 1,
            C7C8: 2,
            U5: 11,
            U5B: 2,
            U5R: 1,
            U5D: 10,
          }[value.case],
      );
      assert(
        value.runtime.proof.ownership === 'JOB_EMPTY_AFTER_OWNER_EXIT' &&
          value.runtime.proof.candidate === runtime.candidateHash(value.source),
      );
      for (const key of ['rawSha256', 'runtimeSha256', 'sourceSha256'])
        assert(/^[a-f0-9]{64}$/.test(value.runtime.proof[key]));
    } else assert(value.runtime.proof === null);
  }
  assert(
    value.mode === 'OFFLINE_CHECKS'
      ? value.checks.length > 0
      : value.checks.length === 0,
  );
  return value;
}
function verifyArtifact(bytes, expectedHash) {
  assert(
    typeof expectedHash === 'string' && /^[a-f0-9]{64}$/.test(expectedHash),
  );
  assert(sha256(bytes) === expectedHash);
  return validateManifest(JSON.parse(bytes.toString('utf8')));
}
function executeCheck(id, privateRoot) {
  const check = CHECKS[id];
  const start = Date.now();
  const stdout = fs.openSync(path.join(privateRoot, id + '.stdout.log'), 'wx');
  const stderr = fs.openSync(path.join(privateRoot, id + '.stderr.log'), 'wx');
  let result;
  try {
    result = spawnSync(process.execPath, check.args, {
      cwd: path.join(repo, check.cwd),
      windowsHide: true,
      shell: false,
      timeout: check.capMs,
      env: {
        SystemRoot: process.env.SystemRoot,
        WINDIR: process.env.SystemRoot,
        PATH: path.dirname(process.execPath),
        TEMP: privateRoot,
        TMP: privateRoot,
        NODE_ENV: 'test',
        TZ: 'UTC',
      },
      stdio: ['ignore', stdout, stderr],
    });
  } finally {
    fs.closeSync(stdout);
    fs.closeSync(stderr);
  }
  return {
    exitCode: result.error || result.signal ? -1 : result.status,
    durationMs: Date.now() - start,
  };
}
async function runChecks(options, manifest, execute) {
  if (options.mode !== 'OFFLINE_CHECKS') return;
  for (const check of manifest.checks) {
    const result = await execute(check.id);
    Object.assign(check, result, {
      status: result.exitCode === 0 ? 'PASS' : 'FAILED',
    });
    if (check.status === 'FAILED') break;
  }
  manifest.localVerification = manifest.checks.every(
    (check) => check.status === 'PASS',
  )
    ? 'PARTIAL_PASS'
    : 'FAILED';
  if (
    ['types-full', 'types-build'].every((id) =>
      manifest.checks.some((item) => item.id === id && item.status === 'PASS'),
    )
  ) {
    manifest.compilerEvidence = {
      sourceSha256: runtime.candidateHash(manifest.source),
      fullExitCode: 0,
      buildExitCode: 0,
    };
    manifest.globalTypes = 'PASS';
  }
}
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const source = inventory();
  const manifest = makeManifest(options, source);
  const tmp = path.join(repo, '.tmp');
  fs.mkdirSync(tmp, { recursive: true });
  assert(!fs.lstatSync(tmp).isSymbolicLink());
  const root = fs.mkdtempSync(path.join(tmp, 'u6-'));
  const privateRoot = path.join(root, 'private');
  fs.mkdirSync(privateRoot);
  const portableRoot = path.join(root, 'portable');
  fs.mkdirSync(portableRoot);
  for (const check of manifest.checks)
    console.log(
      `${check.id}: cap ${check.capMs} ms; installed Node only; no services`,
    );
  await runChecks(options, manifest, (id) => executeCheck(id, privateRoot));
  if (options.mode === 'DISPOSABLE_RUNTIME') {
    const request = {
      mode: options.mode,
      case: options.case,
      candidate: runtime.candidateHash(source),
      approval: options.approval,
    };
    const adapter = runtime.nativeAdapter(
      source,
      privateRoot,
      request,
      inventory,
    );
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.once('SIGINT', cancel);
    process.once('SIGTERM', cancel);
    try {
      adapter.signal = controller.signal;
      manifest.runtime = await runtime.coordinate(request, adapter);
      manifest.runtime.proof =
        manifest.runtime.status === 'LOCAL_PASS'
          ? { ...adapter.evidence, candidate: request.candidate }
          : null;
    } finally {
      process.removeListener('SIGINT', cancel);
      process.removeListener('SIGTERM', cancel);
    }
    if (adapter.evidence)
      fs.writeFileSync(
        path.join(privateRoot, 'imported-case.json'),
        JSON.stringify(adapter.evidence, null, 2),
        { flag: 'wx' },
      );
  }
  assert(JSON.stringify(inventory()) === JSON.stringify(source));
  validateManifest(manifest);
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  const hash = sha256(bytes);
  const output = path.join(portableRoot, 'manifest.json');
  fs.writeFileSync(output, bytes, { flag: 'wx' });
  fs.writeFileSync(path.join(portableRoot, 'manifest.sha256'), hash + '\n', {
    flag: 'wx',
  });
  verifyArtifact(
    fs.readFileSync(output),
    fs.readFileSync(path.join(portableRoot, 'manifest.sha256'), 'utf8').trim(),
  );
  console.log(
    JSON.stringify({
      localVerification: manifest.localVerification,
      target: manifest.target,
      closure: manifest.closure,
      runtime: manifest.runtime?.status ?? 'NOT_TESTED',
      evidence: path.relative(repo, output).replaceAll('\\', '/'),
      sha256: hash,
    }),
  );
  process.exitCode =
    manifest.localVerification === 'PARTIAL_PASS' ||
    manifest.runtime?.status === 'LOCAL_PASS'
      ? 0
      : 2;
}
module.exports = {
  parseArgs,
  isSourcePath,
  inventory,
  makeManifest,
  validateManifest,
  verifyArtifact,
  sha256,
  runChecks,
  requiredSource: REQUIRED,
};
if (require.main === module)
  main().catch(() => {
    console.error('U6 failed closed; no production readiness granted');
    process.exitCode = 1;
  });
