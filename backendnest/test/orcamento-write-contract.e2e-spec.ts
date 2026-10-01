import request from 'supertest';
import { DataSource } from 'typeorm';
import { AuditLog } from '../src/logs/entities/audit-log.entity';
import { Orcamento } from '../src/orcamentos/entities/orcamento.entity';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import {
  registerAndLoginTestUser,
  withAuth,
  type E2eAuthSession,
} from './helpers/auth.e2e-helper';
import { expectApiSuccess } from './helpers/expectations.helper';
import {
  PostgresConcurrencyHarness,
  withTimeout,
} from './helpers/postgres-concurrency.helper';

jest.setTimeout(60000);

describe('Budget write contract (e2e)', () => {
  let app: E2eApplication;
  let db: DataSource;
  let coordinator: DataSource;
  let harness: PostgresConcurrencyHarness;
  let owner: E2eAuthSession;
  let other: E2eAuthSession;

  beforeAll(async () => {
    const config = configureE2eEnvironment();
    await prepareE2eDatabase(config);
    app = await createE2eApp();
    db = app.get(DataSource);
    coordinator = new DataSource({
      type: 'postgres',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
    });
    await coordinator.initialize();
    harness = new PostgresConcurrencyHarness(coordinator);
    owner = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'budget-owner@example.com',
      nome: 'Budget owner',
    });
    other = await registerAndLoginTestUser(app, {
      cpf: '11144477735',
      email: 'budget-other@example.com',
      nome: 'Budget other',
    });
  });

  afterAll(async () => {
    try {
      await harness?.cleanupAll();
    } finally {
      if (coordinator?.isInitialized) await coordinator.destroy();
      await app?.close();
    }
  });

  function create(session: E2eAuthSession, month: string, amount: number) {
    return withAuth(
      request(app.getHttpServer())
        .post('/orcamentos')
        .send({ mesReferencia: month, valorPlanejado: amount }),
      session,
    );
  }

  it('returns one creation and one conflict when both requests pass the precheck', async () => {
    const barrier = await harness.installBarrier({
      holder: 'budget-create',
      table: 'orcamento',
      triggerEvent: `BEFORE INSERT ON orcamento FOR EACH ROW WHEN (NEW.usuario_id = '${owner.userId}'::uuid AND NEW.mes_referencia = '2026-04')`,
    });
    try {
      const first = create(owner, '2026-04', 1000).then((response) => response);
      barrier.pendingRequests.push(first);
      const holder = await harness.waitForTaggedHolder(barrier);
      const second = create(owner, '2026-04', 2000).then(
        (response) => response,
      );
      barrier.pendingRequests.push(second);
      const contender = await harness.waitForBlockedActivity(
        barrier,
        holder.pid,
        (activity) => /INSERT INTO "orcamento"/.test(activity.query),
      );
      expect(contender.pid).not.toBe(holder.pid);
      await harness.expectTaggedHolderStillBlocked(barrier, holder.pid);
      await harness.unlockBarrier(barrier);
      const [winner, loser] = await withTimeout(
        Promise.all([first, second]),
        'budget creation race',
      );
      expect(winner.status).toBe(201);
      expect(loser.status).toBe(409);
      expect(loser.body).toMatchObject({
        success: false,
        error: { code: 'ORCAMENTO_ALREADY_EXISTS' },
      });
      expect(JSON.stringify(loser.body)).not.toMatch(
        /23505|uq_orcamento|INSERT INTO/,
      );
      const rows = await db
        .getRepository(Orcamento)
        .findBy({ usuarioId: owner.userId, mesReferencia: '2026-04' });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].valorPlanejado)).toBe(1000);
      expect(
        await db
          .getRepository(AuditLog)
          .countBy({ entityId: rows[0].id, event: 'ORCAMENTO_CREATED' }),
      ).toBe(1);
    } finally {
      await harness.cleanupBarrier(barrier);
    }
  });

  it('keeps sequential duplicates conflicting and users/months independent', async () => {
    await create(owner, '2026-05', 1000).expect(201);
    await create(owner, '2026-05', 999).expect(409);
    await create(other, '2026-05', 500).expect(201);
    await create(owner, '2026-08', 1500).expect(201);
  });

  it('rejects an empty patch without changing persisted fields or success audit', async () => {
    const created = await create(owner, '2026-06', 1000).expect(201);
    const { id } = expectApiSuccess<{ id: string }>(created);
    const before = await db.getRepository(Orcamento).findOneByOrFail({ id });
    const auditBefore = await db
      .getRepository(AuditLog)
      .findBy({ entityId: id, event: 'ORCAMENTO_UPDATED' });
    const response = await withAuth(
      request(app.getHttpServer()).patch(`/orcamentos/${id}`).send({}),
      owner,
    );
    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'ORCAMENTO_ATUALIZACAO_VAZIA' },
    });
    expect(await db.getRepository(Orcamento).findOneByOrFail({ id })).toEqual(
      before,
    );
    expect(
      await db
        .getRepository(AuditLog)
        .findBy({ entityId: id, event: 'ORCAMENTO_UPDATED' }),
    ).toEqual(auditBefore);
    await withAuth(
      request(app.getHttpServer()).patch(`/orcamentos/${id}`).send({}),
      other,
    ).expect(404);
    const updated = await withAuth(
      request(app.getHttpServer())
        .patch(`/orcamentos/${id}`)
        .send({ valorPlanejado: 1200 }),
      owner,
    ).expect(200);
    expect(
      expectApiSuccess<{ valorPlanejado: number }>(updated).valorPlanejado,
    ).toBe(1200);
  });

  it.each([null, 0, -1, 1.001])(
    'continues rejecting invalid planned amounts (%s)',
    async (amount) => {
      const response = await create(owner, '2026-07', 1000).expect(201);
      const { id } = expectApiSuccess<{ id: string }>(response);
      await withAuth(
        request(app.getHttpServer())
          .patch(`/orcamentos/${id}`)
          .send({ valorPlanejado: amount }),
        owner,
      ).expect(amount === null ? 422 : 400);
      expect(
        Number(
          (await db.getRepository(Orcamento).findOneByOrFail({ id }))
            .valorPlanejado,
        ),
      ).toBe(1000);
      await db.getRepository(Orcamento).delete(id);
    },
  );
});
