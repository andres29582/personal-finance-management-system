import { AuthSessionRepository } from './auth-session.repository';
import { AuthSession } from '../entities/auth-session.entity';
import { User } from '../../users/entities/user.entity';
const now = new Date('2026-10-09T12:00:00Z');
function valid(id = 'session-1') {
  return {
    id,
    userId: 'user-1',
    refreshTokenHash: 'old',
    revokedAt: null,
    authenticatedAt: new Date(now.getTime() - 1000),
    lastActivityAt: new Date(now.getTime() - 1000),
    absoluteExpiresAt: new Date(now.getTime() + 43200000),
    refreshExpiresAt: new Date(now.getTime() + 43200000),
    idleTimeoutSeconds: 900,
    policyVersion: 1,
  };
}
function fixture() {
  const calls: string[] = [];
  let current = valid();
  const manager = {
    query: jest.fn((sql: string) => {
      calls.push(
        sql.includes('clock_timestamp')
          ? 'clock'
          : sql.includes('FOR UPDATE')
            ? 'sessions'
            : 'timeout',
      );
      return Promise.resolve(
        sql.includes('clock_timestamp')
          ? [{ milliseconds: now.getTime() }]
          : sql.includes('FOR UPDATE')
            ? [{ id: 'session-1' }]
            : [],
      );
    }),
    findOne: jest.fn((target: unknown) => {
      calls.push(target === User ? 'user' : 'session');
      return Promise.resolve(
        target === User ? { id: 'user-1', senhaHash: 'verified' } : current,
      );
    }),
    find: jest.fn(() => Promise.resolve([current])),
    update: jest
      .fn<Promise<{ affected: number }>, unknown[]>()
      .mockResolvedValue({ affected: 1 }),
    save: jest.fn((...args: [unknown, Partial<AuthSession>]) =>
      Promise.resolve(args[1]),
    ),
    create: jest.fn((...args: [unknown, Partial<AuthSession>]) => args[1]),
  };
  const source = {
    transaction: jest.fn(
      async (
        work: (transactionManager: typeof manager) => Promise<unknown>,
      ) => {
        const result = await work(manager);
        calls.push('commit');
        return result;
      },
    ),
  };
  return {
    repository: new AuthSessionRepository({} as never, source as never),
    manager,
    calls,
    setSession: (session: ReturnType<typeof valid>) => {
      current = session;
    },
  };
}
const issue = jest.fn(() =>
  Promise.resolve({
    access_token: 'access',
    refresh_token: 'refresh',
    refreshTokenHash: 'next',
    expiresAt: new Date(now.getTime() + 60000),
  }),
);
describe('AuthSessionRepository atomic authority', () => {
  beforeEach(() => issue.mockClear());
  it('takes user then session locks before clock and returns only after commit', async () => {
    const f = fixture();
    await f.repository.authorize('session-1', 'user-1', true);
    expect(f.calls).toEqual(['timeout', 'user', 'session', 'clock', 'commit']);
    expect(f.manager.update).toHaveBeenCalledWith(
      AuthSession,
      expect.anything(),
      expect.objectContaining({ lastActivityAt: now }),
    );
  });
  it('checks background without touch', async () => {
    const f = fixture();
    await f.repository.authorize('session-1', 'user-1', false);
    expect(f.manager.update).not.toHaveBeenCalled();
  });
  it('commits idle expiry before throwing and never touches', async () => {
    const f = fixture();
    f.setSession({
      ...valid(),
      lastActivityAt: new Date(now.getTime() - 900000),
      authenticatedAt: new Date(now.getTime() - 901000),
    });
    await expect(
      f.repository.authorize('session-1', 'user-1', true),
    ).rejects.toMatchObject({ code: 'AUTH_SESSION_IDLE_EXPIRED' });
    expect(f.calls.at(-1)).toBe('commit');
    expect(f.manager.update).toHaveBeenCalledWith(
      AuthSession,
      expect.anything(),
      expect.objectContaining({ terminalReason: 'AUTH_SESSION_IDLE_EXPIRED' }),
    );
  });
  it('does not authorize a zero-row touch', async () => {
    const f = fixture();
    f.manager.update.mockResolvedValue({ affected: 0 });
    await expect(
      f.repository.authorize('session-1', 'user-1', true),
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(f.calls).not.toContain('commit');
  });
  it('cannot touch an owner mismatch', async () => {
    const f = fixture();
    f.setSession({ ...valid(), userId: 'other' });
    await expect(
      f.repository.authorize('session-1', 'user-1', true),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID_SESSION' });
    expect(f.manager.update).not.toHaveBeenCalled();
  });
  it('reads no clock until session lock resolves', async () => {
    const f = fixture();
    let release!: (v: ReturnType<typeof valid>) => void;
    let entered!: () => void;
    const reached = new Promise<void>((r) => (entered = r));
    const lock = new Promise<ReturnType<typeof valid>>((r) => (release = r));
    f.manager.findOne.mockImplementation(async (target: any) => {
      if (target === User) return { id: 'user-1', senhaHash: 'verified' };
      entered();
      return lock;
    });
    const pending = f.repository.authorize('session-1', 'user-1', false);
    await reached;
    expect(f.calls).not.toContain('clock');
    release(valid());
    await pending;
    expect(f.calls).toContain('clock');
  });
  it('rotates without changing activity or absolute and distinguishes real reuse', async () => {
    const f = fixture();
    await expect(
      f.repository.rotateIfActiveWithMatchingToken(
        'session-1',
        'user-1',
        'old',
        issue,
      ),
    ).resolves.toHaveProperty('tokens');
    const update = f.manager.update.mock.calls[0];
    expect(update[2]).not.toHaveProperty('lastActivityAt');
    expect(update[2]).not.toHaveProperty('absoluteExpiresAt');
    const reused = await f.repository.rotateIfActiveWithMatchingToken(
      'session-1',
      'user-1',
      'wrong',
      issue,
    );
    expect(reused).toEqual({
      failure: 'AUTH_INVALID_REFRESH_TOKEN',
      reuse: true,
    });
    expect(f.calls.at(-1)).toBe('commit');
  });
  it('does not classify ordinary expiry as replay', async () => {
    const f = fixture();
    f.setSession({ ...valid(), absoluteExpiresAt: now });
    expect(
      await f.repository.rotateIfActiveWithMatchingToken(
        'session-1',
        'user-1',
        'wrong',
        issue,
      ),
    ).toEqual({ failure: 'AUTH_SESSION_ABSOLUTE_EXPIRED' });
    expect(issue).not.toHaveBeenCalled();
  });
  it('prunes only valid sessions and initializes deadlines after locks', async () => {
    const f = fixture();
    await f.repository.createSession({
      id: 'new',
      userId: 'user-1',
      expectedPasswordHash: 'verified',
      maxActiveSessions: 1,
      policy: { idleSeconds: 900, absoluteSeconds: 43200, version: 1 },
      issue,
    });
    expect(f.calls.indexOf('sessions')).toBeLessThan(f.calls.indexOf('clock'));
    expect(f.manager.save).toHaveBeenCalledWith(
      AuthSession,
      expect.objectContaining({
        authenticatedAt: now,
        lastActivityAt: now,
        absoluteExpiresAt: new Date(now.getTime() + 43200000),
        policyVersion: 1,
      }),
    );
    expect(f.manager.update).toHaveBeenCalledWith(
      AuthSession,
      expect.anything(),
      expect.objectContaining({ terminalReason: 'AUTH_SESSION_REVOKED' }),
    );
  });
});
