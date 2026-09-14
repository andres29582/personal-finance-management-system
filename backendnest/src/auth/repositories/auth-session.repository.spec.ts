import { AuthSessionRepository } from './auth-session.repository';

describe('AuthSessionRepository', () => {
  it('revokes the oldest active session before creating one beyond the limit', async () => {
    const manager = {
      create: jest.fn((_target, data) => data),
      find: jest.fn().mockResolvedValue([
        { id: 'oldest-session' },
        { id: 'newer-session' },
      ]),
      query: jest.fn(),
      save: jest.fn().mockResolvedValue({ id: 'new-session' }),
      update: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    const repository = new AuthSessionRepository({} as never, dataSource as never);

    await repository.createSession({
      expiresAt: new Date('2026-10-01T00:00:00.000Z'),
      id: 'new-session',
      lastUsedAt: new Date('2026-09-14T00:00:00.000Z'),
      maxActiveSessions: 2,
      refreshTokenHash: 'hash-only',
      revokedAt: null,
      userId: 'user-1',
    });

    expect(manager.query).toHaveBeenCalledWith(
      'SELECT 1 FROM usuario WHERE id = $1 FOR UPDATE',
      ['user-1'],
    );
    expect(manager.update).toHaveBeenCalledWith(
      expect.any(Function),
      expect.anything(),
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      expect.any(Function),
      expect.not.objectContaining({ maxActiveSessions: expect.anything() }),
    );
  });

  it('touches only a non-revoked, non-expired session', async () => {
    const persistence = { update: jest.fn() };
    const repository = new AuthSessionRepository({
      update: persistence.update,
    } as never, {} as never);
    const now = new Date('2026-09-14T00:00:00.000Z');

    await repository.touchIfActive('session-1', now);

    expect(persistence.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1' }),
      { lastUsedAt: now, updatedAt: now },
    );
  });
});
