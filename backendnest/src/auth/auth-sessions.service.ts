import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { AuthSession } from './entities/auth-session.entity';

@Injectable()
export class AuthSessionsService {
  constructor(
    @InjectRepository(AuthSession)
    private readonly authSessionsRepository: Repository<AuthSession>,
  ) {}

  async create(session: {
    expiresAt: Date;
    id: string;
    refreshToken: string;
    userId: string;
  }) {
    const entity = this.authSessionsRepository.create({
      id: session.id,
      userId: session.userId,
      refreshTokenHash: this.hashToken(session.refreshToken),
      expiresAt: session.expiresAt,
      revokedAt: null,
      lastUsedAt: null,
    });

    return this.authSessionsRepository.save(entity);
  }

  async findActiveById(sessionId: string) {
    return this.authSessionsRepository.findOne({
      where: {
        id: sessionId,
        revokedAt: IsNull(),
      },
    });
  }

  async rotate(sessionId: string, refreshToken: string, expiresAt: Date) {
    const now = new Date();

    await this.authSessionsRepository.update(sessionId, {
      refreshTokenHash: this.hashToken(refreshToken),
      expiresAt,
      lastUsedAt: now,
      updatedAt: now,
    });
  }

  async revoke(sessionId: string, userId: string) {
    const now = new Date();

    await this.authSessionsRepository.update(
      {
        id: sessionId,
        userId,
        revokedAt: IsNull(),
      },
      {
        revokedAt: now,
        updatedAt: now,
      },
    );
  }

  async revokeAllByUser(userId: string) {
    const now = new Date();

    await this.authSessionsRepository.update(
      {
        userId,
        revokedAt: IsNull(),
      },
      {
        revokedAt: now,
        updatedAt: now,
      },
    );
  }

  hasMatchingRefreshToken(session: AuthSession, refreshToken: string) {
    return session.refreshTokenHash === this.hashToken(refreshToken);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
