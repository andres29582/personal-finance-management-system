const assert = require('node:assert/strict');
const { validateNegative } = require('./c6-negative.cjs');
const FILES = {
  C6: 'c6-proof.json',
  C6_SQL_ERROR: 'c6-sql-error-proof.json',
  A8: 'a8-proof.json',
  C7C8: 'load-proof.json',
  U5: 'u5-proof.json',
  U5B: 'u5-browser-proof.json',
  U5R: 'u5-browser-proof.json',
  U5D: 'u5d-proof.json',
};
function exact(value, fields) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), fields.split(' ').sort());
}
const equal = (actual, expected) => assert.deepEqual(actual, expected);
const yes = (value) => assert.equal(value, true);
const hash = (value) => assert.match(value, /^[a-f0-9]{64}$/);
const finite = (value) => assert.ok(Number.isFinite(value) && value >= 0);
const uuid = (value) => assert.match(value, /^[a-f0-9-]{36}$/);
const clock = (value) => {
  exact(value, 'now now_us');
  assert.ok(Number.isFinite(Date.parse(value.now)));
  assert.match(value.now_us, /^\d+$/);
};
const reason = [
  null,
  'AUTH_SESSION_IDLE_EXPIRED',
  'AUTH_SESSION_ABSOLUTE_EXPIRED',
  'AUTH_SESSION_REVOKED',
];
const names = ['active', 'idle-expired', 'absolute-expired', 'revoked'];
const U5_CASES = {
  'migration-budget-and-index': {
    columns: 3,
    ownerCascade: true,
    ownerKeysetIndex: true,
  },
  'real-http-owner-list-no-touch-and-validation': {
    own: 2,
    currentMarker: true,
    noTouch: true,
    malformedExtra: 400,
  },
  'real-http-password-remote-idor-idempotence-and-shared-account-budget': {
    selected: 204,
    repeated: 204,
    foreign: 204,
    nonexistent: 204,
    callerRetained: true,
    sharedQuota: 429,
    reservations: 5,
  },
  'real-http-global-includes-current-and-live-jwt-refresh-denial': {
    empty204: true,
    includedCurrent: true,
    stillSignedJWTDenied: true,
    refreshDenied: true,
    terminalRepeat: 401,
  },
  'real-audit-no-session-id-or-password': {
    persisted: true,
    parameterizedRoute: true,
    noCredentialOrTarget: true,
  },
  'owner-keyset-pages-over-five-with-microsecond-ties': {
    configuredRepositoryLimit: 30,
    rows: 26,
    pages: [20, 6],
    microsecondCursor: true,
    noTouch: true,
  },
  'concurrent-reservations-bounded-and-window-renews': {
    concurrent: 7,
    reserved: 5,
    rejected: 2,
    nextWindow: 1,
  },
  'revoked-caller-and-password-change-fence-the-effect': {
    revokedCallerCannotEffect: true,
    changedHashCannotEffect: true,
  },
  'clock-after-last-lock-and-terminal-commit': {
    actualLockWaiters: 'positive',
    elapsedDeadlineDenied: true,
    terminalCommitted: true,
    targetUnchanged: true,
  },
  'refresh-before-and-after-revocation': {
    rotateFirstThenRevoke: true,
    queuedRevokeThenRefreshDenied: true,
    actualWaiters: 'positive',
  },
  'global-user-lock-orders-a-later-login-without-permanent-epoch': {
    existingRevoked: true,
    laterOrderedLoginAllowed: true,
    actualWaiters: 'positive',
  },
};
function expectedEvidence(value, expected) {
  exact(value, Object.keys(expected).join(' '));
  for (const [key, wanted] of Object.entries(expected)) {
    if (wanted === 'positive')
      assert.ok(Number.isInteger(value[key]) && value[key] > 0);
    else equal(value[key], wanted);
  }
}
function durable(value, cleared) {
  exact(
    value,
    'status credentialsPresent userPresent sidPresent legacyPresent passwordPersisted',
  );
  equal(value.passwordPersisted, false);
  equal(value.credentialsPresent, !cleared);
  equal(value.userPresent, !cleared);
  equal(value.legacyPresent, false);
  if (cleared) equal(value.status, 'signedOut');
}
function recovery(value) {
  exact(
    value,
    'case status currentSid globalTargetSid preSendOffline preSendRecovery postNavigationConfirmation actualCommitConfirmed postCommitResponseLoss readOnlyRetryConfirmedTerminalAndClearedLocal final',
  );
  equal(value.case, 'offline-and-postcommit-unknown-real-browser');
  equal(value.status, 'PASS');
  uuid(value.currentSid);
  uuid(value.globalTargetSid);
  assert.notEqual(value.currentSid, value.globalTargetSid);
  expectedEvidence(value.preSendOffline, {
    serverCommits: 0,
    privateHidden: true,
    credentialsRetained: true,
    passwordCleared: true,
  });
  expectedEvidence(value.postCommitResponseLoss, {
    actualStatus: 204,
    ownedSqlRevocationConfirmed: true,
    ownCallerAndRemoteTargetRevoked: true,
    responseAborted: true,
    globalPosts: 1,
    extraLogoutPosts: 0,
    noAutomaticReplay: true,
    privateHidden: true,
    credentialsRetainedUntilConfirmation: true,
  });
  yes(value.actualCommitConfirmed);
  yes(value.readOnlyRetryConfirmedTerminalAndClearedLocal);
  exact(value.preSendRecovery, 'confirmationStatus sameOwnedSid recovered');
  equal(value.preSendRecovery.confirmationStatus, 200);
  yes(value.preSendRecovery.sameOwnedSid);
  exact(value.postNavigationConfirmation, 'status sample');
  equal(value.postNavigationConfirmation.status, 200);
  ownedSample(value.preSendRecovery.recovered, value.currentSid, false);
  ownedSample(value.postNavigationConfirmation.sample, value.currentSid, true);
  durable(value.final, true);
}
function ownedSample(value, sid, navigation) {
  exact(
    value,
    'at path identity protectedVisible currentSessionVisible unavailableVisible',
  );
  finite(value.at);
  yes(value.protectedVisible);
  equal(value.unavailableVisible, false);
  if (navigation) {
    equal(value.path, '/sessoes');
    yes(value.currentSessionVisible);
  }
  exact(
    value.identity,
    'generation sid exp signedOut authority authorityEpoch authorityOwned',
  );
  equal(value.identity.sid, sid);
  equal(value.identity.signedOut, false);
  yes(value.identity.authorityOwned);
  finite(value.identity.generation);
  finite(value.identity.authorityEpoch);
  finite(value.identity.exp);
  exact(
    value.identity.authority,
    'serverNow idleExpiresAt absoluteExpiresAt policyVersion',
  );
  equal(value.identity.authority.policyVersion, 1);
  const state = value.identity.authority;
  assert.ok(
    Date.parse(state.serverNow) < Date.parse(state.idleExpiresAt) &&
      Date.parse(state.serverNow) < Date.parse(state.absoluteExpiresAt),
  );
}
function validateRawCase(selected, value, sourceHash) {
  assert.ok(Object.hasOwn(FILES, selected));
  if (selected === 'C6_SQL_ERROR') {
    validateNegative(value);
    return 2;
  }
  if (selected === 'C6') {
    exact(
      value,
      'case status cases limits scope initialClock signerClockAndLegalLogins fixtureAnchor clockBeforeBackup clockAfterRestore exactAuthorityEquality schemaMetadataEqual checkDefinitionRenderingNotCompared counts customPG18DumpRestore',
    );
    equal(value.case, selected);
    equal(value.status, 'completed');
    equal(value.counts, { fixtures: 4, passed: 4, accepted: 1, denied: 3 });
    yes(value.schemaMetadataEqual);
    yes(value.customPG18DumpRestore);
    expectedEvidence(value.signerClockAndLegalLogins, {
      verified: 4,
      algorithm: 'HS256',
      issuer: 'meu-sistema-financeiro',
      accessSeconds: 900,
      refreshCappedToAbsolute: true,
    });
    exact(
      value.exactAuthorityEquality,
      'rows rawFieldSha256 typedMicrosecondsEqual',
    );
    equal(value.exactAuthorityEquality.rows, 4);
    hash(value.exactAuthorityEquality.rawFieldSha256);
    yes(value.exactAuthorityEquality.typedMicrosecondsEqual);
    for (const key of [
      'initialClock',
      'fixtureAnchor',
      'clockBeforeBackup',
      'clockAfterRestore',
    ])
      clock(value[key]);
    equal(value.cases.length, 4);
    value.cases.forEach((item, index) => {
      exact(
        item,
        'fixture sid status code cacheControl beforeSha256 afterSha256 passed ' +
          (index ? 'deniedWithoutRenewal' : 'unchangedNoTouch'),
      );
      equal(item.fixture, names[index]);
      uuid(item.sid);
      equal(item.status, index ? 401 : 200);
      equal(item.code, reason[index]);
      equal(item.cacheControl, index ? null : 'no-store');
      hash(item.beforeSha256);
      hash(item.afterSha256);
      yes(item.passed);
      yes(item[index ? 'deniedWithoutRenewal' : 'unchangedNoTouch']);
      if (!index || index === 3) equal(item.beforeSha256, item.afterSha256);
    });
    return 4;
  }
  if (selected === 'A8') {
    exact(
      value,
      'case status concurrentSeparateContext result automaticLogoutReplay originalSid replacementSid replacementLoginAfterReconnectConfirmed replacementSqlIdentityConfirmed replacementIdentityAfterReloadConfirmed originalCredentialsAndUserClearedConfirmed signedOutTombstoneSidRetained replacementDurableTokenAndUserIdentityConfirmed',
    );
    equal(value.case, selected);
    equal(value.status, 'completed');
    equal(value.concurrentSeparateContext, 'NOT RUN');
    equal(value.automaticLogoutReplay, 0);
    uuid(value.originalSid);
    uuid(value.replacementSid);
    assert.notEqual(value.originalSid, value.replacementSid);
    for (const key of Object.keys(value).filter(
      (key) =>
        key.endsWith('Confirmed') || key === 'signedOutTombstoneSidRetained',
    ))
      yes(value[key]);
    exact(value.result, 'remote localDurable cleanupComplete');
    assert.equal(value.result.remote, 'unconfirmed');
    yes(value.result.localDurable);
    yes(value.result.cleanupComplete);
    return 1;
  }
  if (selected === 'U5') {
    exact(
      value,
      'status cases http lockAdmissions limits cleanup elapsedMs error sourceManifestSha256',
    );
    equal(value.status, 'PASS');
    equal(value.error, '');
    equal(value.sourceManifestSha256, sourceHash);
    expectedEvidence(value.cleanup, {
      pendingOperationsSettled: true,
      connectionsClosed: true,
    });
    finite(value.elapsedMs);
    equal(value.cases.length, 11);
    value.cases.forEach((item, index) => {
      exact(item, 'name status evidence');
      const name = Object.keys(U5_CASES)[index];
      equal(item.name, name);
      equal(item.status, 'PASS');
      expectedEvidence(item.evidence, U5_CASES[name]);
    });
    return 11;
  }
  if (selected === 'C7C8') {
    exact(
      value,
      'status cases loginRecords limits scope cleanup initialClock independentPhysicalConnection identities identityEvidence activeRowsUnchangedAfterBoth elapsedMs actualSessionGETs loginSummary sourceManifestSha256',
    );
    equal(value.status, 'completed');
    equal(value.sourceManifestSha256, sourceHash);
    equal(value.actualSessionGETs, 46);
    equal(value.loginRecords.length, 9);
    yes(value.independentPhysicalConnection);
    yes(value.activeRowsUnchangedAfterBoth);
    expectedEvidence(value.cleanup, {
      lockerClosed: true,
      observerClosed: true,
    });
    equal(value.cases.length, 2);
    value.cases.forEach((item, index) => {
      exact(
        item,
        'case status records locks authorizedProfile activeRowsUnchanged elapsedMs allRequests' +
          (index ? '' : ' terminal'),
      );
      equal(item.case, index ? 'C8' : 'C7');
      equal(item.status, 'PASS');
      yes(item.activeRowsUnchanged);
      equal(item.records.length, index ? 20 : 26);
      equal(item.locks.length, index ? 4 : 7);
      item.locks.forEach((lock) => {
        exact(
          lock,
          'kind concurrency user sid samples status releasedAfterMs noRenewal',
        );
        equal(lock.status, 'PASS');
        yes(lock.noRenewal);
        assert.ok(lock.samples.length > 0);
        assert.ok(lock.releasedAfterMs < 3000);
        lock.samples.forEach((sample) =>
          exact(
            sample,
            'elapsedMs lockWaits directBlocked awaitingLocks targetPending otherCompleted',
          ),
        );
        assert.ok(
          lock.samples.some(
            (s) =>
              s.targetPending === true &&
              s.lockWaits >= (index ? 1 : lock.concurrency) &&
              s.directBlocked >= 1 &&
              s.awaitingLocks >= 1 &&
              s.otherCompleted >= (index ? lock.concurrency - 1 : 0),
          ),
        );
      });
      if (!index) {
        equal(item.terminal.length, 3);
        item.terminal.forEach((probe, i) => {
          exact(
            probe,
            'name user sid requests status reason noRevival noRenewal',
          );
          equal(probe.name, names[i + 1]);
          equal(probe.reason, reason[i + 1]);
          equal(probe.status, 401);
          equal(probe.requests, 2);
          yes(probe.noRevival);
          yes(probe.noRenewal);
        });
      }
    });
    return 2;
  }
  if (selected === 'U5B' || selected === 'U5R') {
    exact(
      value,
      'status cases diagnostics scope disposableIdentityConfirmed browser',
    );
    equal(value.status, 'PASS');
    yes(value.disposableIdentityConfirmed);
    exact(value.browser, 'channel version headless');
    equal(value.browser.channel, 'msedge');
    yes(value.browser.headless);
    equal(value.cases.length, selected === 'U5R' ? 1 : 2);
    recovery(value.cases.at(-1));
    if (selected === 'U5B') {
      const item = value.cases[0];
      exact(
        item,
        'case status layout currentSid remoteSid readsDidNotRenewActivity currentAndRemoteOwnIdentityConfirmed passwordStatuses globalStatus ownCurrentMarker remoteDenied globalPosts extraLogoutPosts keyboardFocusAndSubmit viewport criticalControlsWithinViewport documentOverflowIsNotAControlClippingOracle passwordClearedAfterRejectCancelSuccess durableCleared durableClearedAfterReload',
      );
      equal(item.case, 'selected-and-global-real-browser');
      equal(item.status, 'PASS');
      equal(item.passwordStatuses, [400, 204]);
      equal(item.globalStatus, 204);
      equal(item.globalPosts, 1);
      equal(item.extraLogoutPosts, 0);
      for (const key of [
        'readsDidNotRenewActivity',
        'currentAndRemoteOwnIdentityConfirmed',
        'ownCurrentMarker',
        'keyboardFocusAndSubmit',
        'criticalControlsWithinViewport',
        'passwordClearedAfterRejectCancelSuccess',
        'durableClearedAfterReload',
      ])
        yes(item[key]);
      durable(item.durableCleared, true);
      expectedEvidence(item.remoteDenied, {
        ok: false,
        status: 401,
        code: 'AUTH_SESSION_REVOKED',
        failure: null,
      });
      uuid(item.currentSid);
      uuid(item.remoteSid);
      assert.notEqual(item.currentSid, item.remoteSid);
      equal(item.viewport, { width: 360, height: 800 });
    }
    return value.cases.length;
  }
  exact(
    value,
    'case status cases operations limits scope beforeBackupClock counts connectionsClosed',
  );
  equal(value.case, 'U5D');
  equal(value.status, 'PASS');
  equal(value.counts, { passed: 10, failed: 0 });
  yes(value.connectionsClosed);
  equal(value.cases.length, 10);
  const expected = [
    'predeploy-denies-0016-only',
    'predeploy-all17-private-upgrade',
    'predeploy-source17',
    'restore-exact-authority-quota-schema',
    'predeploy-restored17',
    'restored-real-quota-clock-branch',
    ...names.map((name) => 'restored-authority-' + name),
  ];
  value.cases.forEach((item, index) => {
    equal(item.name, expected[index]);
    equal(item.status, 'PASS');
    if (index >= 6)
      expectedEvidence(item, {
        name: expected[index],
        status: 'PASS',
        denied: index > 6,
        code: reason[index - 6],
        noRenewal: true,
      });
    else if ([1, 2, 4].includes(index)) exact(item, 'name status');
    else if (!index) {
      exact(item, 'name status code');
      equal(item.code, 'P0001');
    } else if (index === 3) {
      exact(item, 'name status authorityRows quotaRows tables fks dumpSha256');
      equal(item.authorityRows, 4);
      assert.ok(item.quotaRows > 0 && item.tables > 0 && item.fks > 0);
      hash(item.dumpSha256);
    } else {
      exact(
        item,
        'name status branchBefore branchAfter outcome clockBefore clockAfter beforeBudget afterBudget authorityUnchanged',
      );
      yes(item.authorityUnchanged);
      assert.ok(['deny', 'renew'].includes(item.outcome));
      clock(item.clockBefore);
      clock(item.clockAfter);
    }
  });
  return 10;
}
module.exports = { FILES, exact, validateRawCase, U5_CASES };
