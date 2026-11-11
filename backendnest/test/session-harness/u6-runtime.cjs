const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { validateNegative } = require('./c6-negative.cjs');
const CASES = ['C6', 'C6_SQL_ERROR', 'A8', 'C7C8', 'U5', 'U5B', 'U5R', 'U5D'];
const IMPORTERS = CASES;
const { FILES, validateRawCase } = require('./u6-case-proof.cjs');
function caps(selected) {
  assert.ok(CASES.includes(selected));
  const startupMs = ['C6_SQL_ERROR', 'U5D'].includes(selected) ? 0 : 120000;
  const exportMs = ['A8', 'U5B', 'U5R'].includes(selected) ? 180000 : 0;
  const goalsMs = exportMs ? 130000 : selected === 'C7C8' ? 120000 : 180000;
  return {
    setupMs: 420000,
    startupMs,
    exportMs,
    goalsMs,
    cleanupMs: 150000,
    runMs: 420000 + startupMs + exportMs + goalsMs + 150000 + 30000,
    cancelGraceMs: 332000,
  };
}
const digest = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');
function keys(value, expected) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
}
function candidateHash(source) {
  assert.ok(Array.isArray(source) && source.length > 0);
  const paths = new Set();
  for (const item of source) {
    keys(item, ['path', 'sha256']);
    assert.match(item.path, /^[A-Za-z0-9_.@\-/]+$/);
    assert.ok(
      !item.path
        .split('/')
        .some(
          (part) =>
            !part ||
            part === '..' ||
            part === '.' ||
            (part.startsWith('.env') && !part.endsWith('.example')),
        ),
    );
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    assert.ok(!paths.has(item.path));
    paths.add(item.path);
  }
  return digest(
    JSON.stringify(
      [...source].sort((a, b) => a.path.localeCompare(b.path, 'en')),
    ),
  );
}
function validateOverlap(runnerSource, coordinatorSource) {
  candidateHash(runnerSource);
  candidateHash(coordinatorSource);
  const expected = new Map(
    coordinatorSource.map((item) => [item.path, item.sha256]),
  );
  let overlap = 0;
  for (const item of runnerSource) {
    if (!expected.has(item.path)) continue;
    assert.equal(item.sha256, expected.get(item.path));
    overlap++;
  }
  assert.ok(overlap > 0, 'No validated overlapping sources');
}
function validateBinding(message, binding, type) {
  keys(message, ['schemaVersion', 'type', ...Object.keys(binding)]);
  assert.equal(message.schemaVersion, 2);
  assert.equal(message.type, type);
  for (const key of Object.keys(binding))
    assert.equal(message[key], binding[key]);
}
function validateCompletion(message, binding, source) {
  keys(message, [
    'schemaVersion',
    'type',
    ...Object.keys(binding),
    'status',
    'source',
    'sourceUnchanged',
    'externalUnchanged',
    'cleanup',
    'scenario',
  ]);
  for (const key of Object.keys(binding))
    assert.equal(message[key], binding[key]);
  assert.equal(message.schemaVersion, 2);
  assert.equal(message.type, 'complete');
  assert.equal(message.status, 'completed');
  assert.equal(message.sourceUnchanged, true);
  assert.equal(message.externalUnchanged, true);
  assert.equal(candidateHash(source), binding.candidate);
  assert.equal(candidateHash(message.source), binding.runnerCandidate);
  validateOverlap(message.source, source);
  keys(message.cleanup, [
    'commandChildrenExited',
    'backendExited',
    'pgStopped',
    'portsFree',
  ]);
  assert.equal(message.cleanup.commandChildrenExited, true);
  assert.equal(message.cleanup.pgStopped, true);
  assert.equal(message.cleanup.portsFree, true);
  assert.equal(message.cleanup.backendExited, binding.case === 'C6');
  if (binding.case === 'C6_SQL_ERROR') validateNegative(message.scenario);
  else {
    keys(message.scenario, [
      'case',
      'fixtures',
      'passed',
      'accepted',
      'denied',
      'schemaMetadataEqual',
      'authorityRows',
      'customPG18DumpRestore',
    ]);
    assert.deepEqual(message.scenario, {
      case: 'C6',
      fixtures: 4,
      passed: 4,
      accepted: 1,
      denied: 3,
      schemaMetadataEqual: true,
      authorityRows: 4,
      customPG18DumpRestore: true,
    });
  }
}
async function coordinate(request, adapter) {
  const result = {
    schemaVersion: 2,
    status: 'BLOCKED',
    reason: 'approval_or_preflight_missing',
    cases: Object.fromEntries(CASES.map((name) => [name, 'NOT_TESTED'])),
  };
  let approval;
  try {
    keys(request, ['mode', 'case', 'candidate', 'approval']);
    assert.equal(request.mode, 'DISPOSABLE_RUNTIME');
    assert.ok(IMPORTERS.includes(request.case));
    approval = request.approval;
    keys(approval, ['case', 'candidate', 'runMs', 'cleanupMs']);
    assert.equal(approval.case, request.case);
    assert.equal(approval.candidate, request.candidate);
    assert.equal(candidateHash(adapter.source), request.candidate);
    for (const [key, maximum] of [
      ['runMs', 3600000],
      ['cleanupMs', 360000],
    ])
      assert.ok(
        Number.isSafeInteger(approval[key]) &&
          approval[key] > 0 &&
          approval[key] <= maximum,
      );
    assert.ok(!adapter.signal?.aborted);
    assert.equal(await adapter.preflight(), true);
    assert.ok(!adapter.signal?.aborted);
    // Approval is bound to these exact current bytes, not a historical U6 or runner hash.
    assert.equal(candidateHash(adapter.source), request.candidate);
  } catch {
    return result;
  }
  result.cases[request.case] = 'BLOCKED';
  const binding = {
    case: request.case,
    candidate: request.candidate,
    runnerCandidate: candidateHash(adapter.runnerSource || adapter.source),
    token: crypto.randomUUID(),
    root: '.tmp/u6-runtime-' + crypto.randomUUID(),
  };
  return new Promise((resolve) => {
    let child,
      owned = false,
      complete = false,
      invalid = false,
      cancelled = false,
      finished = false;
    let runTimer, cleanupTimer;
    const finish = (status, reason) => {
      if (finished) return;
      finished = true;
      clearTimeout(runTimer);
      clearTimeout(cleanupTimer);
      adapter.signal?.removeEventListener('abort', cancel);
      // A failed cooperative grace never leaves the job handle (and its owned tree) live.
      // Closing this guardian affects only the job assigned before the owner's go.
      if (status !== 'LOCAL_PASS') adapter.abandon?.();
      result.status = status;
      result.reason = reason;
      result.cases[request.case] = status;
      resolve(result);
    };
    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(runTimer);
      // Only IPC to the bound owner. Never kill the runner or infer descendants from a PID.
      try {
        child.send({ schemaVersion: 2, type: 'cancel', ...binding });
      } catch {
        invalid = true;
      }
      cleanupTimer = setTimeout(
        () => finish('BLOCKED', 'owner_cleanup_unconfirmed'),
        approval.cleanupMs,
      );
    };
    try {
      child = adapter.launch(binding);
      runTimer = setTimeout(cancel, approval.runMs);
      adapter.signal?.addEventListener('abort', cancel, { once: true });
      child.on('message', (message) => {
        if (finished) return;
        try {
          if (!owned) {
            validateBinding(message, binding, 'owned');
            owned = true;
            if (adapter.arm)
              Promise.resolve(adapter.arm(binding, child))
                .then(() => {
                  if (!cancelled)
                    child.send({ schemaVersion: 2, type: 'go', ...binding });
                })
                .catch(() => {
                  invalid = true;
                  cancel();
                });
          } else {
            assert.equal(complete, false, 'Duplicate completion');
            if (adapter.importProof)
              validateBinding(message, binding, 'complete');
            else validateCompletion(message, binding, adapter.source);
            complete = true;
          }
        } catch {
          invalid = true;
          cancel();
        }
      });
      child.once('error', () => {
        invalid = true;
        cancel();
      });
      child.once('exit', async (code, signal) => {
        if (adapter.importProof) {
          try {
            await adapter.importProof(binding, child);
          } catch {
            invalid = true;
          }
        }
        const passed =
          code === 0 &&
          signal === null &&
          owned &&
          complete &&
          !invalid &&
          !cancelled;
        finish(
          passed ? 'LOCAL_PASS' : 'BLOCKED',
          passed ? 'qualified_case' : 'case_or_cleanup_unqualified',
        );
      });
      if (adapter.signal?.aborted) cancel();
    } catch {
      finish('BLOCKED', 'owner_launch_unavailable');
    }
  });
}
function createCancellation() {
  let cancelled = false,
    cleanup = false;
  return {
    get cancelled() {
      return cancelled;
    },
    cancel() {
      cancelled = true;
    },
    beginCleanup() {
      cleanup = true;
    },
    check() {
      assert.ok(
        !cancelled || cleanup,
        'Owned runtime cancelled; no next operation',
      );
    },
  };
}
async function settleCleanup(steps) {
  const failures = [];
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, 'Owned cleanup or readback incomplete');
}
function nativeAdapter(source, privateRoot, request, getSource) {
  const fs = require('node:fs'),
    path = require('node:path');
  const { launchOwner, assignJob, repo } = require('./u6-owned.cjs');
  const { runnerSnapshot } = require('./u6-source.cjs');
  let job;
  const adapter = {
    source,
    runnerSource: runnerSnapshot(request.case),
    async preflight() {
      const limits = caps(request.case);
      assert.equal(process.platform, 'win32');
      assert.equal(request.approval.runMs, limits.runMs);
      assert.equal(request.approval.cleanupMs, limits.cancelGraceMs);
      const bin = path.join(
        process.env.ProgramFiles || '',
        'PostgreSQL/18/bin',
      );
      for (const name of [
        'postgres',
        'initdb',
        'pg_ctl',
        'psql',
        'pg_dump',
        'pg_restore',
      ])
        assert.ok(fs.statSync(path.join(bin, name + '.exe')).isFile());
      assert.ok(
        fs
          .statSync(
            path.join(
              process.env.SystemRoot,
              'System32/WindowsPowerShell/v1.0/powershell.exe',
            ),
          )
          .isFile(),
      );
      assert.equal(candidateHash(getSource()), request.candidate);
      return true;
    },
    launch(binding) {
      return launchOwner(
        path.join(__dirname, 'runner.cjs'),
        [request.case],
        binding,
        privateRoot,
      );
    },
    async arm(binding, child) {
      job = await assignJob(child, privateRoot);
    },
    abandon() {
      job?.abandon();
    },
    async importProof(binding) {
      assert.ok(job, 'Missing actual ownership evidence');
      await job.finish();
      const root = path.resolve(repo, binding.root);
      const read = (name) => {
        const file = path.join(root, name);
        assert.equal(fs.lstatSync(file).isSymbolicLink(), false);
        const bytes = fs.readFileSync(file);
        assert.ok(bytes.length <= 10000000);
        return { bytes, value: JSON.parse(bytes.toString('utf8')) };
      };
      assert.equal(
        fs.realpathSync.native(root).toLowerCase(),
        root.toLowerCase(),
      );
      const frozen = read('candidate.json');
      assert.equal(candidateHash(frozen.value), binding.runnerCandidate);
      validateOverlap(frozen.value, source);
      assert.equal(candidateHash(getSource()), binding.candidate);
      const runtime = read('runtime-proof.json').value;
      const fields = [
        'case',
        'status',
        'nonce',
        'operations',
        'limits',
        'aggregateCaps',
        'cleanup',
        'scope',
        'sourceManifestSha256',
        'artifacts',
        'externalBefore',
        'pgVersion',
        'database',
        'requestCounts',
        'frozenSourceUnchanged',
        'externalAfter',
        'externalUnchanged',
        'binding',
      ];
      if (!['C6_SQL_ERROR', 'U5D'].includes(binding.case))
        fields.push('startup', 'backend');
      if (binding.case === 'C6_SQL_ERROR') fields.push('backendNotStarted');
      if (['C6', 'C6_SQL_ERROR'].includes(binding.case)) fields.push('counts');
      if (
        ['C6_SQL_ERROR', 'C7C8', 'U5', 'U5D', 'U5B', 'U5R'].includes(
          binding.case,
        )
      )
        fields.push('cases');
      keys(runtime, fields);
      assert.deepEqual(runtime.binding, binding);
      assert.equal(runtime.case, binding.case);
      assert.equal(runtime.status, 'completed');
      assert.deepEqual(runtime.aggregateCaps, caps(binding.case));
      assert.equal(runtime.sourceManifestSha256, digest(frozen.bytes));
      assert.ok(
        Array.isArray(runtime.operations) && runtime.operations.length >= 7,
      );
      for (const operation of runtime.operations) {
        keys(operation, [
          'label',
          'code',
          'signal',
          'pid',
          'timedOut',
          'elapsedMs',
        ]);
        assert.equal(operation.code, 0);
        assert.equal(operation.signal, null);
        assert.equal(operation.timedOut, false);
        assert.ok(
          Number.isSafeInteger(operation.pid) &&
            operation.pid > 0 &&
            Number.isSafeInteger(operation.elapsedMs) &&
            operation.elapsedMs >= 0,
        );
      }
      assert.equal(runtime.artifacts, binding.root);
      assert.equal(runtime.frozenSourceUnchanged, true);
      assert.equal(runtime.externalUnchanged, true);
      assert.deepEqual(runtime.externalBefore, runtime.externalAfter);
      for (const key of ['commandChildrenExited', 'pgStopped', 'portsFree'])
        assert.equal(runtime.cleanup[key], true);
      assert.equal(
        runtime.cleanup.backendExited,
        !['C6_SQL_ERROR', 'U5D'].includes(binding.case),
      );
      keys(runtime.cleanup, [
        'commandChildrenExited',
        'backendExited',
        'pgStopped',
        'portsFree',
        ...(['A8', 'U5B', 'U5R'].includes(binding.case) ? ['webClosed'] : []),
      ]);
      if (['A8', 'U5B', 'U5R'].includes(binding.case))
        assert.equal(runtime.cleanup.webClosed, true);
      const raw = read(FILES[binding.case]);
      const passed = validateRawCase(
        binding.case,
        raw.value,
        runtime.sourceManifestSha256,
      );
      adapter.evidence = {
        case: binding.case,
        passed,
        rawSha256: digest(raw.bytes),
        runtimeSha256: digest(read('runtime-proof.json').bytes),
        sourceSha256: digest(frozen.bytes),
        ownership: 'JOB_EMPTY_AFTER_OWNER_EXIT',
      };
    },
  };
  return adapter;
}
module.exports = {
  caps,
  nativeAdapter,
  CASES,
  candidateHash,
  validateOverlap,
  validateBinding,
  coordinate,
  createCancellation,
  settleCleanup,
};
