import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import {
  createMonthlyFinancialScenario,
  type MonthlyFinancialScenario,
} from './helpers/financial-scenario.helper';
import { registerAndLoginTestUser, withAuth } from './helpers/auth.e2e-helper';
import { unwrapSuccess } from './helpers/http.helper';

jest.setTimeout(60000);

type BudgetProgress = {
  gastoAtual: number;
  percentualUtilizado: number;
  restante: number;
  statusAlerta: string;
  alocacoes: Array<{
    categoriaId: string;
    gastoAtual: number;
    percentualUtilizado: number;
    restante: number;
    statusAlerta: string;
  }>;
  id: string;
};

describe('Budget progress (e2e)', () => {
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

  it('excludes adjustments, includes debt payment expenses, and returns signed category progress', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '73186452006',
      email: 'budget.progress@example.com',
      nome: 'Budget Progress',
    });
    const scenario = await createMonthlyFinancialScenario(
      app,
      session,
      'budget progress',
    );
    const budget = unwrapSuccess<BudgetProgress>(
      await withAuth(request(app.getHttpServer()).post('/orcamentos'), session)
        .send({ mesReferencia: '2026-05', valorPlanejado: 700 })
        .expect(201),
    );
    await addAdjustment(scenario, session.userId);
    await addAllocation(budget.id, scenario.categories.expense.id, 600);
    await addAllocation(budget.id, scenario.categories.debtPayment.id, 100);

    const result = unwrapSuccess<BudgetProgress>(
      await withAuth(
        request(app.getHttpServer()).get(`/orcamentos/${budget.id}`),
        session,
      ).expect(200),
    );

    expect(result).toMatchObject({
      gastoAtual: 800,
      percentualUtilizado: 114.29,
      restante: -100,
      statusAlerta: 'estourado',
    });
    expect(result.alocacoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoriaId: scenario.categories.expense.id,
          gastoAtual: 650,
          restante: -50,
          statusAlerta: 'estourado',
        }),
        expect.objectContaining({
          categoriaId: scenario.categories.debtPayment.id,
          gastoAtual: 150,
          restante: -50,
          statusAlerta: 'estourado',
        }),
      ]),
    );
  });

  async function addAdjustment(
    scenario: MonthlyFinancialScenario,
    usuarioId: string,
  ): Promise<void> {
    await dataSource.query(
      `INSERT INTO transacao
       (id, usuario_id, conta_id, categoria_id, tipo, valor, data, descricao, eh_ajuste)
       VALUES ($1, $2, $3, $4, 'DESPESA', 25, '2026-05-20', 'Excluded adjustment', true)`,
      [
        randomUUID(),
        usuarioId,
        scenario.accounts.primary.id,
        scenario.categories.expense.id,
      ],
    );
  }

  async function addAllocation(
    orcamentoId: string,
    categoriaId: string,
    valorPlanejado: number,
  ): Promise<void> {
    await dataSource.query(
      `INSERT INTO orcamento_categoria (id, orcamento_id, categoria_id, valor_planejado)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), orcamentoId, categoriaId, valorPlanejado],
    );
  }
});
