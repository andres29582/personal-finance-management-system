import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

// Prepared only. Enable after approving a dedicated migrated test database and fixtures.
describe.skip('transfer intent SQL uniqueness (requires migration 0018)', () => {
  it('allows exactly one INSERT for the same user/key across two transactions', async () => {
    const url = process.env.RNF_TEST_DATABASE_URL;
    const fixtures = [
      process.env.RNF_TEST_USER_ID,
      process.env.RNF_TEST_SOURCE_ACCOUNT_ID,
      process.env.RNF_TEST_DESTINATION_ACCOUNT_ID,
    ];
    if (
      !url ||
      !/test/i.test(new URL(url).pathname) ||
      fixtures.some((value) => !value)
    ) {
      throw new Error(
        'A dedicated test database and existing owned account fixtures are required.',
      );
    }
    const source = await new DataSource({
      type: 'postgres',
      url,
      synchronize: false,
      logging: false,
    }).initialize();
    const first = source.createQueryRunner();
    const second = source.createQueryRunner();
    const key = randomUUID();
    const sql = `INSERT INTO transferencia
      (id, usuario_id, conta_origem_id, conta_destino_id, valor, data, comissao, idempotency_key, idempotency_fingerprint)
      VALUES ($1, $2, $3, $4, 1, CURRENT_DATE, 0, $5, $6)
      ON CONFLICT (usuario_id, idempotency_key) DO NOTHING RETURNING id`;
    try {
      await first.startTransaction();
      await second.startTransaction();
      const winner = await first.query(sql, [
        randomUUID(),
        ...fixtures,
        key,
        'a'.repeat(64),
      ]);
      const pending = second.query(sql, [
        randomUUID(),
        ...fixtures,
        key,
        'a'.repeat(64),
      ]);
      await first.commitTransaction();
      const loser = await pending;
      expect(winner).toHaveLength(1);
      expect(loser).toHaveLength(0);
      await second.rollbackTransaction();
    } finally {
      if (first.isTransactionActive) await first.rollbackTransaction();
      if (second.isTransactionActive) await second.rollbackTransaction();
      await source.query(
        'DELETE FROM transferencia WHERE usuario_id = $1 AND idempotency_key = $2',
        [fixtures[0], key],
      );
      await first.release();
      await second.release();
      await source.destroy();
    }
  });
});
