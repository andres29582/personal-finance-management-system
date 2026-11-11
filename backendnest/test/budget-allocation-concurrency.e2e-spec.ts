import request from 'supertest';
import { DataSource } from 'typeorm';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import {
  registerAndLoginTestUser,
  withAuth,
  type E2eAuthSession,
} from './helpers/auth.e2e-helper';
import { unwrapSuccess } from './helpers/http.helper';
import {
  PostgresConcurrencyHarness,
  expectBlockedBy,
} from './helpers/postgres-concurrency.helper';

jest.setTimeout(60000);
describe('Budget allocation serialization (real PostgreSQL)', () => {
  let app: E2eApplication;
  let db: DataSource;
  let harness: PostgresConcurrencyHarness;
  let session: E2eAuthSession;
  const api = (method: 'post' | 'patch', path: string) =>
    withAuth(request(app.getHttpServer())[method](path), session);
  beforeAll(async () => {
    await prepareE2eDatabase(configureE2eEnvironment());
    app = await createE2eApp();
    db = app.get(DataSource);
    harness = new PostgresConcurrencyHarness(db);
    session = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'budget-serialization@example.com',
      nome: 'Budget serialization',
    });
  });
  afterEach(async () => {
    await harness?.cleanupAll();
  });
  afterAll(async () => {
    await app?.close();
  });

  it.each(['allocation', 'reduction'] as const)(
    'serializes %s against another allocation without exceeding the cap',
    async (mode) => {
      const budget = unwrapSuccess<{ id: string }>(
        await api('post', '/orcamentos')
          .send({
            mesReferencia: mode === 'allocation' ? '2099-06' : '2099-07',
            valorPlanejado: 0.3,
          })
          .expect(201),
      );
      const cats: string[] = [];
      for (const suffix of ['A', 'B'])
        cats.push(
          unwrapSuccess<{ id: string }>(
            await api('post', '/categorias')
              .send({ nome: `${mode} ${suffix}`, tipo: 'despesa' })
              .expect(201),
          ).id,
        );
      const barrier = await harness.installBarrier({
        holder: `budget-${mode}`,
        table: mode === 'allocation' ? 'orcamento_categoria' : 'orcamento',
        triggerEvent:
          mode === 'allocation'
            ? `BEFORE INSERT ON orcamento_categoria FOR EACH ROW WHEN (NEW.orcamento_id = '${budget.id}'::uuid)`
            : `BEFORE UPDATE ON orcamento FOR EACH ROW WHEN (NEW.id = '${budget.id}'::uuid)`,
      });
      try {
        const first = harness.trackRequest(
          barrier,
          mode === 'allocation'
            ? api('post', `/orcamentos/${budget.id}/categorias`).send({
                categoriaId: cats[0],
                valorPlanejado: 0.2,
              })
            : api('patch', `/orcamentos/${budget.id}`).send({
                valorPlanejado: 0.1,
              }),
        );
        const holder = await harness.waitForTaggedHolder(barrier);
        const second = harness.trackRequest(
          barrier,
          api('post', `/orcamentos/${budget.id}/categorias`).send({
            categoriaId: cats[1],
            valorPlanejado: 0.2,
          }),
        );
        const waiter = await harness.waitForBlockedActivity(
          barrier,
          holder.pid,
          (activity) =>
            activity.query.includes('FOR UPDATE') &&
            activity.query.includes('orcamento'),
        );
        expectBlockedBy(waiter, holder.pid);
        await harness.expectTaggedHolderStillBlocked(barrier, holder.pid);
        await harness.unlockBarrier(barrier);
        expect((await first).status).toBe(mode === 'allocation' ? 201 : 200);
        const loser = await second;
        expect(loser.status).toBe(400);
        expect(JSON.stringify(loser.body)).toContain(
          'ORCAMENTO_CATEGORIA_TOTAL_EXCEEDS_BUDGET',
        );
        const [persisted] = await db.query<
          Array<{ total: string; planned: string; count: number }>
        >(
          'SELECT COALESCE(SUM(c.valor_planejado),0)::text AS total, b.valor_planejado::text AS planned, COUNT(c.id)::int AS count FROM orcamento b LEFT JOIN orcamento_categoria c ON c.orcamento_id=b.id WHERE b.id=$1 GROUP BY b.id',
          [budget.id],
        );
        expect(persisted).toEqual(
          mode === 'allocation'
            ? { total: '0.20', planned: '0.30', count: 1 }
            : { total: '0', planned: '0.10', count: 0 },
        );
      } finally {
        await harness.cleanupBarrier(barrier);
      }
    },
  );
});
