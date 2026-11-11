import { AuthSessionRepository } from './auth-session.repository';
import { AuthSession } from '../entities/auth-session.entity';
import { User } from '../../users/entities/user.entity';

const now = new Date('2026-10-11T12:00:00Z');
const callerId = '00000000-0000-4000-8000-000000000001';
const targetId = '00000000-0000-4000-8000-000000000002';
function active(id = callerId) {
  return {
    id,
    userId: 'owner',
    revokedAt: null,
    terminalReason: null,
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
  const rows = [active(), active(targetId)];
  const user = { id: 'owner', senhaHash: 'verified' };
  let quota = true;
  const manager = {
    query: jest.fn(async (sql: string, _args?: unknown[]) => {
      if (sql.includes('clock_timestamp')) {
        calls.push('clock');
        return [{ milliseconds: now.getTime() }];
      }
      if (sql.includes('FOR UPDATE')) {
        calls.push('sessions');
        return rows.map(({ id }) => ({ id }));
      }
      if (sql.includes('INSERT INTO auth_session_reauthentication')) {
        calls.push('reserve');
        return quota ? [{ attempts: 1 }] : [];
      }
      if (sql.includes('to_char')) {
        calls.push('page');
        return [];
      }
      calls.push('timeout');
      return [];
    }),
    findOne: jest.fn(async (entity: unknown) => {
      calls.push(entity === User ? 'user' : 'caller');
      return entity === User ? user : rows[0];
    }),
    find: jest.fn(async () => rows),
    update: jest.fn(async () => {
      calls.push('revoke');
      return { affected: 1 };
    }),
  };
  const source = {
    transaction: jest.fn(async (work: (manager: unknown) => unknown) => {
      const result = await work(manager);
      calls.push('commit');
      return result;
    }),
  };
  const repository = new AuthSessionRepository(
    {} as never,
    source as never,
  ) as any;
  return {
    repository,
    manager,
    rows,
    calls,
    user,
    denyQuota: () => {
      quota = false;
    },
  };
}
describe('U5 session management transaction boundaries', () => {
  it('lists a bounded owner page only after revalidating caller, without touching activity', async () => {
    const f = fixture();
    await f.repository.listOwnSessions('owner', callerId, { limit: 20 });
    expect(f.calls).toEqual([
      'timeout',
      'user',
      'caller',
      'clock',
      'page',
      'commit',
    ]);
    expect(f.manager.update).not.toHaveBeenCalled();
    const [sql, args] = f.manager.query.mock.calls.find(([sql]) =>
      sql.includes('to_char'),
    )!;
    expect(sql).toContain('usuario_id = $1');
    expect(args).toContain('owner');
    expect(args).toContain(21);
  });
  it('commits terminal caller expiry before rejecting and never discloses a page', async () => {
    const f = fixture();
    f.rows[0].lastActivityAt = new Date(now.getTime() - 900000);
    f.rows[0].authenticatedAt = new Date(now.getTime() - 901000);
    await expect(
      f.repository.listOwnSessions('owner', callerId, { limit: 20 }),
    ).rejects.toMatchObject({ code: 'AUTH_SESSION_IDLE_EXPIRED' });
    expect(f.calls.at(-1)).toBe('commit');
    expect(f.calls).not.toContain('page');
  });
  it('reserves one shared account attempt under caller authority before exposing the password hash', async () => {
    const f = fixture();
    await expect(
      f.repository.reserveSessionReauthentication('owner', callerId),
    ).resolves.toBe('verified');
    expect(f.calls).toEqual([
      'timeout',
      'user',
      'caller',
      'clock',
      'reserve',
      'commit',
    ]);
  });
  it('returns a temporary non-terminal account 429 without exposing the hash', async () => {
    const f = fixture();
    f.denyQuota();
    await expect(
      f.repository.reserveSessionReauthentication('owner', callerId),
    ).rejects.toMatchObject({
      code: 'AUTH_REAUTHENTICATION_LIMIT',
      statusCode: 429,
    });
    expect(f.manager.update).not.toHaveBeenCalled();
    expect(f.calls.at(-1)).toBe('commit');
  });
  it('rechecks the verified password hash inside effect locks', async () => {
    const f = fixture();
    f.user.senhaHash = 'changed';
    await expect(
      f.repository.revokeOwnSessions('owner', callerId, 'verified', targetId),
    ).rejects.toMatchObject({
      code: 'AUTH_CURRENT_PASSWORD_INVALID',
      statusCode: 400,
    });
    expect(f.manager.update).not.toHaveBeenCalled();
  });
  it('orders session locks before the clock and revokes only the selected own target', async () => {
    const f = fixture();
    await f.repository.revokeOwnSessions(
      'owner',
      callerId,
      'verified',
      targetId,
    );
    expect(f.calls).toEqual([
      'timeout',
      'user',
      'sessions',
      'clock',
      'revoke',
      'commit',
    ]);
    expect(f.manager.update).toHaveBeenCalledTimes(1);
    expect(f.manager.update).toHaveBeenCalledWith(
      AuthSession,
      expect.objectContaining({ id: targetId, userId: 'owner' }),
      expect.objectContaining({ terminalReason: 'AUTH_SESSION_REVOKED' }),
    );
  });
  it('includes the current session in global revocation', async () => {
    const f = fixture();
    await f.repository.revokeOwnSessions('owner', callerId, 'verified');
    expect(f.manager.update).toHaveBeenCalledTimes(2);
  });
  it('commits revoked-caller rejection without revoking a different target', async () => {
    const f = fixture();
    f.rows[0].revokedAt = now as never;
    await expect(
      f.repository.revokeOwnSessions('owner', callerId, 'verified', targetId),
    ).rejects.toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
    expect(f.manager.update).not.toHaveBeenCalled();
    expect(f.calls.at(-1)).toBe('commit');
  });
});
