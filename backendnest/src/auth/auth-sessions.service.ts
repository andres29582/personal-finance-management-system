import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  AuthSessionRepository,
  SessionIssuer,
  IssuedSessionTokens,
} from './repositories/auth-session.repository';
import { SessionPolicy } from './session-policy';
import { SessionListOptions } from './dto/session-management.dto';

@Injectable()
export class AuthSessionsService {
  constructor(private readonly authSessionRepository: AuthSessionRepository) {}
  async listOwnSessions(
    userId: string,
    callerId: string,
    options: SessionListOptions,
  ) {
    return this.authSessionRepository.listOwnSessions(
      userId,
      callerId,
      options,
    );
  }
  async reserveSessionReauthentication(userId: string, callerId: string) {
    return this.authSessionRepository.reserveSessionReauthentication(
      userId,
      callerId,
    );
  }
  async revokeOwnSessions(
    userId: string,
    callerId: string,
    expectedPasswordHash: string,
    targetId?: string,
  ) {
    return this.authSessionRepository.revokeOwnSessions(
      userId,
      callerId,
      expectedPasswordHash,
      targetId,
    );
  }
  async create(session: {
    id: string;
    userId: string;
    expectedPasswordHash: string;
    maxActiveSessions: number;
    policy: SessionPolicy;
    issue: SessionIssuer;
  }): Promise<IssuedSessionTokens> {
    return this.authSessionRepository.createSession(session);
  }
  async findActiveById(sessionId: string) {
    return this.authSessionRepository.findActiveById(sessionId);
  }
  async authorize(sessionId: string, userId: string, activity = false) {
    return this.authSessionRepository.authorize(sessionId, userId, activity);
  }
  async touchIfActive(sessionId: string, userId: string) {
    return this.authSessionRepository.touchIfActive(sessionId, userId);
  }
  async rotateIfActiveWithMatchingToken(
    sessionId: string,
    userId: string,
    currentRefreshToken: string,
    issue: SessionIssuer,
  ) {
    return this.authSessionRepository.rotateIfActiveWithMatchingToken(
      sessionId,
      userId,
      this.hashToken(currentRefreshToken),
      issue,
    );
  }
  async revoke(sessionId: string, userId: string) {
    await this.authSessionRepository.revoke(sessionId, userId);
  }
  async revokeAllByUser(userId: string) {
    await this.authSessionRepository.revokeAllByUser(userId);
  }
  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
