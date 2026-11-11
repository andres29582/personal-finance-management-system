const {
  summarize,
  assertHealthy,
  assertAdmission,
  assertNoRenewal,
} = require('./load.cjs');

describe('bounded concurrency harness helpers (not runtime proof)', () => {
  const expected = {
    user: 'u',
    sid: 's',
    idleExpiresAt: '2026-10-11T17:01:00.000Z',
    absoluteExpiresAt: '2026-10-12T04:00:00.000Z',
  };
  const healthy = () => ({
    status: 200,
    latencyMs: 3,
    user: 'u',
    sid: 's',
    cacheControl: 'no-store',
    state: {
      ...expected,
      policyVersion: 1,
      serverNow: '2026-10-11T17:00:00.000Z',
    },
    headerState: {
      ...expected,
      policyVersion: 1,
      serverNow: '2026-10-11T17:00:00.000Z',
    },
  });
  test('reports every status and nearest-rank small-sample percentiles', () => {
    expect(
      summarize(
        [200, 401, 429, 500, 'network-error'].map((status, i) => ({
          status,
          latencyMs: i + 1,
        })),
      ),
    ).toEqual({
      statuses: {
        '200': 1,
        '401': 1,
        '429': 1,
        '500': 1,
        other: 0,
        'network-error': 1,
      },
      p50: 3,
      p95: 5,
      p99: 5,
      samples: 5,
    });
  });
  test.each([401, 429, 500, 'network-error'])(
    'does not accept %s as authorized lock coverage',
    (status) =>
      expect(() => assertHealthy({ ...healthy(), status }, expected)).toThrow(),
  );
  test('requires matching signed-request identities and unique DB deadlines in body/header', () => {
    expect(() => assertHealthy(healthy(), expected)).not.toThrow();
    expect(() =>
      assertHealthy({ ...healthy(), user: 'other' }, expected),
    ).toThrow();
    const r = healthy();
    r.state.absoluteExpiresAt = '2026-10-12T05:00:00.000Z';
    expect(() => assertHealthy(r, expected)).toThrow();
    const h = healthy();
    h.headerState.policyVersion = 2;
    expect(() => assertHealthy(h, expected)).toThrow();
  });
  test('rejects expired healthy response deadlines', () => {
    const r = healthy();
    r.state.serverNow = expected.idleExpiresAt;
    r.headerState.serverNow = expected.idleExpiresAt;
    expect(() => assertHealthy(r, expected)).toThrow();
  });
  test('requires real lock waits, direct owned blocker, pending target and other progress', () => {
    const s = {
      lockWaits: 2,
      awaitingLocks: 2,
      directBlocked: 1,
      targetPending: true,
      otherCompleted: 1,
    };
    expect(() => assertAdmission(s, 2, 1)).not.toThrow();
    for (const bad of [
      { lockWaits: 0 },
      { awaitingLocks: 0 },
      { directBlocked: 0 },
      { targetPending: false },
      { otherCompleted: 0 },
    ])
      expect(() => assertAdmission({ ...s, ...bad }, 2, 1)).toThrow();
  });
  test('allows only terminal marking, not deadline/activity renewal or revival', () => {
    const before = {
      id: 's',
      last_activity_at: 'a',
      absolute_expires_at: 'b',
      revoked_at: null,
      terminal_reason: null,
      updated_at: 'c',
    };
    const after = {
      ...before,
      revoked_at: 'r',
      terminal_reason: 'AUTH_SESSION_IDLE_EXPIRED',
      updated_at: 'd',
    };
    expect(() =>
      assertNoRenewal(before, after, 'AUTH_SESSION_IDLE_EXPIRED'),
    ).not.toThrow();
    expect(() =>
      assertNoRenewal(
        before,
        { ...after, last_activity_at: 'new' },
        'AUTH_SESSION_IDLE_EXPIRED',
      ),
    ).toThrow();
    expect(() =>
      assertNoRenewal(
        before,
        { ...after, revoked_at: null },
        'AUTH_SESSION_IDLE_EXPIRED',
      ),
    ).toThrow();
    expect(() =>
      assertNoRenewal(
        after,
        { ...after, updated_at: 'e' },
        'AUTH_SESSION_IDLE_EXPIRED',
      ),
    ).toThrow();
  });
});
