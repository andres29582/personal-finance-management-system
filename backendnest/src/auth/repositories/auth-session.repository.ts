import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import {
  AppUnauthorizedException,
  BusinessRuleException,
} from '../../common/exceptions';
import { AppException } from '../../common/exceptions/app.exception';
import {
  OwnSession,
  OwnSessionPage,
  SessionListOptions,
  encodeSessionCursor,
} from '../dto/session-management.dto';
import {
  credentialTime,
  credentialTransaction,
  lockCredentialUser,
} from './credential-lock';
import { BaseRepository } from '../../common/abstract/base.repository';
import { AuthSession } from '../entities/auth-session.entity';
import {
  rejectSession,
  sessionFailure,
  sessionState,
  SessionPolicy,
  SessionState,
  SessionFailure,
} from '../session-policy';

export type IssuedSessionTokens = {
  access_token: string;
  refresh_token: string;
  expiresAt: Date;
  refreshTokenHash: string;
};
export type SessionIssuer = (
  now: Date,
  absolute: Date,
) => Promise<IssuedSessionTokens>;
export async function lockUserSessions(
  manager: EntityManager,
  userId: string,
): Promise<AuthSession[]> {
  const ids = await manager.query<Array<{ id: string }>>(
    'SELECT id FROM auth_session WHERE usuario_id = $1 AND revoked_at IS NULL ORDER BY id FOR UPDATE',
    [userId],
  );
  return ids.length
    ? manager.find(AuthSession, {
        where: { id: In(ids.map((row) => row.id)), userId },
        order: { id: 'ASC' },
      })
    : [];
}
export async function persistSessionFailure(
  manager: EntityManager,
  session: AuthSession | null,
  userId: string,
  now: Date,
  failure: SessionFailure,
): Promise<void> {
  if (session && session.userId === userId && !session.revokedAt) {
    const result = await manager.update(
      AuthSession,
      { id: session.id, userId, revokedAt: IsNull() },
      { revokedAt: now, updatedAt: now, terminalReason: failure },
    );
    if (result.affected !== 1) throw new Error('Session invalidation failed.');
  }
}
@Injectable()
export class AuthSessionRepository extends BaseRepository<AuthSession> {
  constructor(
    @InjectRepository(AuthSession)
    private readonly authSessionRepository: Repository<AuthSession>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super(authSessionRepository);
  }

  async listOwnSessions(
    userId: string,
    callerId: string,
    options: SessionListOptions,
  ): Promise<OwnSessionPage> {
    const decision = await credentialTransaction(
      this.dataSource,
      async (manager) => {
        if (!(await lockCredentialUser(manager, userId)))
          return { failure: 'AUTH_INVALID_SESSION' as SessionFailure };
        const caller = await manager.findOne(AuthSession, {
          where: { id: callerId, userId },
          lock: { mode: 'pessimistic_write' },
        });
        const now = await credentialTime(manager);
        const failure = sessionFailure(caller, userId, now);
        if (failure) {
          await persistSessionFailure(manager, caller, userId, now, failure);
          return { failure };
        }
        // Keep SQL timestamps at microsecond precision for stable keyset cursors.
        const rows = await manager.query<OwnSession[]>(
          `
        SELECT id, (id = $2::uuid) AS "isCurrent",
          to_char(authenticated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "authenticatedAt",
          to_char(last_activity_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "lastActivityAt",
          to_char(LEAST(last_activity_at + idle_timeout_seconds * interval '1 second', absolute_expires_at, refresh_expires_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "idleExpiresAt",
          to_char(absolute_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "absoluteExpiresAt",
          NULL AS "clientDescription"
        FROM auth_session WHERE usuario_id = $1 AND revoked_at IS NULL AND policy_version = 1
          AND idle_timeout_seconds >= 1
          AND isfinite(authenticated_at) AND isfinite(last_activity_at)
          AND isfinite(absolute_expires_at) AND isfinite(refresh_expires_at)
          AND authenticated_at <= $3::timestamptz AND last_activity_at >= authenticated_at
          AND last_activity_at <= $3::timestamptz AND absolute_expires_at > authenticated_at
          AND absolute_expires_at > $3::timestamptz AND refresh_expires_at > $3::timestamptz
          AND last_activity_at + idle_timeout_seconds * interval '1 second' > $3::timestamptz
          AND ($4::timestamptz IS NULL OR (authenticated_at, id) < ($4::timestamptz, $5::uuid))
        ORDER BY authenticated_at DESC, id DESC LIMIT $6`,
          [
            userId,
            callerId,
            now.toISOString(),
            options.cursor?.authenticatedAt ?? null,
            options.cursor?.id ?? null,
            options.limit + 1,
          ],
        );
        const items = rows.slice(0, options.limit);
        return {
          page: {
            items,
            nextCursor:
              rows.length > options.limit
                ? encodeSessionCursor(items.at(-1)!)
                : null,
            serverNow: now.toISOString(),
          },
        };
      },
    );
    if (decision.failure) rejectSession(decision.failure);
    return decision.page!;
  }

