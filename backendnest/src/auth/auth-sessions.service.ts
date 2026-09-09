import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthSessionRepository } from './repositories/auth-session.repository';

@Injectable()
export class AuthSessionsService {
  constructor(private readonly authSessionRepository: AuthSessionRepository) {}

  async create(session: {
    expiresAt: Date;
    id: string;
    refreshToken: string;
    userId: string;
  }) {
    return this.authSessionRepository.createSession({
      id: session.id,
      userId: session.userId,
      refreshTokenHash: this.hashToken(session.refreshToken),
      expiresAt: session.expiresAt,
      revokedAt: null,
      lastUsedAt: null,
    });
  }

  async findActiveById(sessionId: string) {
    return this.authSessionRepository.findActiveById(sessionId);
  }

  async rotateIfActiveWithMatchingToken(
    sessionId: string,
    currentRefreshToken: string,
    nextRefreshToken: string,
    expiresAt: Date,
  ) {
    const now = new Date();

    return this.authSessionRepository.rotateIfActiveWithMatchingToken(
      sessionId,
      this.hashToken(currentRefreshToken),
      {
        refreshTokenHash: this.hashToken(nextRefreshToken),
        expiresAt,
        lastUsedAt: now,
        updatedAt: now,
      },
    );
  }

  async revoke(sessionId: string, userId: string) {
    const now = new Date();

    await this.authSessionRepository.revoke(sessionId, userId, now);
  }

  async revokeAllByUser(userId: string) {
    const now = new Date();

    await this.authSessionRepository.revokeAllByUser(userId, now);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
