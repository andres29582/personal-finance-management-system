import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TipoCategoria } from '../src/categorias/enums/tipo-categoria.enum';
import { Orcamento } from '../src/orcamentos/entities/orcamento.entity';
import { OrcamentoCategoria } from '../src/orcamentos/entities/orcamento-categoria.entity';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { makeCategoriaPayload } from './factories/categoria.factory';
import {
  registerAndLoginTestUser,
  withAuth,
  type E2eAuthSession,
} from './helpers/auth.e2e-helper';
import { type Identifiable, unwrapSuccess } from './helpers/http.helper';

type Budget = Identifiable & { valorPlanejado: number | string };
type Allocation = Identifiable & { valorPlanejado: number | string };
type AuditFailureTrigger = { functionName: string; triggerName: string };

jest.setTimeout(60000);

describe('Orcamentos audit atomicity (e2e)', () => {
  let app: E2eApplication;
  let dataSource: DataSource;
  let session: E2eAuthSession;
  let auditFailureTrigger: AuditFailureTrigger | null = null;

  beforeAll(async () => {
    await prepareE2eDatabase(configureE2eEnvironment());
    app = await createE2eApp();
    dataSource = app.get(DataSource);
    session = await registerAndLoginTestUser(app, {
      cpf: '73592745972',
      email: 'orcamentos.audit.e2e@example.com',
      nome: 'Orcamentos Auditoria E2E',
    });
  });

  afterEach(async () => {
    if (!auditFailureTrigger) return;
    await dataSource.query(
      `DROP TRIGGER IF EXISTS ${auditFailureTrigger.triggerName} ON audit_log`,
    );
    await dataSource.query(
      `DROP FUNCTION IF EXISTS ${auditFailureTrigger.functionName}()`,
    );
    auditFailureTrigger = null;
  });

  afterAll(async () => app?.close());

  async function failAuditEvent(event: string, entity: string): Promise<void> {
    const suffix = randomUUID().replace(/-/g, '_');
    auditFailureTrigger = {
      functionName: `falhar_auditoria_orcamento_${suffix}`,
      triggerName: `trigger_falhar_auditoria_orcamento_${suffix}`,
    };
    await dataSource.query(`
      CREATE FUNCTION ${auditFailureTrigger.functionName}() RETURNS trigger AS $$
      BEGIN
        IF NEW.entity = '${entity}' AND NEW.event = '${event}'
          AND NEW.user_id = '${session.userId}' THEN
          RAISE EXCEPTION 'falha de auditoria induzida pelo teste';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER ${auditFailureTrigger.triggerName}
      BEFORE INSERT ON audit_log
      FOR EACH ROW EXECUTE FUNCTION ${auditFailureTrigger.functionName}();
    `);
  }

  async function createBudget(month: string, value = 100): Promise<Budget> {
    return unwrapSuccess<Budget>(
      await withAuth(request(app.getHttpServer()).post('/orcamentos'), session)
        .send({ mesReferencia: month, valorPlanejado: value })
        .expect(201),
    );
  }

  async function createCategory(name: string): Promise<Identifiable> {
    return unwrapSuccess<Identifiable>(
      await withAuth(request(app.getHttpServer()).post('/categorias'), session)
        .send(makeCategoriaPayload({ nome: name, tipo: TipoCategoria.DESPESA }))
        .expect(201),
    );
  }

  async function createAllocation(
    budgetId: string,
    categoryId: string,
    value = 40,
  ): Promise<Allocation> {
    return unwrapSuccess<Allocation>(
      await withAuth(
        request(app.getHttpServer()).post(`/orcamentos/${budgetId}/categorias`),
        session,
      )
        .send({ categoriaId: categoryId, valorPlanejado: value })
        .expect(201),
    );
  }

  it('rolls back budget creation when its audit insert fails', async () => {
    const before = await dataSource.getRepository(Orcamento).countBy({
      usuarioId: session.userId,
    });
    await failAuditEvent('ORCAMENTO_CREATED', 'orcamento');

    await withAuth(request(app.getHttpServer()).post('/orcamentos'), session)
      .send({ mesReferencia: '2099-01', valorPlanejado: 100 })
      .expect(500);

    await expect(
      dataSource
        .getRepository(Orcamento)
        .countBy({ usuarioId: session.userId }),
    ).resolves.toBe(before);
  });

  it('rolls back budget update when its audit insert fails', async () => {
    const budget = await createBudget('2099-02');
    await failAuditEvent('ORCAMENTO_UPDATED', 'orcamento');

    await withAuth(
      request(app.getHttpServer()).patch(`/orcamentos/${budget.id}`),
      session,
    )
      .send({ valorPlanejado: 200 })
      .expect(500);

    await expect(
      dataSource.getRepository(Orcamento).findOneByOrFail({ id: budget.id }),
    ).resolves.toEqual(expect.objectContaining({ valorPlanejado: '100.00' }));
  });

  it('rolls back allocation creation when its audit insert fails', async () => {
    const budget = await createBudget('2099-03');
    const category = await createCategory('Audit allocation create');
    await failAuditEvent('ORCAMENTO_CATEGORIA_CREATED', 'orcamento_categoria');

    await withAuth(
      request(app.getHttpServer()).post(`/orcamentos/${budget.id}/categorias`),
      session,
    )
      .send({ categoriaId: category.id, valorPlanejado: 40 })
      .expect(500);

    await expect(
      dataSource.getRepository(OrcamentoCategoria).countBy({
        orcamentoId: budget.id,
      }),
    ).resolves.toBe(0);
  });

  it('rolls back allocation update when its audit insert fails', async () => {
    const budget = await createBudget('2099-04');
    const category = await createCategory('Audit allocation update');
    const allocation = await createAllocation(budget.id, category.id);
    await failAuditEvent('ORCAMENTO_CATEGORIA_UPDATED', 'orcamento_categoria');

    await withAuth(
      request(app.getHttpServer()).patch(
        `/orcamentos/${budget.id}/categorias/${allocation.id}`,
      ),
      session,
    )
      .send({ valorPlanejado: 60 })
      .expect(500);

    await expect(
      dataSource
        .getRepository(OrcamentoCategoria)
        .findOneByOrFail({ id: allocation.id }),
    ).resolves.toEqual(expect.objectContaining({ valorPlanejado: '40.00' }));
  });

  it('rolls back allocation removal when its audit insert fails', async () => {
    const budget = await createBudget('2099-05');
    const category = await createCategory('Audit allocation removal');
    const allocation = await createAllocation(budget.id, category.id);
    await failAuditEvent('ORCAMENTO_CATEGORIA_DELETED', 'orcamento_categoria');

    await withAuth(
      request(app.getHttpServer()).delete(
        `/orcamentos/${budget.id}/categorias/${allocation.id}`,
      ),
      session,
    ).expect(500);

    await expect(
      dataSource
        .getRepository(OrcamentoCategoria)
        .existsBy({ id: allocation.id }),
    ).resolves.toBe(true);
  });

  it('returns the existing conflict when concurrent creates race on the database constraint', async () => {
    const payload = { mesReferencia: '2099-06', valorPlanejado: 100 };
    const [first, second] = await Promise.all([
      withAuth(request(app.getHttpServer()).post('/orcamentos'), session).send(
        payload,
      ),
      withAuth(request(app.getHttpServer()).post('/orcamentos'), session).send(
        payload,
      ),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const conflict = first.status === 409 ? first : second;
    expect(conflict.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'ORCAMENTO_ALREADY_EXISTS',
        }) as { code: string },
      }),
    );
  });
});
