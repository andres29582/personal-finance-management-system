const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRawCase, U5_CASES } = require('./u6-case-proof.cjs');
const u6 = require('./u6.cjs');
const { caps, candidateHash } = require('./u6-runtime.cjs');
const h = 'a'.repeat(64),
  id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  other = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const clock = { now: '2026-10-13T17:00:00Z', now_us: '1791910800000000' };
const names = ['active', 'idle-expired', 'absolute-expired', 'revoked'];
const reasons = [
  null,
  'AUTH_SESSION_IDLE_EXPIRED',
  'AUTH_SESSION_ABSOLUTE_EXPIRED',
  'AUTH_SESSION_REVOKED',
];
const cleared = {
  status: 'signedOut',
  credentialsPresent: false,
  userPresent: false,
  sidPresent: true,
  legacyPresent: false,
  passwordPersisted: false,
};
const sample = () => ({
  at: 1,
  path: '/sessoes',
  identity: {
    generation: 1,
    sid: id,
    exp: 1,
    signedOut: false,
    authority: {
      serverNow: '2026-10-13T17:00:00Z',
      idleExpiresAt: '2026-10-13T17:10:00Z',
      absoluteExpiresAt: '2026-10-13T18:00:00Z',
      policyVersion: 1,
    },
    authorityEpoch: 1,
    authorityOwned: true,
  },
  protectedVisible: true,
  currentSessionVisible: true,
  unavailableVisible: false,
});
const recovery = () => ({
  case: 'offline-and-postcommit-unknown-real-browser',
  status: 'PASS',
  currentSid: id,
  globalTargetSid: other,
  preSendOffline: {
    serverCommits: 0,
    privateHidden: true,
    credentialsRetained: true,
    passwordCleared: true,
  },
  preSendRecovery: {
    confirmationStatus: 200,
    sameOwnedSid: true,
    recovered: sample(),
  },
  postNavigationConfirmation: { status: 200, sample: sample() },
  actualCommitConfirmed: true,
  postCommitResponseLoss: {
    actualStatus: 204,
    ownedSqlRevocationConfirmed: true,
    ownCallerAndRemoteTargetRevoked: true,
    responseAborted: true,
    globalPosts: 1,
    extraLogoutPosts: 0,
    noAutomaticReplay: true,
    privateHidden: true,
    credentialsRetainedUntilConfirmation: true,
  },
  readOnlyRetryConfirmedTerminalAndClearedLocal: true,
  final: { ...cleared },
});
function fixture(selected) {
  if (selected === 'C6')
    return {
      case: selected,
      status: 'completed',
      scope: 'synthetic',
      limits: {},
      initialClock: clock,
      fixtureAnchor: clock,
      clockBeforeBackup: clock,
      clockAfterRestore: clock,
      signerClockAndLegalLogins: {
        verified: 4,
        algorithm: 'HS256',
        issuer: 'meu-sistema-financeiro',
        accessSeconds: 900,
        refreshCappedToAbsolute: true,
      },
      exactAuthorityEquality: {
        rows: 4,
        rawFieldSha256: h,
        typedMicrosecondsEqual: true,
      },
      schemaMetadataEqual: true,
      checkDefinitionRenderingNotCompared: 'synthetic',
      counts: { fixtures: 4, passed: 4, accepted: 1, denied: 3 },
      customPG18DumpRestore: true,
      cases: names.map((fixture, i) => ({
        fixture,
        sid: id,
        status: i ? 401 : 200,
        code: reasons[i],
        cacheControl: i ? null : 'no-store',
        beforeSha256: h,
        afterSha256: h,
        passed: true,
        [i ? 'deniedWithoutRenewal' : 'unchangedNoTouch']: true,
      })),
    };
  if (selected === 'C6_SQL_ERROR') {
    const native = {
      exitCode: 1,
      signal: null,
      cause: 'exit',
      diagnosticCategory: 'duplicate_table',
      observedSqlState: null,
    };
    return {
      case: selected,
      status: 'completed',
      intendedNegative: true,
      toc: {
        entryTypes: ['TABLE', 'TABLE', 'TABLE'],
        order: ['before', 'error', 'after'],
        entries: 3,
      },
      failFast: {
        native,
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
  if (selected === 'A8')
    return {
      case: selected,
      status: 'completed',
      concurrentSeparateContext: 'NOT RUN',
      result: {
        remote: 'unconfirmed',
        localDurable: true,
        cleanupComplete: true,
      },
      automaticLogoutReplay: 0,
      originalSid: id,
      replacementSid: other,
      replacementLoginAfterReconnectConfirmed: true,
      replacementSqlIdentityConfirmed: true,
      replacementIdentityAfterReloadConfirmed: true,
      originalCredentialsAndUserClearedConfirmed: true,
      signedOutTombstoneSidRetained: true,
      replacementDurableTokenAndUserIdentityConfirmed: true,
    };
  if (selected === 'U5')
    return {
      status: 'PASS',
      cases: Object.entries(U5_CASES).map(([name, expected]) => ({
        name,
        status: 'PASS',
        evidence: Object.fromEntries(
          Object.entries(expected).map(([key, value]) => [
            key,
            value === 'positive' ? 1 : value,
          ]),
        ),
      })),
      http: [],
      lockAdmissions: [],
      limits: {},
      cleanup: { pendingOperationsSettled: true, connectionsClosed: true },
      elapsedMs: 1,
      error: '',
      sourceManifestSha256: h,
    };
  if (selected === 'C7C8')
    return {
      status: 'completed',
      loginRecords: Array(9).fill({ status: 200 }),
      limits: {},
      scope: 'synthetic',
      cleanup: { lockerClosed: true, observerClosed: true },
      initialClock: clock,
      independentPhysicalConnection: true,
      identities: [],
      identityEvidence: 'synthetic',
      activeRowsUnchangedAfterBoth: true,
      elapsedMs: 1,
      actualSessionGETs: 46,
      loginSummary: {},
      sourceManifestSha256: h,
      cases: ['C7', 'C8'].map((name, i) => ({
        case: name,
        status: 'PASS',
        records: Array(i ? 20 : 26).fill({ status: 200 }),
        locks: Array(i ? 4 : 7)
          .fill(null)
          .map(() => ({
            kind: 'session',
            concurrency: 2,
            user: id,
            sid: id,
            samples: [
              {
                elapsedMs: 1,
                lockWaits: 2,
                directBlocked: 2,
                awaitingLocks: 2,
                targetPending: true,
                otherCompleted: i ? 1 : 0,
              },
            ],
            status: 'PASS',
            releasedAfterMs: 1,
            noRenewal: true,
          })),
        authorizedProfile: {},
        activeRowsUnchanged: true,
        elapsedMs: 1,
        allRequests: {},
        ...(!i
          ? {
              terminal: names.slice(1).map((name, j) => ({
                name,
                user: id,
                sid: id,
                requests: 2,
                status: 401,
                reason: reasons[j + 1],
                noRevival: true,
                noRenewal: true,
              })),
            }
          : {}),
      })),
    };
  if (selected === 'U5R' || selected === 'U5B')
    return {
      status: 'PASS',
      diagnostics: [],
      scope: 'synthetic',
      disposableIdentityConfirmed: true,
      browser: { channel: 'msedge', version: '1.0', headless: true },
      cases: [
        ...(selected === 'U5B'
          ? [
              {
                case: 'selected-and-global-real-browser',
                status: 'PASS',
                layout: {},
                currentSid: id,
                remoteSid: other,
                readsDidNotRenewActivity: true,
                currentAndRemoteOwnIdentityConfirmed: true,
                passwordStatuses: [400, 204],
                globalStatus: 204,
                ownCurrentMarker: true,
                remoteDenied: {
                  ok: false,
                  status: 401,
                  code: 'AUTH_SESSION_REVOKED',
                  failure: null,
                },
                globalPosts: 1,
                extraLogoutPosts: 0,
                keyboardFocusAndSubmit: true,
                viewport: { width: 360, height: 800 },
                criticalControlsWithinViewport: true,
                documentOverflowIsNotAControlClippingOracle: true,
                passwordClearedAfterRejectCancelSuccess: true,
                durableCleared: { ...cleared },
                durableClearedAfterReload: true,
              },
            ]
          : []),
        recovery(),
      ],
    };
  const records = [
    { name: 'predeploy-denies-0016-only', code: 'P0001' },
    { name: 'predeploy-all17-private-upgrade' },
    { name: 'predeploy-source17' },
    {
      name: 'restore-exact-authority-quota-schema',
      authorityRows: 4,
      quotaRows: 1,
      tables: 1,
      fks: 1,
      dumpSha256: h,
    },
    { name: 'predeploy-restored17' },
    {
      name: 'restored-real-quota-clock-branch',
      branchBefore: 'deny',
      branchAfter: 'deny',
      outcome: 'deny',
      clockBefore: clock,
      clockAfter: clock,
      beforeBudget: [],
      afterBudget: [],
      authorityUnchanged: true,
    },
    ...names.map((name, i) => ({
      name: 'restored-authority-' + name,
      denied: !!i,
      code: reasons[i],
      noRenewal: true,
    })),
  ];
  return {
    case: selected,
    status: 'PASS',
    cases: records.map((record) => ({ ...record, status: 'PASS' })),
    operations: [],
    limits: {},
    scope: 'synthetic',
    beforeBackupClock: clock,
    counts: { passed: 10, failed: 0 },
    connectionsClosed: true,
  };
}
for (const selected of [
  'C6',
  'C6_SQL_ERROR',
  'A8',
  'C7C8',
  'U5',
  'U5B',
  'U5R',
  'U5D',
])
  test('closed raw proof importer ' + selected, () => {
    const value = fixture(selected);
    assert.ok(validateRawCase(selected, value, h) > 0);
    for (const change of [
      (p) => {
        p.extra = 'secret';
      },
      (p) => {
        delete p.status;
      },
      (p) => {
        p.status = 'exit-zero';
      },
    ]) {
      const bad = structuredClone(value);
      change(bad);
      assert.throws(() => validateRawCase(selected, bad, h));
    }
    if (value.cases?.length) {
      const bad = structuredClone(value);
      bad.cases[0].extra = true;
      assert.throws(() => validateRawCase(selected, bad, h));
    }
  });
test('all-eight CLI requires explicit matching candidate/case/exact caps; target remains refused', () => {
  for (const selected of [
    'C6',
    'C6_SQL_ERROR',
    'A8',
    'C7C8',
    'U5',
    'U5B',
    'U5R',
    'U5D',
  ]) {
    const limits = caps(selected);
    const args = [
      '--mode=DISPOSABLE_RUNTIME',
      '--case=' + selected,
      '--approve-case=' + selected,
      '--approve-candidate=' + h,
      '--run-ms=' + limits.runMs,
      '--cleanup-ms=' + limits.cancelGraceMs,
    ];
    assert.equal(u6.parseArgs(args).approval.case, selected);
    assert.throws(() => u6.parseArgs([...args.slice(0, -1), '--cleanup-ms=1']));
  }
  assert.throws(() =>
    u6.parseArgs(['--mode=TARGET_VALIDATION', '--approve-case=C6']),
  );
});
test('fresh compiler evidence requires both current-candidate checks, no old schema reinterpretation', async () => {
  const options = u6.parseArgs(['--checks=types-full,types-build']);
  const source = u6.requiredSource.map((path) => ({ path, sha256: h }));
  const manifest = u6.makeManifest(options, source);
  await u6.runChecks(options, manifest, async () => ({
    exitCode: 0,
    durationMs: 1,
  }));
  assert.equal(manifest.globalTypes, 'PASS');
  assert.equal(manifest.compilerEvidence.sourceSha256, candidateHash(source));
  assert.doesNotThrow(() => u6.validateManifest(manifest));
  manifest.compilerEvidence.sourceSha256 = 'b'.repeat(64);
  assert.throws(() => u6.validateManifest(manifest));
  manifest.schemaVersion = 1;
  assert.throws(() => u6.validateManifest(manifest));
});
module.exports = { fixture };

test('all eight dispatch through owned go and qualify their own imported proof exactly once', async () => {
  const { EventEmitter } = require('node:events');
  const { CASES, coordinate } = require('./u6-runtime.cjs');
  const source = [
    { path: 'backendnest/test/session-harness/runner.cjs', sha256: h },
  ];
  const candidate = candidateHash(source);
  for (const selected of CASES) {
    let launches = 0,
      arms = 0,
      imports = 0;
    const limits = caps(selected);
    const result = await coordinate(
      {
        mode: 'DISPOSABLE_RUNTIME',
        case: selected,
        candidate,
        approval: {
          case: selected,
          candidate,
          runMs: limits.runMs,
          cleanupMs: limits.cancelGraceMs,
        },
      },
      {
        source,
        runnerSource: source,
        preflight: async () => true,
        arm: async () => {
          arms++;
        },
        launch: (binding) => {
          launches++;
          const child = new EventEmitter();
          child.send = (message) => {
            assert.equal(arms, 1);
            assert.equal(message.type, 'go');
            queueMicrotask(() => {
              child.emit('message', {
                schemaVersion: 2,
                type: 'complete',
                ...binding,
              });
              child.emit('exit', 0, null);
            });
          };
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
          imports++;
          assert.equal(binding.case, selected);
          assert.ok(validateRawCase(selected, fixture(selected), h) > 0);
        },
      },
    );
    assert.equal(result.status, 'LOCAL_PASS');
    assert.deepEqual([launches, arms, imports], [1, 1, 1]);
    assert.ok(
      Object.entries(result.cases)
        .filter(([name]) => name !== selected)
        .every(([, status]) => status === 'NOT_TESTED'),
    );
  }
});
