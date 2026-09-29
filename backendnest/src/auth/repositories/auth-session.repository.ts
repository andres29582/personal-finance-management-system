import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, MoreThan, Repository } from 'typeorm';
import { BaseRepository } from '../../common/abstract/base.repository';
import { AuthSession } from '../entities/auth-session.entity';

@Injectable()
export class AuthSessionRepository extends BaseRepository<AuthSession> {
  constructor(
    @InjectRepository(AuthSession)
    private readonly authSessionRepository: Repository<AuthSession>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    super(authSessionRepository);
  }

  async createSession(
    session: Pick<
      AuthSession,
      'expiresAt' | 'id' | 'refreshTokenHash' | 'userId'
    > & {
      maxActiveSessions: number;
      lastUsedAt: Date;
      revokedAt: null;
    },
  ): Promise<AuthSession> {
    return this.dataSource.transaction(async (manager) => {
      const now = new Date();

      // Serializes concurrent sign-ins for the same user before enforcing the cap.
      await manager.query('SELECT 1 FROM usuario WHERE id = $1 FOR UPDATE', [
        session.userId,
      ]);

      const activeSessions = await manager.find(AuthSession, {
        where: {
          userId: session.userId,
          revokedAt: IsNull(),
          expiresAt: MoreThan(now),
        },
        order: { createdAt: 'ASC' },
      });
      const sessionsToRevoke = activeSessions.slice(
        0,
        Math.max(0, activeSessions.length - session.maxActiveSessions + 1),
      );

      if (sessionsToRevoke.length > 0) {
        await manager.update(
          AuthSession,
          { id: In(sessionsToRevoke.map((activeSession) => activeSession.id)) },
          { revokedAt: now, updatedAt: now },
        );
      }

      const { maxActiveSessions, ...entityData } = session;
      void maxActiveSessions;
      return manager.save(AuthSession, manager.create(AuthSession, entityData));
    });
  }

  async findActiveById(sessionId: string): Promise<AuthSession | null> {
    return this.authSessionRepository.findOne({
      where: {
        id: sessionId,
        revokedAt: IsNull(),
      },
    });
  }

  async touchIfActive(sessionId: string, now: Date): Promise<void> {
    await this.authSessionRepository.update(
      {
        id: sessionId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(now),
      },
      {
        lastUsedAt: now,
        updatedAt: now,
      },
    );
  }

  async rotateIfActiveWithMatchingToken(
    sessionId: string,
    currentRefreshTokenHash: string,
    data: Pick<
      AuthSession,
      'expiresAt' | 'lastUsedAt' | 'refreshTokenHash' | 'updatedAt'
    >,
  ): Promise<boolean> {
    const result = await this.authSessionRepository.update(
      {
        id: sessionId,
        refreshTokenHash: currentRefreshTokenHash,
        revokedAt: IsNull(),
        expiresAt: MoreThan(data.updatedAt),
      },
      data,
    );

    return result.affected === 1;
  }

  async revoke(
    sessionId: string,
    userId: string,
    revokedAt: Date,
  ): Promise<void> {
    await this.authSessionRepository.update(
      {
        id: sessionId,
        userId,
        revokedAt: IsNull(),
      },
      {
        revokedAt,
        updatedAt: revokedAt,
      },
    );
  }

  async revokeAllByUser(userId: string, revokedAt: Date): Promise<void> {
    await this.authSessionRepository.update(
      {
        userId,
        revokedAt: IsNull(),
      },
      {
        revokedAt,
        updatedAt: revokedAt,
      },
    );
  }
}
