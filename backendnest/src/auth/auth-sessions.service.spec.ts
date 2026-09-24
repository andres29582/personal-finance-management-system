import { createHash } from 'crypto';
import { AuthSessionsService } from './auth-sessions.service';
import { AuthSession } from './entities/auth-session.entity';
import { AuthSessionRepository } from './repositories/auth-session.repository';

describe('AuthSessionsService', () => {
  it('persists only the refresh-token hash and forwards the session limit', async () => {
    const createdSession: AuthSession = {
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'hash-only',
      expiresAt: new Date('2026-09-15T00:00:00.000Z'),
      revokedAt: null,
      lastUsedAt: new Date('2026-09-14T00:00:00.000Z'),
      createdAt: new Date('2026-09-14T00:00:00.000Z'),
      updatedAt: new Date('2026-09-14T00:00:00.000Z'),
    };
    const repository: jest.Mocked<
      Pick<AuthSessionRepository, 'createSession'>
    > = {
      createSession: jest.fn().mockResolvedValue(createdSession),
    };
    const service = new AuthSessionsService(
      repository as unknown as AuthSessionRepository,
    );

    await service.create({
      expiresAt: new Date('2026-09-15T00:00:00.000Z'),
      id: 'session-1',
      maxActiveSessions: 3,
      refreshToken: 'plain-refresh-token',
      userId: 'user-1',
    });

    const persisted = repository.createSession.mock.calls[0]?.[0];
    expect(persisted).toMatchObject({
      maxActiveSessions: 3,
      refreshTokenHash: createHash('sha256')
        .update('plain-refresh-token')
        .digest('hex'),
    });
    expect(persisted?.lastUsedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(persisted)).not.toContain('plain-refresh-token');
  });

  it('touches a session through the active-session-only repository update', async () => {
    const repository = {
      touchIfActive: jest.fn(),
    };
    const service = new AuthSessionsService(
      repository as unknown as AuthSessionRepository,
    );

    await service.touchIfActive('session-1');

    expect(repository.touchIfActive).toHaveBeenCalledWith(
      'session-1',
      expect.any(Date),
    );
  });
});
