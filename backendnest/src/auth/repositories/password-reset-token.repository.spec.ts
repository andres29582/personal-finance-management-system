import { PasswordResetTokenRepository } from './password-reset-token.repository';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { User } from '../../users/entities/user.entity';
import { AuthSession } from '../entities/auth-session.entity';

describe('credential transaction boundaries', () => {
  function fixture() {
    const operations: string[] = [];
    const builder: Record<string, jest.Mock> = {};
    for (const method of ['set', 'where', 'andWhere', 'returning'])
      builder[method] = jest.fn(() => builder);
    builder.update = jest.fn((entity: { name: string }) => {
      operations.push(entity.name);
      return builder;
    });
    builder.execute = jest
      .fn()
      .mockResolvedValue({ affected: 1, raw: [{ user_id: 'user-1' }] });
    const manager = {
      insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'event-1' }] }),
      query: jest.fn(async (sql: string) =>
        sql.includes('clock_timestamp') ? [{ milliseconds: Date.now() }] : [],
      ),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn((entity: { name: string }) => {
        operations.push('lock:' + entity.name);
        return Promise.resolve(
          entity === User
            ? { id: 'user-1', senhaHash: 'old-hash', email: 'user@example.com' }
            : {
                id: 'session-1',
                userId: 'user-1',
                revokedAt: null,
                authenticatedAt: new Date(Date.now() - 1000),
                lastActivityAt: new Date(Date.now() - 1000),
                absoluteExpiresAt: new Date(Date.now() + 43200000),
                refreshExpiresAt: new Date(Date.now() + 60000),
                idleTimeoutSeconds: 900,
                policyVersion: 1,
                expiresAt: new Date(Date.now() + 60000),
              },
        );
      }),
      update: jest.fn((entity: { name: string }) => {
        operations.push(entity.name);
        return Promise.resolve({ affected: 1 });
      }),
      createQueryBuilder: jest.fn(() => builder),
    };
    const persistence = {
      findOne: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    };
    const source = {
      transaction: jest.fn(
        (callback: (value: typeof manager) => Promise<unknown>) =>
          callback(manager),
      ),
    };
    return {
      repository: new PasswordResetTokenRepository(
        persistence as never,
        source as never,
      ),
      builder,
      manager,
      operations,
    };
  }

  it('locks the user before consuming and invalidates pending siblings before sessions', async () => {
    const { repository, operations, builder } = fixture();
    await repository.consumeAndResetPassword(
      'token-hash',
      'new-hash',
      new Date(),
    );
    expect(operations[0]).toBe('lock:User');
    expect(builder.andWhere).toHaveBeenCalledWith('invalidated_at IS NULL');
    expect(builder.set).toHaveBeenCalledWith(
      expect.objectContaining({ invalidatedAt: expect.any(Date) as Date }),
    );
    expect(operations.indexOf(PasswordResetToken.name)).toBeLessThan(
      operations.indexOf(AuthSession.name),
    );
  });

  it('does not update the password when token consumption loses its CAS', async () => {
    const { repository, builder, operations } = fixture();
    builder.execute.mockResolvedValueOnce({ affected: 0, raw: [] });
    await expect(
      repository.consumeAndResetPassword('token-hash', 'new-hash', new Date()),
    ).resolves.toBeNull();
    expect(operations).not.toContain(User.name);
    expect(operations).not.toContain(AuthSession.name);
  });

  it('does not query the credential clock while the user lock is still waiting', async () => {
    const { repository, manager } = fixture();
    const user = {
      id: 'user-1',
      senhaHash: 'old-hash',
      email: 'user@example.com',
    };
    let releaseLock!: () => void;
    let reachedLock!: () => void;
    const lockedUser = new Promise<typeof user>((resolve) => {
      releaseLock = () => resolve(user);
    });
    const entered = new Promise<void>((resolve) => {
      reachedLock = resolve;
    });
    manager.findOne.mockImplementationOnce(() => {
      reachedLock();
      return lockedUser;
    });
    const result = repository.consumeAndResetPassword('token-hash', 'new-hash');
    await entered;
    const earlyClockQueries = manager.query.mock.calls.filter(([sql]) =>
      String(sql).includes('clock_timestamp'),
    );
    releaseLock();
    await result;
    expect(earlyClockQueries).toEqual([]);
    expect(
      manager.query.mock.calls.filter(([sql]) =>
        String(sql).includes('clock_timestamp'),
      ),
    ).toHaveLength(1);
  });

  it('rejects changed credential snapshots before changing an authenticated password', async () => {
    const { repository, manager } = fixture();
    await expect(
      repository.changeAuthenticatedPassword(
        'user-1',
        'session-1',
        'stale-hash',
        'new-hash',
      ),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID_SESSION' });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('rejects a session no longer active inside the transaction', async () => {
    const { repository, manager } = fixture();
    manager.findOne
      .mockResolvedValueOnce({ id: 'user-1', senhaHash: 'old-hash' } as never)
      .mockResolvedValueOnce(null as never);
    await expect(
      repository.changeAuthenticatedPassword(
        'user-1',
        'session-1',
        'old-hash',
        'new-hash',
      ),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID_SESSION' });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('propagates write failure so TypeORM can roll back all credential changes', async () => {
    const { repository, manager } = fixture();
    manager.update.mockRejectedValueOnce(new Error('write failed'));
    await expect(
      repository.consumeAndResetPassword('token-hash', 'new-hash'),
    ).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Credential operation failed.',
    });
    expect(manager.update).toHaveBeenCalledTimes(1);
  });

  it.each(['token', 'authenticated'])(
    'inserts a secret-free outbox event in the same transaction (%s)',
    async (flow) => {
      const { repository, manager } = fixture();
      if (flow === 'token')
        await repository.consumeAndResetPassword('token-hash', 'new-hash');
      else
        await repository.changeAuthenticatedPassword(
          'user-1',
          'session-1',
          'old-hash',
          'new-hash',
        );
      expect(manager.insert).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          recipient: 'user@example.com',
          occurredAt: expect.any(Date) as Date,
        }),
      );
      const data = manager.insert.mock.calls[0] as unknown[];
      expect(JSON.stringify(data)).not.toMatch(
        /token-hash|new-hash|old-hash|session-1/,
      );
    },
  );
});
