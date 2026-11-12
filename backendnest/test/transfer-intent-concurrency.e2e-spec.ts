import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { combine } from './e2e-runtime.cjs';
import { registerAndLoginTestUser } from './helpers/auth.e2e-helper';
import { createConta } from './helpers/financial-scenario.helper';
import { numberValue, sqlRows } from './session-harness/json-boundary';

jest.setTimeout(30000);

describe('transfer intent SQL uniqueness (migrated disposable database)', () => {
  let app: E2eApplication | undefined;
  let source: DataSource;
  let fixtureUserId: string | undefined;

  beforeAll(async () => {
    const config = configureE2eEnvironment();
    await prepareE2eDatabase(config);
    app = await createE2eApp();
    source = app.get(DataSource);
  });

  afterAll(async () => {
    const errors: unknown[] = [];
    try {
      if (fixtureUserId) {
        await source.query('DELETE FROM transferencia WHERE usuario_id = $1', [
          fixtureUserId,
        ]);
        await source.query('DELETE FROM usuario WHERE id = $1', [
          fixtureUserId,
        ]);
      }
    } catch (error) {
      errors.push(error);
    }
    try {
      await app?.close();
    } catch (error) {
      errors.push(error);
    }
    const error = combine(
      undefined,
      errors,
      'Uniqueness fixture cleanup failed',
    );
    if (error)
      throw error instanceof Error
        ? error
        : new Error('Uniqueness fixture cleanup failed', { cause: error });
  });

  it('allows exactly one INSERT for the same user/key across two blocked transactions', async () => {
    if (!app) throw new Error('E2E application was not initialized');
    const session = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'transfer-uniqueness@example.test',
      nome: 'Transfer uniqueness',
    });
    fixtureUserId = session.userId;
    const origin = await createConta(app, session, {
      nome: 'Uniqueness origin',
    });
    const destination = await createConta(app, session, {
      nome: 'Uniqueness destination',
    });
    const first = source.createQueryRunner();
    const second = source.createQueryRunner();
    const key = randomUUID();
    const winnerId = randomUUID();
    const loserId = randomUUID();
    const sql = `INSERT INTO transferencia
      (id, usuario_id, conta_origem_id, conta_destino_id, valor, data, comissao, idempotency_key, idempotency_fingerprint)
      VALUES ($1, $2, $3, $4, 1, CURRENT_DATE, 0, $5, $6)
      ON CONFLICT (usuario_id, idempotency_key) DO NOTHING RETURNING id`;
    const args = [
      session.userId,
      origin.id,
      destination.id,
      key,
      'a'.repeat(64),
    ];
    let pending: Promise<{ rows: unknown } | { error: unknown }> | undefined;
    let primary: unknown;
    const errors: unknown[] = [];
    try {
      await first.startTransaction();
      await second.startTransaction();
      for (const runner of [first, second]) {
        await runner.query(`SET LOCAL lock_timeout = '10s'`);
        await runner.query(`SET LOCAL statement_timeout = '12s'`);
      }
      const [firstBackend] = await sqlRows(
        first,
        'SELECT pg_backend_pid() AS pid',
      );
      const [secondBackend] = await sqlRows(
        second,
        'SELECT pg_backend_pid() AS pid',
      );
      const firstPid = numberValue(firstBackend.pid);
      const secondPid = numberValue(secondBackend.pid);
      expect(secondPid).not.toBe(firstPid);
      const winner: unknown = await first.query(sql, [winnerId, ...args]);
      // Attach both handlers before polling so a timeout cannot reject unobserved.
      pending = second.query(sql, [loserId, ...args]).then(
        (rows: unknown) => ({ rows }),
        (error: unknown) => ({ error }),
      );
      let blocked = false;
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const [activity] = await source.query<Array<{ blocked: boolean }>>(
          `SELECT wait_event_type = 'Lock'
             AND $1::integer = ANY(pg_blocking_pids(pid)) AS blocked
           FROM pg_stat_activity WHERE pid = $2`,
          [firstPid, secondPid],
        );
        if (activity?.blocked) {
          blocked = true;
          break;
        }
        await delay(25);
      }
      expect(blocked).toBe(true);
      await first.commitTransaction();
      const result = await pending;
      if ('error' in result) throw result.error;
      expect(winner).toEqual([{ id: winnerId }]);
      expect(result.rows).toEqual([]);
      await second.commitTransaction();
      const stored = await source.query<Array<{ id: string }>>(
        'SELECT id FROM transferencia WHERE usuario_id = $1 AND idempotency_key = $2',
        [session.userId, key],
      );
      expect(stored).toEqual([{ id: winnerId }]);
    } catch (error) {
      primary = error;
    } finally {
      const cleanup = async (action: () => Promise<unknown>) => {
        try {
          await action();
        } catch (error) {
          errors.push(error);
        }
      };
      // Release the winner's lock before draining/rolling back the contender.
      if (first.isTransactionActive)
        await cleanup(() => first.rollbackTransaction());
      if (pending) {
        const result = await pending;
        if ('error' in result) errors.push(result.error);
      }
      if (second.isTransactionActive)
        await cleanup(() => second.rollbackTransaction());
      await cleanup(() => first.release());
      await cleanup(() => second.release());
      await cleanup(() =>
        source.query(
          'DELETE FROM transferencia WHERE usuario_id = $1 AND idempotency_key = $2',
          [session.userId, key],
        ),
      );
    }
    const error = combine(
      primary,
      errors,
      'Transfer uniqueness cleanup failed',
    );
    if (error)
      throw error instanceof Error
        ? error
        : new Error('Transfer uniqueness cleanup failed', { cause: error });
  });
});
