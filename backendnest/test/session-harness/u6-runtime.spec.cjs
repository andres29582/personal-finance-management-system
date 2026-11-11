const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const runtime = require('./u6-runtime.cjs');
const candidate = [
  {
    path: 'backendnest/test/session-harness/runner.cjs',
    sha256: 'a'.repeat(64),
  },
];
const identity = runtime.candidateHash(candidate);
test('candidate paths accept maintained scale assets without weakening rejection', () => {
  for (const scale of [2, 3]) {
    assert.match(
      runtime.candidateHash([
        {
          ...candidate[0],
          path: `frontend/assets/images/react-logo@${scale}x.png`,
        },
      ]),
      /^[a-f0-9]{64}$/,
    );
  }
  for (const path of [
    '/absolute',
    'C:/absolute',
    'a\\b',
    '../x',
    'a/../x',
    './x',
    'a/./x',
    'a//x',
    'a/',
    'a/.env',
    'a/.env.local',
    'a?b',
    'a\u0000b',
  ]) {
    assert.throws(() => runtime.candidateHash([{ ...candidate[0], path }]));
  }
  for (const item of [
    { ...candidate[0], sha256: 'bad' },
    { ...candidate[0], extra: true },
    JSON.parse(
      '{"path":"safe","sha256":"' + 'a'.repeat(64) + '","__proto__":{}}',
    ),
  ])
    assert.throws(() => runtime.candidateHash([item]));
  assert.throws(() => runtime.candidateHash([...candidate, candidate[0]]));
});

test('all maintained runner inventories bind complete snapshots, not fixture-only hashes', async () => {
  const { runnerSnapshot } = require('./u6-source.cjs');
  const source = require('./u6.cjs').inventory();
  const coordinatorCandidate = runtime.candidateHash(source);
  const hashes = new Map();
  for (const selected of runtime.CASES) {
    const runnerSource = runnerSnapshot(selected);
    for (const scale of [2, 3])
      assert.ok(
        runnerSource.some(
          (item) =>
            item.path === `frontend/assets/images/react-logo@${scale}x.png`,
        ),
      );
    const runnerCandidate = runtime.candidateHash(runnerSource);
    hashes.set(selected, runnerCandidate);
    runtime.validateOverlap(runnerSource, source);
    assert.equal(
      runtime.candidateHash([...runnerSource].reverse()),
      runnerCandidate,
    );
    const changed = structuredClone(runnerSource);
    changed[0].sha256 =
      changed[0].sha256 === 'a'.repeat(64) ? 'b'.repeat(64) : 'a'.repeat(64);
    assert.notEqual(runtime.candidateHash(changed), runnerCandidate);
    assert.notEqual(
      runtime.candidateHash(runnerSource.slice(1)),
      runnerCandidate,
    );
    const limits = runtime.caps(selected);
    let imported = 0;
    const result = await runtime.coordinate(
      {
        mode: 'DISPOSABLE_RUNTIME',
        case: selected,
        candidate: coordinatorCandidate,
        approval: {
          case: selected,
          candidate: coordinatorCandidate,
          runMs: limits.runMs,
          cleanupMs: limits.cancelGraceMs,
        },
      },
      {
        source,
        runnerSource,
        preflight: async () => true,
        arm: async () => {},
        launch: (binding) => {
          assert.equal(binding.candidate, coordinatorCandidate);
          assert.equal(binding.runnerCandidate, runnerCandidate);
          const child = new EventEmitter();
          child.send = () =>
            queueMicrotask(() => {
              child.emit('message', {
                schemaVersion: 2,
                type: 'complete',
                ...binding,
              });
              child.emit('exit', 0, null);
            });
          queueMicrotask(() =>
            child.emit('message', {
              schemaVersion: 2,
              type: 'owned',
              ...binding,
            }),
          );
          return child;
        },
        importProof: async (binding) => {
          assert.equal(
            binding.runnerCandidate,
            runtime.candidateHash(runnerSnapshot(selected)),
          );
          assert.equal(binding.candidate, coordinatorCandidate);
          imported++;
        },
      },
    );
    assert.equal(result.status, 'LOCAL_PASS');
    assert.equal(imported, 1);
    assert.ok(
      Object.entries(result.cases)
        .filter(([name]) => name !== selected)
        .every(([, status]) => status === 'NOT_TESTED'),
    );
  }
  assert.notEqual(hashes.get('C6'), hashes.get('U5'));
  assert.notEqual(hashes.get('C6'), hashes.get('U5D'));
});
const request = {
  mode: 'DISPOSABLE_RUNTIME',
  case: 'C6',
  candidate: identity,
  approval: {
    case: 'C6',
    candidate: identity,
    runMs: 600000,
    cleanupMs: 120000,
  },
};

