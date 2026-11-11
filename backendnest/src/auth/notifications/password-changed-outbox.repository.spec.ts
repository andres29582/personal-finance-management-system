import { PasswordChangedOutboxRepository } from './password-changed-outbox.repository';
import { PasswordChangedOutbox } from '../entities/password-changed-outbox.entity';
import { PASSWORD_CHANGED_RETRY_WINDOW_MS } from './password-changed.config';

describe('password-change claim and acknowledgement policy', () => {
  const now = new Date('2026-10-06T12:00:00Z');
  function fixture(overrides: Partial<PasswordChangedOutbox> = {}) {
    const event = {
      id: 'event-1',
      recipient: 'user@example.com',
      occurredAt: now,
      attempts: 0,
      payload: null,
      firstAttemptAt: null,
      leaseUntil: new Date(now.getTime() + 60_000),
      state: 'pending',
      ...overrides,
    } as PasswordChangedOutbox;
    const query = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      setOnLocked: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(event),
    };
    const repository = {
      createQueryBuilder: () => query,
      save: jest.fn((value: PasswordChangedOutbox) => Promise.resolve(value)),
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue(event),
      getRepository: () => repository,
      query: jest.fn().mockResolvedValue([{ milliseconds: now.getTime() }]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const source = {
      transaction: (work: (value: typeof manager) => Promise<unknown>) =>
        work(manager),
    };
    return {
      outbox: new PasswordChangedOutboxRepository(source as never),
      event,
      query,
      manager,
    };
  }
  it('freezes payload and first-attempt clock under SKIP LOCKED claim', async () => {
    const { outbox, event, query } = fixture();
    await outbox.claim('onboarding@resend.dev');
    const frozen = event.payload;
    const firstTime = event.firstAttemptAt;
    await outbox.claim('different@example.com');
    expect(event.payload).toBe(frozen);
    expect(event.firstAttemptAt).toBe(firstTime);
    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(query.setOnLocked).toHaveBeenCalledWith('skip_locked');
    expect(query.take).toHaveBeenCalledWith(1);
    expect(event.attempts).toBe(2);
  });
  it('reads the authoritative clock only after the acknowledgement row lock', async () => {
    const { outbox, event, manager } = fixture({
      state: 'claimed',
      claimToken: 'claim-1',
      attempts: 1,
      firstAttemptAt: now,
    });
    let release!: (value: PasswordChangedOutbox) => void;
    manager.findOne.mockReturnValueOnce(
      new Promise((resolve) => (release = resolve)),
    );
    const acknowledgement = outbox.settle(event, {
      kind: 'accepted',
      code: 'ACCEPTED',
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(manager.findOne).toHaveBeenCalledWith(PasswordChangedOutbox, {
      where: { id: event.id },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.query.mock.calls.flat().join(' ')).not.toContain(
      'clock_timestamp',
    );
    release({ ...event, leaseUntil: new Date(now.getTime() - 1) });
    expect(await acknowledgement).toBeNull();
    expect(manager.update).not.toHaveBeenCalled();
  });
  it.each([
    { attempts: 5 },
    {
      attempts: 1,
      firstAttemptAt: new Date(
        now.getTime() - PASSWORD_CHANGED_RETRY_WINDOW_MS,
      ),
      payload: '{}',
    },
  ])(
    'never grants another send after finite attempt/window budget %p',
    async (overrides) => {
      const { outbox } = fixture(overrides);
      expect(await outbox.claim('onboarding@resend.dev')).toMatchObject({
        state: 'reconciliation',
        claimToken: null,
      });
    },
  );
  it('rejects stale acknowledgement with a lease-token and expiry CAS', async () => {
    const { outbox, event, manager } = fixture({
      attempts: 1,
      claimToken: 'claim-1',
      payload: '{}',
      firstAttemptAt: now,
      state: 'claimed',
    });
    manager.update.mockResolvedValueOnce({ affected: 0 });
    expect(
      await outbox.settle(event, {
        kind: 'accepted',
        code: 'ACCEPTED',
        providerId: 'provider-1',
      }),
    ).toBeNull();
    expect(manager.update).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        id: 'event-1',
        claimToken: 'claim-1',
        state: 'claimed',
        leaseUntil: expect.anything() as unknown,
      }),
      expect.any(Object),
    );
  });
  it('fails closed before database mutation if no claim token was supplied', async () => {
    const { outbox, event, manager } = fixture({ claimToken: null });
    expect(
      await outbox.settle(event, { kind: 'accepted', code: 'ACCEPTED' }),
    ).toBeNull();
    expect(manager.update).not.toHaveBeenCalled();
  });
  it.each([null, { state: 'pending' }, { claimToken: 'replacement' }])(
    'rejects a missing or changed persisted claim %p',
    async (change) => {
      const { outbox, event, manager } = fixture({
        state: 'claimed',
        claimToken: 'claim-1',
      });
      manager.findOne.mockResolvedValueOnce(
        change ? { ...event, ...change } : null,
      );
      expect(
        await outbox.settle(event, { kind: 'accepted', code: 'ACCEPTED' }),
      ).toBeNull();
      expect(manager.update).not.toHaveBeenCalled();
    },
  );
  it('derives retry limits from the locked row rather than the caller snapshot', async () => {
    const { outbox, event, manager } = fixture({
      state: 'claimed',
      claimToken: 'claim-1',
      attempts: 1,
      firstAttemptAt: now,
    });
    manager.findOne.mockResolvedValueOnce({ ...event, attempts: 5 });
    expect(
      await outbox.settle(event, { kind: 'retry', code: 'NETWORK_OR_TIMEOUT' }),
    ).toBe('reconciliation');
  });
  it('schedules finite retries and requires reconciliation on exhaustion', async () => {
    const { outbox, event, manager } = fixture({
      attempts: 4,
      state: 'claimed',
      claimToken: 'claim-1',
      payload: '{}',
      firstAttemptAt: now,
    });
    expect(
      await outbox.settle(event, {
        kind: 'retry',
        code: 'NETWORK_OR_TIMEOUT',
        retryAfterMs: 900000,
      }),
    ).toBe('pending');
    expect(manager.update).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.any(Object),
      expect.objectContaining({
        nextAttemptAt: new Date(now.getTime() + 900000),
      }),
    );
    event.attempts = 5;
    expect(
      await outbox.settle(event, { kind: 'retry', code: 'NETWORK_OR_TIMEOUT' }),
    ).toBe('reconciliation');
  });
  it('does not pretend acceptance was acknowledged if the database write fails', async () => {
    const { outbox, event, manager } = fixture({
      attempts: 1,
      claimToken: 'claim-1',
      payload: '{}',
      firstAttemptAt: now,
      state: 'claimed',
    });
    manager.update.mockRejectedValueOnce(new Error('private-db-payload'));
    await expect(
      outbox.settle(event, {
        kind: 'accepted',
        code: 'ACCEPTED',
        providerId: 'provider-1',
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Credential operation failed.',
    });
    expect(event.state).toBe('claimed');
  });
});
