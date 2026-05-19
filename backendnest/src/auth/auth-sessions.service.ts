import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthSession } from './entities/auth-session.entity';
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

  async rotate(sessionId: string, refreshToken: string, expiresAt: Date) {
    const now = new Date();

    await this.authSessionRepository.rotate(sessionId, {
      refreshTokenHash: this.hashToken(refreshToken),
      expiresAt,
      lastUsedAt: now,
      updatedAt: now,
    });
  }

  async revoke(sessionId: string, userId: string) {
    const now = new Date();

    await this.authSessionRepository.revoke(sessionId, userId, now);
  }

  async revokeAllByUser(userId: string) {
    const now = new Date();

    await this.authSessionRepository.revokeAllByUser(userId, now);
  }

  hasMatchingRefreshToken(session: AuthSession, refreshToken: string) {
    return session.refreshTokenHash === this.hashToken(refreshToken);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