test('runtime refusal is zero launch and all unselected cases remain NOT_TESTED', async () => {
  for (const input of [
    { ...request, approval: null },
    { ...request, mode: 'TARGET_VALIDATION' },
    { ...request, case: 'A8' },
    { ...request, candidate: 'b'.repeat(64) },
  ]) {
    let launches = 0;
    const result = await runtime.coordinate(input, {
      preflight: async () => true,
      launch: () => {
        launches++;
      },
    });
    assert.equal(launches, 0);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(
      Object.entries(result.cases)
        .filter(([name]) => name !== input.case)
        .every(([, status]) => status === 'NOT_TESTED'),
    );
  }
  let launches = 0;
  assert.equal(
    (
      await runtime.coordinate(request, {
        preflight: async () => false,
        launch: () => {
          launches++;
        },
      })
    ).status,
    'BLOCKED',
  );
  assert.equal(launches, 0);
});

test('candidate overlap is validated by path/hash, never array equality', () => {
  const larger = [
    ...candidate,
    { path: 'docs/extra.md', sha256: 'b'.repeat(64) },
  ];
  assert.doesNotThrow(() => runtime.validateOverlap(candidate, larger));
  assert.throws(() =>
    runtime.validateOverlap(
      [{ ...candidate[0], sha256: 'b'.repeat(64) }],
      larger,
    ),
  );
  assert.throws(() => runtime.candidateHash([...candidate, candidate[0]]));
  assert.throws(() =>
    runtime.candidateHash([{ ...candidate[0], extra: true }]),
  );
});

function completion(binding) {
  return {
    schemaVersion: 2,
    type: 'complete',
    ...binding,
    status: 'completed',
    source: structuredClone(candidate),
    sourceUnchanged: true,
    externalUnchanged: true,
    cleanup: {
      commandChildrenExited: true,
      backendExited: true,
      pgStopped: true,
      portsFree: true,
    },
    scenario: {
      case: 'C6',
      fixtures: 4,
      passed: 4,
      accepted: 1,
      denied: 3,
      schemaMetadataEqual: true,
      authorityRows: 4,
      customPG18DumpRestore: true,
    },
  };
}
function launchWith(change = () => {}, exitCode = 0) {
  return (binding) => {
    const child = new EventEmitter();
    child.send = () => {};
    queueMicrotask(() => {
      const hello = { schemaVersion: 2, type: 'owned', ...binding };
      const proof = completion(binding);
      change(hello, proof);
      child.emit('message', hello);
      child.emit('message', proof);
      child.emit('exit', exitCode, null);
    });
    return child;
  };
}
test('exact handshake and scenario proof qualify one launch, never exit zero alone', async () => {
  let launches = 0;
  const result = await runtime.coordinate(request, {
    source: candidate,
    preflight: async () => true,
    launch: (binding) => {
      launches++;
      return launchWith()(binding);
    },
  });
  assert.equal(launches, 1);
  assert.equal(result.status, 'LOCAL_PASS');
  assert.equal(result.cases.C6, 'LOCAL_PASS');
  assert.equal(result.cases.C6_SQL_ERROR, 'NOT_TESTED');
  for (const change of [
    (hello) => {
      hello.schemaVersion = 1;
    },
    (hello) => {
      hello.root = '.tmp/another-owner';
    },
    (hello) => {
      hello.case = 'A8';
    },
    (hello) => {
      hello.extra = true;
    },
    (hello, proof) => {
      proof.candidate = 'b'.repeat(64);
    },
    (hello, proof) => {
      proof.source[0] = { ...proof.source[0], sha256: 'b'.repeat(64) };
    },
    (hello, proof) => {
      proof.cleanup.pgStopped = false;
    },
    (hello, proof) => {
      proof.sourceUnchanged = false;
    },
    (hello, proof) => {
      proof.scenario.passed = 3;
    },
    (hello, proof) => {
      delete proof.scenario;
    },
    (hello, proof) => {
      proof.scenario.extra = true;
    },
  ]) {
    const bad = await runtime.coordinate(request, {
      source: candidate,
      preflight: async () => true,
      launch: launchWith(change),
    });
    assert.equal(bad.status, 'BLOCKED');
  }
  const missing = await runtime.coordinate(request, {
    source: candidate,
    preflight: async () => true,
    launch: () => {
      const child = new EventEmitter();
      child.send = () => {};
      queueMicrotask(() => child.emit('exit', 0, null));
      return child;
    },
  });
  assert.equal(missing.status, 'BLOCKED');
});

