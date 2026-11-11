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

type Row = { id: string; tipo: string; nome: string; valorPlanejado: number };
type Progress = {
  gastoAtual: number;
  restante: number;
  statusAlerta: string;
  alocacoes: Progress[];
};
jest.setTimeout(60000);

describe('Financial business rule boundaries (real HTTP/PostgreSQL)', () => {
  let app: E2eApplication;
  let db: DataSource;
  let session: E2eAuthSession;
  let account: Row;
  let expense: Row;
  let income: Row;
  const month = '2099-01';
  const date = month + '-15';
  const api = (method: 'get' | 'post' | 'patch', path: string) =>
    withAuth(request(app.getHttpServer())[method](path), session);
  const category = async (nome: string, tipo = 'despesa') =>
    unwrapSuccess<Row>(
      await api('post', '/categorias').send({ nome, tipo }).expect(201),
    );
  const budget = async (mesReferencia: string, valorPlanejado: number) =>
    unwrapSuccess<Row>(
      await api('post', '/orcamentos')
        .send({ mesReferencia, valorPlanejado })
        .expect(201),
    );
  const allocation = (
    id: string,
    categoriaId: string,
    valorPlanejado: number,
  ) =>
    api('post', `/orcamentos/${id}/categorias`).send({
      categoriaId,
      valorPlanejado,
    });

  beforeAll(async () => {
    await prepareE2eDatabase(configureE2eEnvironment());
    app = await createE2eApp();
    db = app.get(DataSource);
    session = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'financial-boundaries@example.com',
      nome: 'Financial boundaries',
    });
    account = unwrapSuccess<Row>(
      await api('post', '/contas')
        .send({ nome: 'Exact cents', tipo: 'banco', saldoInicial: 0 })
        .expect(201),
    );
    expense = await category('Boundary expense');
    income = await category('Boundary income', 'receita');
  });
  afterAll(async () => {
    await app?.close();
  });

  it('rejects reclassification without mutating history and accepts unchanged echoes', async () => {
    const transaction = unwrapSuccess<Row>(
      await api('post', '/transacoes')
        .send({
          contaId: account.id,
          categoriaId: expense.id,
          tipo: 'despesa',
          valor: 1,
          data: date,
          descricao: 'Original',
        })
        .expect(201),
    );
    const rejection = await api('patch', `/categorias/${expense.id}`)
      .send({ tipo: 'receita', nome: 'Must not persist' })
      .expect(400);
    expect(JSON.stringify(rejection.body)).toContain(
      'CATEGORIA_TYPE_IMMUTABLE',
    );
    const persisted = await db.query<Array<{ tipo: string; nome: string }>>(
      'SELECT tipo, nome FROM categoria WHERE id=$1',
      [expense.id],
    );
    expect(persisted).toEqual([{ tipo: 'despesa', nome: 'Boundary expense' }]);
    await api('patch', `/categorias/${expense.id}`)
      .send({ tipo: 'despesa' })
      .expect(200);
    await api('patch', `/categorias/${expense.id}`)
      .send({ tipo: 'despesa', nome: 'Renamed expense' })
      .expect(200);
    await api('patch', `/transacoes/${transaction.id}`)
      .send({ descricao: 'Edited history' })
      .expect(200);
    expect(
      unwrapSuccess<Row>(
        await api('get', `/categorias/${expense.id}`).expect(200),
      ),
    ).toMatchObject({ tipo: 'despesa', nome: 'Renamed expense' });
    await api('patch', `/transacoes/${transaction.id}`)
      .send({ valor: 0.1, tipo: 'despesa' })
      .expect(200);
  });

  it('accepts decimal equality, applies exact edit deltas, rejects one excess cent and preserves rejected state', async () => {
    const b = await budget('2099-02', 0.3);
    const a = unwrapSuccess<Row>(
      await allocation(b.id, expense.id, 0.1).expect(201),
    );
    const second = await category('Second allocation');
    const c = unwrapSuccess<Row>(
      await allocation(b.id, second.id, 0.1).expect(201),
    );
    await api('patch', `/orcamentos/${b.id}/categorias/${a.id}`)
      .send({ valorPlanejado: 0.2 })
      .expect(200);
    await api('patch', `/orcamentos/${b.id}/categorias/${c.id}`)
      .send({ valorPlanejado: 0.11 })
      .expect(400);
    await api('patch', `/orcamentos/${b.id}`)
      .send({ valorPlanejado: 0.29 })
      .expect(400);
    await api('patch', `/orcamentos/${b.id}`)
      .send({ valorPlanejado: 0.3 })
      .expect(200);
    const [total] = await db.query<Array<{ total: string }>>(
      'SELECT SUM(valor_planejado)::text AS total FROM orcamento_categoria WHERE orcamento_id=$1',
      [b.id],
    );
    expect(total.total).toBe('0.30');
    const equal = await budget('2099-03', 0.3);
    await allocation(equal.id, expense.id, 0.1).expect(201);
    await allocation(equal.id, second.id, 0.2).expect(201);
  });

  it('decides exact 80/100 percent boundaries globally and per category', async () => {
    const b = await budget('2099-04', 1000);
    await allocation(b.id, expense.id, 1000).expect(201);
    const tx = unwrapSuccess<Row>(
      await api('post', '/transacoes')
        .send({
          contaId: account.id,
          categoriaId: expense.id,
          tipo: 'despesa',
          valor: 799.99,
          data: '2099-04-15',
          descricao: 'Threshold',
        })
        .expect(201),
    );
    for (const [value, status] of [
      [799.99, 'normal'],
      [800, 'alerta_80'],
      [999.99, 'alerta_80'],
      [1000, 'estourado'],
    ] as const) {
      await api('patch', `/transacoes/${tx.id}`)
        .send({ valor: value })
        .expect(200);
      const result = unwrapSuccess<Progress>(
        await api('get', `/orcamentos/${b.id}`).expect(200),
      );
      for (const p of [result, result.alocacoes[0]]) {
        expect(p.gastoAtual).toBe(value);
        expect(p.statusAlerta).toBe(status);
      }
    }
  });

  it('returns JSON numbers with exact cent sums for accounts, dashboard and reports', async () => {
    const c = unwrapSuccess<Row>(
      await api('post', '/contas')
        .send({ nome: 'Exact aggregate', tipo: 'banco', saldoInicial: 0.1 })
        .expect(201),
    );
    await api('post', '/transacoes')
      .send({
        contaId: c.id,
        categoriaId: income.id,
        tipo: 'receita',
        valor: 0.2,
        data: '2099-05-15',
        descricao: 'Exact aggregate',
      })
      .expect(201);
    const response = unwrapSuccess<{ saldoAtual: number }>(
      await api('get', `/contas/${c.id}`).expect(200),
    );
    expect(typeof response.saldoAtual).toBe('number');
    expect(response.saldoAtual).toBe(0.3);
    await api('post', '/transacoes')
      .send({
        contaId: c.id,
        categoriaId: income.id,
        tipo: 'receita',
        valor: 0.1,
        data: '2099-05-16',
        descricao: 'Second exact income',
      })
      .expect(201);
    const dashboard = unwrapSuccess<{ receitasMes: number }>(
      await api('get', '/dashboard?mes=2099-05').expect(200),
    );
    const report = unwrapSuccess<{ resumo: { totalReceitas: number } }>(
      await api('get', '/relatorios?periodo=mensal&mes=2099-05').expect(200),
    );
    for (const total of [dashboard.receitasMes, report.resumo.totalReceitas]) {
      expect(typeof total).toBe('number');
      expect(total).toBe(0.3);
    }
  });
});