  async reserveSessionReauthentication(
    userId: string,
    callerId: string,
  ): Promise<string> {
    const decision = await credentialTransaction(
      this.dataSource,
      async (manager) => {
        const user = await lockCredentialUser(manager, userId);
        if (!user) return { failure: 'AUTH_INVALID_SESSION' as SessionFailure };
        const caller = await manager.findOne(AuthSession, {
          where: { id: callerId, userId },
          lock: { mode: 'pessimistic_write' },
        });
        const now = await credentialTime(manager);
        const failure = sessionFailure(caller, userId, now);
        if (failure) {
          await persistSessionFailure(manager, caller, userId, now, failure);
          return { failure };
        }
        const reserved = await manager.query<Array<{ attempts: number }>>(
          `
        INSERT INTO auth_session_reauthentication (usuario_id, window_started_at, attempts) VALUES ($1, $2::timestamptz, 1)
        ON CONFLICT (usuario_id) DO UPDATE SET
          window_started_at = CASE WHEN auth_session_reauthentication.window_started_at + interval '60 seconds' <= $2::timestamptz THEN $2::timestamptz ELSE auth_session_reauthentication.window_started_at END,
          attempts = CASE WHEN auth_session_reauthentication.window_started_at + interval '60 seconds' <= $2::timestamptz THEN 1 ELSE auth_session_reauthentication.attempts + 1 END
        WHERE auth_session_reauthentication.window_started_at + interval '60 seconds' <= $2::timestamptz OR auth_session_reauthentication.attempts < 5
        RETURNING attempts`,
          [userId, now.toISOString()],
        );
        return reserved.length ? { hash: user.senhaHash } : { limited: true };
      },
    );
    if (decision.failure) rejectSession(decision.failure);
    if (decision.limited) {
      class LimitException extends AppException {}
      throw new LimitException(
        'AUTH_REAUTHENTICATION_LIMIT',
        'Limite temporario de confirmacoes. Tente novamente em um minuto.',
        429,
      );
    }
    return decision.hash!;
  }

  async revokeOwnSessions(
    userId: string,
    callerId: string,
    expectedPasswordHash: string,
    targetId?: string,
  ): Promise<void> {
    const decision = await credentialTransaction(
      this.dataSource,
      async (manager) => {
        const user = await lockCredentialUser(manager, userId);
        if (!user) return { failure: 'AUTH_INVALID_SESSION' as SessionFailure };
        const ids = await manager.query<Array<{ id: string }>>(
          `
        SELECT id FROM auth_session WHERE usuario_id = $1
          AND ${targetId === undefined ? '(revoked_at IS NULL OR id = $2::uuid)' : 'id = ANY($2::uuid[])'}
        ORDER BY id FOR UPDATE`,
          [userId, targetId === undefined ? callerId : [callerId, targetId]],
        );
        const sessions = ids.length
          ? await manager.find(AuthSession, {
              where: { userId, id: In(ids.map((row) => row.id)) },
              order: { id: 'ASC' },
            })
          : [];
        const now = await credentialTime(manager);
        const caller = sessions.find((row) => row.id === callerId) ?? null;
        const failure = sessionFailure(caller, userId, now);
        if (failure) {
          await persistSessionFailure(manager, caller, userId, now, failure);
          return { failure };
        }
        if (user.senhaHash !== expectedPasswordHash)
          return { passwordChanged: true };
        for (const session of sessions) {
          if (targetId === undefined || session.id === targetId)
            await persistSessionFailure(
              manager,
              session,
              userId,
              now,
              'AUTH_SESSION_REVOKED',
            );
        }
        return {};
      },
    );
    if (decision.failure) rejectSession(decision.failure);
    if (decision.passwordChanged)
      throw new BusinessRuleException(
        'AUTH_CURRENT_PASSWORD_INVALID',
        'Senha atual incorreta.',
        { field: 'senhaAtual' },
      );
  }

