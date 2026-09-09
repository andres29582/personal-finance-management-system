import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { BaseRepository } from '../../common/abstract/base.repository';
import { AuthSession } from '../entities/auth-session.entity';

@Injectable()
export class AuthSessionRepository extends BaseRepository<AuthSession> {
  constructor(
    @InjectRepository(AuthSession)
    private readonly authSessionRepository: Repository<AuthSession>,
  ) {
    super(authSessionRepository);
  }

  async createSession(session: Partial<AuthSession>): Promise<AuthSession> {
    const entity = this.authSessionRepository.create(session);
    return this.authSessionRepository.save(entity);
  }

  async findActiveById(sessionId: string): Promise<AuthSession | null> {
    return this.authSessionRepository.findOne({
      where: {
        id: sessionId,
        revokedAt: IsNull(),
      },
    });
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
