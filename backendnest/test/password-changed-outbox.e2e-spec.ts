import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { AuthSession } from '../src/auth/entities/auth-session.entity';
import { PasswordResetToken } from '../src/auth/entities/password-reset-token.entity';
import { PasswordChangedOutbox } from '../src/auth/entities/password-changed-outbox.entity';
import { PasswordResetTokenRepository } from '../src/auth/repositories/password-reset-token.repository';
import { PasswordChangedOutboxRepository } from '../src/auth/notifications/password-changed-outbox.repository';
import { PasswordChangedWorker } from '../src/auth/notifications/password-changed.worker';
import * as resend from '../src/auth/notifications/resend-password-changed';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';

jest.setTimeout(30000);
describe('password-change durable outbox (isolated PostgreSQL, no external I/O)', () => {
  let source: DataSource;
  let credentials: PasswordResetTokenRepository;
  let outbox: PasswordChangedOutboxRepository;
  let user: User;
  let sessionId: string;
  let tokenHash: string;
  let fetchSpy: jest.SpyInstance;
  beforeAll(async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('External I/O forbidden in E2E'));
    const config = configureE2eEnvironment();
    await prepareE2eDatabase(config);
    source = new DataSource({
      type: 'postgres',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      synchronize: false,
      logging: false,
      entities: [User, AuthSession, PasswordResetToken, PasswordChangedOutbox],
      extra: { max: 8 },
    });
    await source.initialize();
    credentials = new PasswordResetTokenRepository(
      source.getRepository(PasswordResetToken),
      source,
    );
    outbox = new PasswordChangedOutboxRepository(source);
  });
  beforeEach(async () => {
    await source.query('DELETE FROM password_changed_outbox');
    user = await source.getRepository(User).save({
      id: randomUUID(),
      nome: 'Outbox test',
      email: `${randomUUID()}@example.com`,
      senhaHash: 'old-hash',
    });
    sessionId = randomUUID();
    tokenHash = randomUUID().replace(/-/g, '').repeat(2);
    await source.getRepository(AuthSession).save({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: 'refresh-hash',
      revokedAt: null,
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      authenticatedAt: new Date(Date.now() - 1000),
      lastActivityAt: new Date(Date.now() - 1000),
      absoluteExpiresAt: new Date(Date.now() + 43200000),
      refreshExpiresAt: new Date(Date.now() + 60000),
      idleTimeoutSeconds: 900,
      policyVersion: 1,
    });
    await source.getRepository(PasswordResetToken).save({
      id: randomUUID(),
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60000),
      usedAt: null,
      invalidatedAt: null,
    });
  });
  afterEach(() => {
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
    fetchSpy?.mockRestore();
  });
  async function queued() {
    await credentials.changeAuthenticatedPassword(
      user.id,
      sessionId,
      'old-hash',
      'new-hash',
    );
    return source
      .getRepository(PasswordChangedOutbox)
      .findOneByOrFail({ recipient: user.email });
  }
  function worker() {
    const reader = {
      get: (key: string) =>
        ({ NODE_ENV: 'test', PASSWORD_CHANGED_WORKER_ENABLED: 'true' })[key],
    } as ConfigService;
    return new PasswordChangedWorker(reader, outbox);
  }
  it.each(['token', 'authenticated'])(
    'commits one secret-free event with credentials (%s)',
    async (flow) => {
      if (flow === 'token')
        await credentials.consumeAndResetPassword(tokenHash, 'new-hash');
      else await queued();
      const events = await source.getRepository(PasswordChangedOutbox).find();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        recipient: user.email,
        state: 'pending',
        attempts: 0,
        payload: null,
      });
      expect(JSON.stringify(events)).not.toMatch(
        /old-hash|new-hash|refresh-hash/,
      );
      expect(
        (await source.getRepository(User).findOneByOrFail({ id: user.id }))
          .senhaHash,
      ).toBe('new-hash');
    },
  );
  it('does not enqueue for invalid token, stale credentials or revoked session', async () => {
    expect(
      await credentials.consumeAndResetPassword('f'.repeat(64), 'new-hash'),
    ).toBeNull();
    await expect(
      credentials.changeAuthenticatedPassword(
        user.id,
        sessionId,
        'stale-hash',
        'new-hash',
      ),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID_SESSION' });
    await source
      .getRepository(AuthSession)
      .update(sessionId, { revokedAt: new Date() });
    await expect(
      credentials.changeAuthenticatedPassword(
        user.id,
        sessionId,
        'old-hash',
        'new-hash',
      ),
    ).rejects.toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
    expect(await source.getRepository(PasswordChangedOutbox).count()).toBe(0);
  });
  it.each(['token', 'authenticated'])(
    'rolls back password, links and sessions if event insert fails (%s)',
    async (flow) => {
      await source.query(
        "CREATE FUNCTION outbox_insert_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected outbox failure'; END $$",
      );
      await source.query(
        'CREATE TRIGGER outbox_insert_fault BEFORE INSERT ON password_changed_outbox FOR EACH ROW EXECUTE FUNCTION outbox_insert_fault()',
      );
      try {
        const result =
          flow === 'token'
            ? credentials.consumeAndResetPassword(tokenHash, 'new-hash')
            : credentials.changeAuthenticatedPassword(
                user.id,
                sessionId,
                'old-hash',
                'new-hash',
              );
        await expect(result).rejects.toMatchObject({
          code: 'INTERNAL_SERVER_ERROR',
        });
      } finally {
        await source.query(
          'DROP TRIGGER outbox_insert_fault ON password_changed_outbox',
        );
        await source.query('DROP FUNCTION outbox_insert_fault()');
      }
      expect(
        (await source.getRepository(User).findOneByOrFail({ id: user.id }))
          .senhaHash,
      ).toBe('old-hash');
      expect(
        (
          await source
            .getRepository(AuthSession)
            .findOneByOrFail({ id: sessionId })
        ).revokedAt,
      ).toBeNull();
      expect(await source.getRepository(PasswordChangedOutbox).count()).toBe(0);
      const token = await source
        .getRepository(PasswordResetToken)
        .findOneByOrFail({ tokenHash });
      expect(token.usedAt).toBeNull();
      expect(token.invalidatedAt).toBeNull();
    },
  );
  it('keeps events invisible to delivery before transaction commit', async () => {
    const runner = source.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.manager.insert(PasswordChangedOutbox, {
        id: randomUUID(),
        recipient: user.email,
        occurredAt: new Date(),
      });
      expect(await source.getRepository(PasswordChangedOutbox).count()).toBe(0);
      expect(await outbox.claim('onboarding@resend.dev')).toBeNull();
      await runner.commitTransaction();
      expect(await source.getRepository(PasswordChangedOutbox).count()).toBe(1);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  });
  it('skips a row locked on another actual connection and claims separate events', async () => {
    const first = await queued();
    await source.getRepository(PasswordChangedOutbox).insert({
      id: randomUUID(),
      recipient: user.email,
      occurredAt: new Date(),
    });
    const locker = source.createQueryRunner();
    await locker.connect();
    await locker.startTransaction();
    try {
      await locker.query(
        'SELECT id FROM password_changed_outbox WHERE id = $1 FOR UPDATE',
        [first.id],
      );
      const second = await outbox.claim('onboarding@resend.dev');
      expect(second?.id).not.toBe(first.id);
      expect(second?.state).toBe('claimed');
      await locker.commitTransaction();
      const next = await outbox.claim('onboarding@resend.dev');
      expect(next?.id).toBe(first.id);
      expect(await outbox.claim('onboarding@resend.dev')).toBeNull();
    } finally {
      if (locker.isTransactionActive) await locker.rollbackTransaction();
      await locker.release();
    }
  });
  it('two workers never own the same leased event', async () => {
    await queued();
    await source.getRepository(PasswordChangedOutbox).insert({
      id: randomUUID(),
      recipient: user.email,
      occurredAt: new Date(),
    });
    const results = await Promise.allSettled([
      outbox.claim('onboarding@resend.dev'),
      new PasswordChangedOutboxRepository(source).claim(
        'onboarding@resend.dev',
      ),
    ]);
    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    const claims = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    expect(claims.every((event) => event?.state === 'claimed')).toBe(true);
    expect(new Set(claims.map((event) => event?.id)).size).toBe(2);
  });
  it('reclaims expired leases with the same payload and rejects old acknowledgements', async () => {
    const event = await queued();
    const first = await outbox.claim('onboarding@resend.dev');
    await source.query(
      "UPDATE password_changed_outbox SET lease_until = clock_timestamp() - INTERVAL '1 second' WHERE id = $1",
      [event.id],
    );
    const second = await outbox.claim('changed@example.com');
    expect(second?.payload).toBe(first?.payload);
    expect(second?.claimToken).not.toBe(first?.claimToken);
    expect(
      await outbox.settle(first!, {
        kind: 'accepted',
        code: 'ACCEPTED',
        providerId: 'old-provider',
      }),
    ).toBeNull();
    expect(
      await outbox.settle(second!, {
        kind: 'accepted',
        code: 'ACCEPTED',
        providerId: 'provider-1',
      }),
    ).toBe('delivered');
  });
  it('rejects same-token acknowledgement when its lease expires while waiting for the row lock', async () => {
    await queued();
    const claim = (await outbox.claim('onboarding@resend.dev'))!;
    const locker = source.createQueryRunner();
    const acknowledger = source.createQueryRunner();
    await locker.connect();
    await acknowledger.connect();
    await locker.startTransaction();
    const [{ pid }] = (await acknowledger.query(
      'SELECT pg_backend_pid() AS pid',
    )) as Array<{ pid: number }>;
    const trace: string[] = [];
    const originalQuery = acknowledger.query.bind(
      acknowledger,
    ) as typeof acknowledger.query;
    const querySpy = jest
      .spyOn(acknowledger, 'query')
      .mockImplementation((...args): Promise<unknown> => {
        trace.push(args[0]);
        return originalQuery(...args) as Promise<unknown>;
      });
    const bound = new PasswordChangedOutboxRepository({
      transaction: async <T>(work: (manager: EntityManager) => Promise<T>) => {
        await acknowledger.startTransaction();
        try {
          const result = await work(acknowledger.manager);
          await acknowledger.commitTransaction();
          return result;
        } catch (error) {
          await acknowledger.rollbackTransaction();
          throw error;
        }
      },
    } as DataSource);
    let acknowledgement: Promise<unknown> | undefined;
    try {
      await locker.query(
        'SELECT id FROM password_changed_outbox WHERE id = $1 FOR UPDATE',
        [claim.id],
      );
      acknowledgement = bound.settle(claim, {
        kind: 'accepted',
        code: 'ACCEPTED',
        providerId: 'simulated-provider',
      });
      // Observe PostgreSQL's actual blocking relation, not an assumed scheduling delay.
      void acknowledgement.catch(() => undefined);
      const deadline = Date.now() + 3000;
      let blocked = false;
      while (!blocked && Date.now() < deadline) {
        const [row] = await source.query<Array<{ blocked: boolean }>>(
          'SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked',
          [pid],
        );
        blocked = row.blocked;
      }
      expect(blocked).toBe(true);
      const lockIndex = trace.findIndex((sql) => /FOR UPDATE/.test(sql));
      expect(lockIndex).toBeGreaterThanOrEqual(0);
      expect(
        trace.some((sql) => /EXTRACT\(EPOCH FROM clock_timestamp/.test(sql)),
      ).toBe(false);
      await locker.query(
        'UPDATE password_changed_outbox SET lease_until = clock_timestamp() WHERE id = $1',
        [claim.id],
      );
      const before = await locker.manager.findOneByOrFail(
        PasswordChangedOutbox,
        { id: claim.id },
      );
      await locker.commitTransaction();
      expect(await acknowledgement).toBeNull();
      const after = await source
        .getRepository(PasswordChangedOutbox)
        .findOneByOrFail({ id: claim.id });
      expect(after).toEqual(before);
      expect(
        trace.findIndex((sql) =>
          /EXTRACT\(EPOCH FROM clock_timestamp/.test(sql),
        ),
      ).toBeGreaterThan(lockIndex);
      const reclaimed = await outbox.claim('changed@example.com');
      expect(reclaimed?.claimToken).not.toBe(claim.claimToken);
      expect(reclaimed?.payload).toBe(claim.payload);
    } finally {
      if (locker.isTransactionActive) await locker.rollbackTransaction();
      if (acknowledgement) await acknowledgement.catch(() => undefined);
      querySpy.mockRestore();
      if (acknowledger.isTransactionActive)
        await acknowledger.rollbackTransaction();
      await acknowledger.release();
      await locker.release();
    }
  });
  it('retries stable payload after provider acceptance and failed database acknowledgement', async () => {
    const event = await queued();
    const bodies: string[] = [];
    const send = jest
      .spyOn(resend, 'sendPasswordChanged')
      .mockImplementation((body) => {
        bodies.push(body);
        return Promise.resolve({
          kind: 'accepted',
          code: 'ACCEPTED',
          providerId: 'provider-1',
        });
      });
    const settle = jest
      .spyOn(outbox, 'settle')
      .mockRejectedValueOnce(new Error('injected acknowledgement failure'));
    try {
      await worker().runOnce();
      expect(
        (
          await source
            .getRepository(PasswordChangedOutbox)
            .findOneByOrFail({ id: event.id })
        ).state,
      ).toBe('claimed');
      await source.query(
        "UPDATE password_changed_outbox SET lease_until = clock_timestamp() - INTERVAL '1 second' WHERE id = $1",
        [event.id],
      );
      settle.mockRestore();
      await worker().runOnce();
      expect(bodies).toHaveLength(2);
      expect(bodies[0]).toBe(bodies[1]);
      expect(
        (
          await source
            .getRepository(PasswordChangedOutbox)
            .findOneByOrFail({ id: event.id })
        ).state,
      ).toBe('delivered');
    } finally {
      send.mockRestore();
      settle.mockRestore();
    }
  });
  it('persists across worker restart, schedules retries and halts at attempt/window bounds', async () => {
    const event = await queued();
    const first = await outbox.claim('onboarding@resend.dev');
    expect(
      await outbox.settle(first!, {
        kind: 'retry',
        code: 'NETWORK_OR_TIMEOUT',
        retryAfterMs: 600000,
      }),
    ).toBe('pending');
    expect(
      await new PasswordChangedOutboxRepository(source).claim(
        'onboarding@resend.dev',
      ),
    ).toBeNull();
    await source.query(
      'UPDATE password_changed_outbox SET next_attempt_at = clock_timestamp(), attempts = 5 WHERE id = $1',
      [event.id],
    );
    expect(await outbox.claim('onboarding@resend.dev')).toMatchObject({
      state: 'reconciliation',
    });
    await source.query(
      "UPDATE password_changed_outbox SET state = 'pending', attempts = 1, first_attempt_at = clock_timestamp() - INTERVAL '23 hours' WHERE id = $1",
      [event.id],
    );
    expect(await outbox.claim('onboarding@resend.dev')).toMatchObject({
      state: 'reconciliation',
    });
  });
  it('disabled worker leaves events pending and enabled development worker only simulates', async () => {
    const event = await queued();
    const disabled = new PasswordChangedWorker(
      { get: () => undefined } as unknown as ConfigService,
      outbox,
    );
    disabled.onModuleInit();
    await disabled.runOnce();
    await disabled.onModuleDestroy();
    expect(
      (
        await source
          .getRepository(PasswordChangedOutbox)
          .findOneByOrFail({ id: event.id })
      ).state,
    ).toBe('pending');
    await worker().runOnce();
    expect(
      (
        await source
          .getRepository(PasswordChangedOutbox)
          .findOneByOrFail({ id: event.id })
      ).state,
    ).toBe('simulated');
  });
  it('purges only delivered/simulated events beyond seven days, never unresolved decisions', async () => {
    const event = await queued();
    await worker().runOnce();
    await source.query(
      "UPDATE password_changed_outbox SET completed_at = clock_timestamp() - INTERVAL '8 days' WHERE id = $1",
      [event.id],
    );
    await source.getRepository(PasswordChangedOutbox).insert({
      id: randomUUID(),
      recipient: user.email,
      occurredAt: new Date(),
      state: 'reconciliation',
      completedAt: new Date(0),
    });
    await outbox.purgeDelivered();
    expect(
      await source
        .getRepository(PasswordChangedOutbox)
        .findOneBy({ id: event.id }),
    ).toBeNull();
    expect(
      await source
        .getRepository(PasswordChangedOutbox)
        .countBy({ state: 'reconciliation' }),
    ).toBe(1);
  });
});