  async createSession(session: {
    id: string;
    userId: string;
    expectedPasswordHash: string;
    maxActiveSessions: number;
    policy: SessionPolicy;
    issue: SessionIssuer;
  }): Promise<IssuedSessionTokens> {
    return credentialTransaction(this.dataSource, async (manager) => {
      const user = await lockCredentialUser(manager, session.userId);
      if (!user || user.senhaHash !== session.expectedPasswordHash)
        throw new AppUnauthorizedException(
          'AUTH_INVALID_CREDENTIALS',
          'E-mail ou senha invalidos',
        );
      const candidates = await lockUserSessions(manager, session.userId);
      const now = await credentialTime(manager);
      const active: AuthSession[] = [];
      for (const candidate of candidates) {
        const failure = sessionFailure(candidate, session.userId, now);
        if (failure)
          await persistSessionFailure(
            manager,
            candidate,
            session.userId,
            now,
            failure,
          );
        else active.push(candidate);
      }
      active.sort(
        (a, b) =>
          a.authenticatedAt!.getTime() - b.authenticatedAt!.getTime() ||
          a.id.localeCompare(b.id),
      );
      for (const old of active.slice(
        0,
        Math.max(0, active.length - session.maxActiveSessions + 1),
      ))
        await persistSessionFailure(
          manager,
          old,
          session.userId,
          now,
          'AUTH_SESSION_REVOKED',
        );
      const absolute = new Date(
        now.getTime() + session.policy.absoluteSeconds * 1000,
      );
      const issued = await session.issue(now, absolute);
      if (
        issued.expiresAt.getTime() <= now.getTime() ||
        issued.expiresAt.getTime() > absolute.getTime()
      )
        throw new Error('Invalid refresh deadline.');
      await manager.save(
        AuthSession,
        manager.create(AuthSession, {
          id: session.id,
          userId: session.userId,
          refreshTokenHash: issued.refreshTokenHash,
          expiresAt: issued.expiresAt,
          refreshExpiresAt: issued.expiresAt,
          authenticatedAt: now,
          absoluteExpiresAt: absolute,
          lastActivityAt: now,
          idleTimeoutSeconds: session.policy.idleSeconds,
          policyVersion: session.policy.version,
          revokedAt: null,
          terminalReason: null,
          lastUsedAt: now,
          createdAt: now,
          updatedAt: now,
        }),
      );
      return issued;
    });
  }
  // Lookup is only a hint; it never authorizes a request.
  async findActiveById(sessionId: string): Promise<AuthSession | null> {
    return this.authSessionRepository.findOne({
      where: { id: sessionId, revokedAt: IsNull() },
    });
  }
  async authorize(
    sessionId: string,
    userId: string,
    activity: boolean,
  ): Promise<SessionState> {
    const decision = await credentialTransaction(
      this.dataSource,
      async (manager) => {
        if (!(await lockCredentialUser(manager, userId)))
          return { failure: 'AUTH_INVALID_SESSION' as SessionFailure };
        const session = await manager.findOne(AuthSession, {
          where: { id: sessionId, userId },
          lock: { mode: 'pessimistic_write' },
        });
        const now = await credentialTime(manager);
        const failure = sessionFailure(session, userId, now);
        if (failure) {
          await persistSessionFailure(manager, session, userId, now, failure);
          return { failure };
        }
        if (activity) {
          const result = await manager.update(
            AuthSession,
            { id: sessionId, userId, revokedAt: IsNull() },
            { lastActivityAt: now, lastUsedAt: now, updatedAt: now },
          );
          if (result.affected !== 1) throw new Error('Session touch failed.');
          session!.lastActivityAt = now;
        }
        return { state: sessionState(session!, now) };
      },
    );
    if (decision.failure) rejectSession(decision.failure);
    return decision.state!;
  }
  async touchIfActive(
    sessionId: string,
    userId: string,
  ): Promise<SessionState> {
    return this.authorize(sessionId, userId, true);
  }
  async rotateIfActiveWithMatchingToken(
    sessionId: string,
    userId: string,
    currentRefreshTokenHash: string,
    issue: SessionIssuer,
  ): Promise<
    | { tokens: IssuedSessionTokens }
    | {
        failure: SessionFailure | 'AUTH_INVALID_REFRESH_TOKEN';
        reuse?: boolean;
      }
  > {
    return credentialTransaction(this.dataSource, async (manager) => {
      if (!(await lockCredentialUser(manager, userId)))
        return { failure: 'AUTH_INVALID_SESSION' };
      const session = await manager.findOne(AuthSession, {
        where: { id: sessionId, userId },
        lock: { mode: 'pessimistic_write' },
      });
      const now = await credentialTime(manager);
      const failure = sessionFailure(session, userId, now);
      if (failure) {
        await persistSessionFailure(manager, session, userId, now, failure);
        return { failure };
      }
      if (session!.refreshTokenHash !== currentRefreshTokenHash) {
        await persistSessionFailure(
          manager,
          session,
          userId,
          now,
          'AUTH_SESSION_REVOKED',
        );
        return { failure: 'AUTH_INVALID_REFRESH_TOKEN', reuse: true };
      }
      const tokens = await issue(
        now,
        new Date(
          Math.min(
            session!.absoluteExpiresAt!.getTime(),
            session!.refreshExpiresAt!.getTime(),
          ),
        ),
      );
      // Rotation cannot increase either the refresh or the absolute authority deadline.
      const expiresAt = new Date(
        Math.min(
          tokens.expiresAt.getTime(),
          session!.refreshExpiresAt!.getTime(),
        ),
      );
      if (
        tokens.expiresAt.getTime() > session!.absoluteExpiresAt!.getTime() ||
        expiresAt.getTime() <= now.getTime()
      )
        throw new Error('Invalid refresh deadline.');
      const result = await manager.update(
        AuthSession,
        {
          id: sessionId,
          userId,
          refreshTokenHash: currentRefreshTokenHash,
          revokedAt: IsNull(),
        },
        {
          refreshTokenHash: tokens.refreshTokenHash,
          expiresAt,
          refreshExpiresAt: expiresAt,
          updatedAt: now,
        },
      );
      if (result.affected !== 1) throw new Error('Session rotation failed.');
      return { tokens };
    });
  }
  async revoke(
    sessionId: string,
    userId: string,
    _revokedAt?: Date,
  ): Promise<void> {
    await credentialTransaction(this.dataSource, async (manager) => {
      if (!(await lockCredentialUser(manager, userId))) return;
      const session = await manager.findOne(AuthSession, {
        where: { id: sessionId, userId },
        lock: { mode: 'pessimistic_write' },
      });
      const now = await credentialTime(manager);
      await persistSessionFailure(
        manager,
        session,
        userId,
        now,
        'AUTH_SESSION_REVOKED',
      );
    });
  }
  async revokeAllByUser(userId: string, _revokedAt?: Date): Promise<void> {
    await credentialTransaction(this.dataSource, async (manager) => {
      if (!(await lockCredentialUser(manager, userId))) return;
      const sessions = await lockUserSessions(manager, userId);
      const now = await credentialTime(manager);
      for (const session of sessions)
        await persistSessionFailure(
          manager,
          session,
          userId,
          now,
          'AUTH_SESSION_REVOKED',
        );
    });
  }
}
