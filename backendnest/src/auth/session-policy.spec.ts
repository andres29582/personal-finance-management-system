import {
  sessionFailure,
  resolveSessionPolicy,
  cappedExpiration,
} from './session-policy';

describe('server session policy', () => {
  const now = new Date('2026-10-09T12:00:00.000Z');
  const valid = () => ({
    userId: 'A',
    revokedAt: null,
    policyVersion: 1,
    authenticatedAt: new Date(now.getTime() - 901000),
    lastActivityAt: new Date(now.getTime() - 899999),
    idleTimeoutSeconds: 900,
    absoluteExpiresAt: new Date(now.getTime() + 10000),
    refreshExpiresAt: new Date(now.getTime() + 10000),
    terminalReason: null,
  });
  it('approves 15 minutes and 12 hours with a known version', () => {
    expect(resolveSessionPolicy({ get: () => undefined } as never)).toEqual({
      idleSeconds: 900,
      absoluteSeconds: 43200,
      version: 1,
    });
  });
  it.each(['0', '-1', '1.5', 'Infinity', '9007199254740992'])(
    'rejects invalid idle %s',
    (value) => {
      expect(() =>
        resolveSessionPolicy({
          get: (key: string) =>
            key === 'AUTH_SESSION_IDLE_SECONDS' ? value : undefined,
        } as never),
      ).toThrow();
    },
  );
  it('rejects unknown versions and idle exceeding absolute', () => {
    expect(() =>
      resolveSessionPolicy({
        get: (key: string) =>
          key === 'AUTH_SESSION_POLICY_VERSION' ? '2' : undefined,
      } as never),
    ).toThrow();
    expect(() =>
      resolveSessionPolicy({
        get: (key: string) =>
          key === 'AUTH_SESSION_ABSOLUTE_SECONDS' ? '899' : undefined,
      } as never),
    ).toThrow();
  });
  it('allows just before idle and denies equality or later', () => {
    expect(sessionFailure(valid() as never, 'A', now)).toBeNull();
    for (const delta of [900000, 900001])
      expect(
        sessionFailure(
          {
            ...valid(),
            lastActivityAt: new Date(now.getTime() - delta),
          } as never,
          'A',
          now,
        ),
      ).toBe('AUTH_SESSION_IDLE_EXPIRED');
  });
  it.each(['absoluteExpiresAt', 'refreshExpiresAt'])(
    'denies %s at equality',
    (field) => {
      expect(
        sessionFailure({ ...valid(), [field]: now } as never, 'A', now),
      ).toBe(
        field === 'absoluteExpiresAt'
          ? 'AUTH_SESSION_ABSOLUTE_EXPIRED'
          : 'AUTH_INVALID_SESSION',
      );
    },
  );
  it('denies legacy, wrong owner, missing, future activity and revoked records', () => {
    expect(
      sessionFailure({ ...valid(), policyVersion: null } as never, 'A', now),
    ).toBe('AUTH_INVALID_SESSION');
    expect(sessionFailure(valid() as never, 'B', now)).toBe(
      'AUTH_INVALID_SESSION',
    );
    expect(sessionFailure(null, 'A', now)).toBe('AUTH_INVALID_SESSION');
    expect(
      sessionFailure(
        { ...valid(), lastActivityAt: new Date(now.getTime() + 1) } as never,
        'A',
        now,
      ),
    ).toBe('AUTH_INVALID_SESSION');
    expect(
      sessionFailure({ ...valid(), revokedAt: now } as never, 'A', now),
    ).toBe('AUTH_SESSION_REVOKED');
  });
  it('retains committed terminal expiry after clock moves backwards', () => {
    expect(
      sessionFailure(
        {
          ...valid(),
          revokedAt: now,
          terminalReason: 'AUTH_SESSION_IDLE_EXPIRED',
        } as never,
        'A',
        new Date(now.getTime() - 1),
      ),
    ).toBe('AUTH_SESSION_IDLE_EXPIRED');
  });
  it('rounds JWT deadline down and never widens a shorter TTL', () => {
    expect(cappedExpiration(2000, new Date(1999999))).toBe(1999);
    expect(cappedExpiration(1000, new Date(1999999))).toBe(1000);
  });
});
