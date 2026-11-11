import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, MoreThan } from 'typeorm';
import {
  PasswordChangedOutbox,
  PasswordChangedState,
} from '../entities/password-changed-outbox.entity';
import {
  credentialTime,
  credentialTransaction,
} from '../repositories/credential-lock';
import {
  PASSWORD_CHANGED_LEASE_MS,
  PASSWORD_CHANGED_MAX_ATTEMPTS,
  PASSWORD_CHANGED_RETRY_WINDOW_MS,
} from './password-changed.config';
import {
  PasswordChangedDelivery,
  passwordChangedPayload,
} from './resend-password-changed';

@Injectable()
export class PasswordChangedOutboxRepository {
  constructor(private readonly source: DataSource) {}

  async claim(sender: string): Promise<PasswordChangedOutbox | null> {
    return credentialTransaction(this.source, async (manager) => {
      await manager.query(
        "SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '10s'",
      );
      const repository = manager.getRepository(PasswordChangedOutbox);
      const event = await repository
        .createQueryBuilder('event')
        .where(
          "(event.state = 'pending' AND event.next_attempt_at <= clock_timestamp()) OR (event.state = 'claimed' AND event.lease_until <= clock_timestamp())",
        )
        .orderBy('event.created_at', 'ASC')
        .addOrderBy('event.id', 'ASC')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .take(1)
        .getOne();
      if (!event) return null;
      const now = await credentialTime(manager);
      if (
        event.attempts >= PASSWORD_CHANGED_MAX_ATTEMPTS ||
        (event.firstAttemptAt &&
          now.getTime() - event.firstAttemptAt.getTime() >=
            PASSWORD_CHANGED_RETRY_WINDOW_MS)
      ) {
        return repository.save(
          Object.assign(event, {
            state: 'reconciliation',
            leaseUntil: null,
            claimToken: null,
            completedAt: now,
            lastSafeError: 'RETRY_WINDOW_OR_ATTEMPTS_EXHAUSTED',
          }),
        );
      }
      if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(event.recipient)) {
        return repository.save(
          Object.assign(event, {
            state: 'failed',
            leaseUntil: null,
            claimToken: null,
            completedAt: now,
            lastSafeError: 'INVALID_RECIPIENT',
          }),
        );
      }
      event.payload ??= passwordChangedPayload(
        sender,
        event.recipient,
        event.occurredAt,
      );
      event.firstAttemptAt ??= now;
      event.attempts++;
      event.state = 'claimed';
      event.claimToken = randomUUID();
      event.leaseUntil = new Date(now.getTime() + PASSWORD_CHANGED_LEASE_MS);
      return repository.save(event);
    });
  }

  async settle(
    event: PasswordChangedOutbox,
    outcome: PasswordChangedDelivery,
  ): Promise<PasswordChangedState | null> {
    if (!event.claimToken) return null;
    return credentialTransaction(this.source, async (manager) => {
      await manager.query(
        "SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '10s'",
      );
      const persisted = await manager.findOne(PasswordChangedOutbox, {
        where: { id: event.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !persisted ||
        persisted.state !== 'claimed' ||
        persisted.claimToken !== event.claimToken
      )
        return null;
      const now = await credentialTime(manager);
      if (
        !persisted.leaseUntil ||
        persisted.leaseUntil.getTime() <= now.getTime()
      )
        return null;
      let state: PasswordChangedState =
        outcome.kind === 'accepted'
          ? 'delivered'
          : outcome.kind === 'retry'
            ? 'pending'
            : outcome.kind;
      let code = outcome.code;
      const delay = Math.max(
        60_000 * 2 ** (persisted.attempts - 1),
        outcome.retryAfterMs ?? 0,
      );
      const nextAttemptAt = new Date(now.getTime() + delay);
      if (
        outcome.kind === 'retry' &&
        (persisted.attempts >= PASSWORD_CHANGED_MAX_ATTEMPTS ||
          !persisted.firstAttemptAt ||
          nextAttemptAt.getTime() - persisted.firstAttemptAt.getTime() >=
            PASSWORD_CHANGED_RETRY_WINDOW_MS)
      ) {
        state = 'reconciliation';
        code = 'RETRY_WINDOW_OR_ATTEMPTS_EXHAUSTED';
      }
      const result = await manager.update(
        PasswordChangedOutbox,
        {
          id: event.id,
          state: 'claimed',
          claimToken: event.claimToken,
          leaseUntil: MoreThan(now),
        },
        {
          state,
          nextAttemptAt,
          leaseUntil: null,
          claimToken: null,
          providerId: outcome.providerId ?? null,
          lastSafeError: state === 'delivered' ? null : code,
          completedAt: state === 'pending' ? null : now,
        },
      );
      return result.affected === 1 ? state : null;
    });
  }

  async purgeDelivered(): Promise<void> {
    // Retain idempotency history longer than the provider's 24-hour window.
    await credentialTransaction(this.source, async (manager) => {
      await manager.query(
        "SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '10s'",
      );
      await manager
        .createQueryBuilder()
        .delete()
        .from(PasswordChangedOutbox)
        .where(
          "state IN ('delivered', 'simulated') AND completed_at < clock_timestamp() - INTERVAL '7 days'",
        )
        .execute();
    });
  }
}
