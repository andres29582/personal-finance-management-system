import {
  lockUserSessions,
  persistSessionFailure,
} from './auth-session.repository';
import {
  sessionFailure,
  SessionFailure,
  rejectSession,
} from '../session-policy';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { AppUnauthorizedException } from '../../common/exceptions';
import {
  credentialTime,
  credentialTransaction,
  lockCredentialUser,
} from './credential-lock';
import { BaseRepository } from '../../common/abstract/base.repository';
import { User } from '../../users/entities/user.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { PasswordChangedOutbox } from '../entities/password-changed-outbox.entity';

@Injectable()
export class PasswordResetTokenRepository extends BaseRepository<PasswordResetToken> {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    private readonly dataSource: DataSource,
  ) {
    super(passwordResetTokenRepository);
  }

  async createToken(
    token: Partial<PasswordResetToken>,
    expectedPasswordHash: string,
    ttlMinutes: number,
  ): Promise<PasswordResetToken | null> {
    if (!token.userId) return null;
    const userId = token.userId;
    return credentialTransaction(this.dataSource, async (manager) => {
      const user = await lockCredentialUser(manager, userId);
      if (!user || user.senhaHash !== expectedPasswordHash) return null;
      const now = await credentialTime(manager);
      return manager.save(
        PasswordResetToken,
        manager.create(PasswordResetToken, {
          ...token,
          expiresAt: new Date(now.getTime() + ttlMinutes * 60_000),
          usedAt: null,
          invalidatedAt: null,
        }),
      );
    });
  }

  async consumeAndResetPassword(
    tokenHash: string,
    passwordHash: string,
    _now?: Date,
  ): Promise<string | null> {
    void _now; // Legacy caller time is not authoritative after waiting for a lock.
    const hint = await this.passwordResetTokenRepository.findOne({
      where: { tokenHash },
    });
    if (!hint) return null;
    return credentialTransaction(this.dataSource, async (manager) => {
      const user = await lockCredentialUser(manager, hint.userId);
      if (!user) return null;
      await lockUserSessions(manager, user.id);
      await manager.query(
        'SELECT id FROM password_reset_token WHERE user_id = $1 ORDER BY id FOR UPDATE',
        [user.id],
      );
      const now = await credentialTime(manager);
      const result = await manager
        .createQueryBuilder()
        .update(PasswordResetToken)
        .set({ usedAt: now })
        .where('token_hash = :tokenHash', { tokenHash })
        .andWhere('user_id = :userId', { userId: user.id })
        .andWhere('used_at IS NULL')
        .andWhere('invalidated_at IS NULL')
        .andWhere('expires_at > :now', { now })
        .execute();
      if (result.affected !== 1) return null;
      await this.changeCredentials(manager, user, passwordHash, now);
      return user.id;
    });
  }

  async changeAuthenticatedPassword(
    userId: string,
    sessionId: string,
    expectedPasswordHash: string,
    passwordHash: string,
  ): Promise<void> {
    const failure = await credentialTransaction(
      this.dataSource,
      async (manager): Promise<SessionFailure | null> => {
        const user = await lockCredentialUser(manager, userId);
        if (!user || user.senhaHash !== expectedPasswordHash)
          return 'AUTH_INVALID_SESSION';
        await lockUserSessions(manager, userId);
        const session = await manager.findOne(AuthSession, {
          where: { id: sessionId, userId },
          lock: { mode: 'pessimistic_write' },
        });
        await manager.query(
          'SELECT id FROM password_reset_token WHERE user_id = $1 ORDER BY id FOR UPDATE',
          [userId],
        );
        const now = await credentialTime(manager);
        const invalid = sessionFailure(session, userId, now);
        if (invalid) {
          await persistSessionFailure(manager, session, userId, now, invalid);
          return invalid;
        }
        await this.changeCredentials(manager, user, passwordHash, now);
        return null;
      },
    );
    if (failure) rejectSession(failure);
  }

  private async changeCredentials(
    manager: EntityManager,
    user: Pick<User, 'id' | 'email'>,
    passwordHash: string,
    now: Date,
  ): Promise<void> {
    const userId = user.id;
    const updated = await manager.update(
      User,
      { id: userId },
      { senhaHash: passwordHash },
    );
    if (updated.affected !== 1)
      throw new AppUnauthorizedException(
        'AUTH_INVALID_SESSION',
        'Sessao invalida',
      );
    await manager
      .createQueryBuilder()
      .update(PasswordResetToken)
      .set({ invalidatedAt: now })
      .where('user_id = :userId', { userId })
      .andWhere('used_at IS NULL')
      .andWhere('invalidated_at IS NULL')
      .execute();
    await manager.update(
      AuthSession,
      { userId, revokedAt: IsNull() },
      { revokedAt: now, updatedAt: now },
    );
    await manager.insert(PasswordChangedOutbox, {
      id: randomUUID(),
      recipient: user.email,
      occurredAt: now,
    });
  }
}