test('cancellation asks owner to finish finally and does not kill runner', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const result = await runtime.coordinate(request, {
    source: candidate,
    signal: controller.signal,
    preflight: async () => true,
    launch: (binding) => {
      const child = new EventEmitter();
      child.kill = () => {
        throw Error('Owner must not be killed');
      };
      child.send = (message) => {
        assert.equal(message.type, 'cancel');
        assert.equal(message.candidate, identity);
        cancelled = true;
        queueMicrotask(() => child.emit('exit', 1, null));
      };
      queueMicrotask(() => {
        child.emit('message', { schemaVersion: 2, type: 'owned', ...binding });
        controller.abort();
      });
      return child;
    },
  });
  assert.equal(cancelled, true);
  assert.equal(result.status, 'BLOCKED');
});

test('owner cancellation prevents next operation and remains safe during cleanup', () => {
  const owner = runtime.createCancellation();
  owner.check();
  owner.cancel();
  assert.throws(() => owner.check(), /cancelled/);
  owner.beginCleanup();
  assert.doesNotThrow(() => owner.check());
  assert.equal(owner.cancelled, true);
});

test('cleanup still attempts other owned boundaries after one fails; never qualifies failure', async () => {
  const visited = [];
  await assert.rejects(
    () =>
      runtime.settleCleanup([
        async () => {
          visited.push('command');
          throw Error('Owned exit unconfirmed');
        },
        async () => {
          visited.push('backend');
        },
        async () => {
          visited.push('pg');
        },
        async () => {
          visited.push('ports');
        },
      ]),
    AggregateError,
  );
  assert.deepEqual(visited, ['command', 'backend', 'pg', 'ports']);
});

test('finite timeout sends one cooperative cancel and rejects missing cleanup without killing owner', async () => {
  let cancels = 0;
  let abandoned = 0;
  const short = {
    ...request,
    approval: { ...request.approval, runMs: 1, cleanupMs: 5 },
  };
  const result = await runtime.coordinate(short, {
    source: candidate,
    preflight: async () => true,
    abandon: () => {
      abandoned++;
    },
    launch: (binding) => {
      const child = new EventEmitter();
      child.send = (message) => {
        assert.equal(message.type, 'cancel');
        cancels++;
      };
      child.kill = () => {
        throw Error('Must not kill owner mid-finally');
      };
      queueMicrotask(() =>
        child.emit('message', { schemaVersion: 2, type: 'owned', ...binding }),
      );
      return child;
    },
  });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'owner_cleanup_unconfirmed');
  assert.equal(cancels, 1);
  assert.equal(abandoned, 1);
});
