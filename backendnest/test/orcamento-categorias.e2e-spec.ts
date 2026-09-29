import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TipoCategoria } from '../src/categorias/enums/tipo-categoria.enum';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { registerAndLoginTestUser, withAuth } from './helpers/auth.e2e-helper';
import { createCategoria } from './helpers/financial-scenario.helper';
import { unwrapSuccess } from './helpers/http.helper';

jest.setTimeout(60000);

type Budget = {
  alocacoes: Array<{
    id: string;
    categoriaId: string;
    valorPlanejado: number | string;
  }>;
  id: string;
};
type Allocation = { id: string; valorPlanejado: number | string };

describe('Budget category allocations (e2e)', () => {
  let app: E2eApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    await prepareE2eDatabase(configureE2eEnvironment());
    app = await createE2eApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('enforces category ownership/activity, uniqueness and the global cap', async () => {
    const owner = await registerAndLoginTestUser(app, {
      cpf: '33451565214',
      email: 'budget.allocations.owner@example.com',
      nome: 'Budget Owner',
    });
    const other = await registerAndLoginTestUser(app, {
      cpf: '12853491700',
      email: 'budget.allocations.other@example.com',
      nome: 'Other Owner',
    });
    const budget = await createBudget(owner, '2099-01', 100);
    const active = await createCategoria(app, owner, {
      nome: 'Allocation active category',
      tipo: TipoCategoria.DESPESA,
    });
    const foreign = await createCategoria(app, other, {
      nome: 'Allocation foreign category',
      tipo: TipoCategoria.DESPESA,
    });
    const inactive = await createCategoria(app, owner, {
      nome: 'Allocation inactive category',
      tipo: TipoCategoria.DESPESA,
    });
    await withAuth(
      request(app.getHttpServer()).patch(
        `/categorias/${inactive.id}/desativar`,
      ),
      owner,
    ).expect(200);

    await withAuth(
      request(app.getHttpServer()).get(`/orcamentos/${budget.id}`),
      other,
    ).expect(404);
    await withAuth(
      request(app.getHttpServer()).patch(`/orcamentos/${budget.id}`),
      other,
    )
      .send({ valorPlanejado: 90 })
      .expect(404);
    await withAuth(request(app.getHttpServer()).post('/orcamentos'), owner)
      .send({ mesReferencia: '2099-12', valorPlanejado: 100.001 })
      .expect(400);

    await withAuth(
      request(app.getHttpServer()).post(`/orcamentos/${budget.id}/categorias`),
      owner,
    )
      .send({ categoriaId: foreign.id, valorPlanejado: 10 })
      .expect(404);
    await withAuth(
      request(app.getHttpServer()).post(`/orcamentos/${budget.id}/categorias`),
      owner,
    )
      .send({
        categoriaId: '99999999-9999-4999-8999-999999999999',
        valorPlanejado: 10,
      })
      .expect(404);
    await withAuth(
      request(app.getHttpServer()).post(`/orcamentos/${budget.id}/categorias`),
      owner,
    )
      .send({ categoriaId: inactive.id, valorPlanejado: 10 })
      .expect(400);

    const allocation = unwrapSuccess<Allocation>(
      await withAuth(
        request(app.getHttpServer()).post(
          `/orcamentos/${budget.id}/categorias`,
        ),
        owner,
      )
        .send({ categoriaId: active.id, valorPlanejado: 60 })
        .expect(201),
    );
    expect(Number(allocation.valorPlanejado)).toBe(60);

    await withAuth(
      request(app.getHttpServer()).patch(
        `/orcamentos/${budget.id}/categorias/${allocation.id}`,
      ),
      other,
    )
      .send({ valorPlanejado: 50 })
      .expect(404);
    await withAuth(
      request(app.getHttpServer()).delete(
        `/orcamentos/${budget.id}/categorias/${allocation.id}`,
      ),
      other,
    ).expect(404);

    await withAuth(
      request(app.getHttpServer()).post(`/orcamentos/${budget.id}/categorias`),
      owner,
    )
      .send({ categoriaId: active.id, valorPlanejado: 10 })
      .expect(409);
    await withAuth(
      request(app.getHttpServer()).post(`/orcamentos/${budget.id}/categorias`),
      owner,
    )
      .send({ categoriaId: active.id, valorPlanejado: 100.001 })
      .expect(400);
    await withAuth(
      request(app.getHttpServer()).patch(`/orcamentos/${budget.id}`),
      owner,
    )
      .send({ valorPlanejado: 59 })
      .expect(400);

    const read = unwrapSuccess<Budget>(
      await withAuth(
        request(app.getHttpServer()).get(`/orcamentos/${budget.id}`),
        owner,
      ).expect(200),
    );
    expect(read.alocacoes).toEqual([
      expect.objectContaining({ categoriaId: active.id, id: allocation.id }),
    ]);
    expect(await dataSource.query('SELECT 1')).toBeDefined();
  });

  it('makes allocations immutable with a past budget and supports removal', async () => {
    const owner = await registerAndLoginTestUser(app, {
      cpf: '45887619045',
      email: 'budget.allocations.lifecycle@example.com',
      nome: 'Budget Lifecycle',
    });
    const category = await createCategoria(app, owner, {
      nome: 'Allocation lifecycle category',
      tipo: TipoCategoria.DESPESA,
    });
    const future = await createBudget(owner, '2099-02', 100);
    const allocation = unwrapSuccess<Allocation>(
      await withAuth(
        request(app.getHttpServer()).post(
          `/orcamentos/${future.id}/categorias`,
        ),
        owner,
      )
        .send({ categoriaId: category.id, valorPlanejado: 50 })
        .expect(201),
    );
    const updated = unwrapSuccess<Allocation>(
      await withAuth(
        request(app.getHttpServer()).patch(
          `/orcamentos/${future.id}/categorias/${allocation.id}`,
        ),
        owner,
      )
        .send({ valorPlanejado: 70 })
        .expect(200),
    );
    expect(Number(updated.valorPlanejado)).toBe(70);
    const updatedBudget = unwrapSuccess<Budget>(
      await withAuth(
        request(app.getHttpServer()).get(`/orcamentos/${future.id}`),
        owner,
      ).expect(200),
    );
    expect(updatedBudget.alocacoes).toEqual([
      expect.objectContaining({
        id: allocation.id,
        categoriaId: category.id,
        valorPlanejado: 70,
      }),
    ]);
    await withAuth(
      request(app.getHttpServer()).delete(
        `/orcamentos/${future.id}/categorias/${allocation.id}`,
      ),
      owner,
    ).expect(200);
    const removedBudget = unwrapSuccess<Budget>(
      await withAuth(
        request(app.getHttpServer()).get(`/orcamentos/${future.id}`),
        owner,
      ).expect(200),
    );
    expect(removedBudget.alocacoes).toEqual([]);

    const past = await createBudget(owner, '2000-01', 100);
    await withAuth(
      request(app.getHttpServer()).post(`/orcamentos/${past.id}/categorias`),
      owner,
    )
      .send({ categoriaId: category.id, valorPlanejado: 10 })
      .expect(400);
    const pastAllocationId = randomUUID();
    await dataSource.query(
      `INSERT INTO orcamento_categoria (id, orcamento_id, categoria_id, valor_planejado)
       VALUES ($1, $2, $3, $4)`,
      [pastAllocationId, past.id, category.id, 10],
    );
    await withAuth(
      request(app.getHttpServer()).patch(
        `/orcamentos/${past.id}/categorias/${pastAllocationId}`,
      ),
      owner,
    )
      .send({ valorPlanejado: 20 })
      .expect(400);
    await withAuth(
      request(app.getHttpServer()).delete(
        `/orcamentos/${past.id}/categorias/${pastAllocationId}`,
      ),
      owner,
    ).expect(400);
  });

  it('rejects owned active income categories while accepting expense categories', async () => {
    const owner = await registerAndLoginTestUser(app, {
      cpf: '88980796119',
      email: 'budget.allocations.type@example.com',
      nome: 'Budget Type',
    });
    const budget = await createBudget(owner, '2099-03', 100);
    const income = await createCategoria(app, owner, {
      nome: 'Allocation income category',
      tipo: TipoCategoria.RECEITA,
    });
    const expense = await createCategoria(app, owner, {
      nome: 'Allocation expense category',
      tipo: TipoCategoria.DESPESA,
    });

    await withAuth(
      request(app.getHttpServer()).post(`/orcamentos/${budget.id}/categorias`),
      owner,
    )
      .send({ categoriaId: income.id, valorPlanejado: 10 })
      .expect(400);

    const allocation = unwrapSuccess<Allocation>(
      await withAuth(
        request(app.getHttpServer()).post(
          `/orcamentos/${budget.id}/categorias`,
        ),
        owner,
      )
        .send({ categoriaId: expense.id, valorPlanejado: 10 })
        .expect(201),
    );
    expect(Number(allocation.valorPlanejado)).toBe(10);
  });

  async function createBudget(
    session: Parameters<typeof withAuth>[1],
    mesReferencia: string,
    valorPlanejado: number,
  ): Promise<Budget> {
    return unwrapSuccess<Budget>(
      await withAuth(request(app.getHttpServer()).post('/orcamentos'), session)
        .send({ mesReferencia, valorPlanejado })
        .expect(201),
    );
  }
});
