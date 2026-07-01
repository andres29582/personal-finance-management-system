import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TipoConta } from '../src/contas/enums/tipo-conta.enum';
import { TipoTransacao } from '../src/transacoes/enums/tipo-transacao.enum';
import { createE2eApp } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { registerAndLoginTestUser, withAuth } from './helpers/auth.e2e-helper';
import { E2E_DATES } from './helpers/date.helper';
import {
  expectApiSuccess,
  expectMoney,
  expectUnauthorized,
} from './helpers/expectations.helper';
import {
  createConta,
  createMonthlyFinancialScenario,
} from './helpers/financial-scenario.helper';

type DashboardResponse = {
  contas: Array<{
    id: string;
    saldoAtual: number;
  }>;
  despesasMes: number;
  economiaMes: number;
  gastosPorCategoria: Array<{
    categoriaId: string;
    categoriaNome: string;
    percentual: number;
    total: number;
  }>;
  mesReferencia: string;
  receitasMes: number;
  saldoTotal: number;
  totalContas: number;
  transacoesRecentes: Array<{
    id: string;
    tipo: TipoTransacao;
    valor: number;
  }>;
};

jest.setTimeout(60000);

describe('Dashboard (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);

    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('blocks access without authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .query({ mes: E2E_DATES.targetMonth })
      .expect(401);

    expectUnauthorized(response);
  });

  it('returns an empty dashboard for an authenticated user without financial data', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'dashboard.empty.e2e@example.com',
      nome: 'Dashboard Empty E2E',
    });

    const response = await withAuth(
      request(app.getHttpServer()).get('/dashboard'),
      session,
    )
      .query({ mes: E2E_DATES.targetMonth })
      .expect(200);
    const dashboard = expectApiSuccess<DashboardResponse>(response);

    expect(dashboard).toEqual(
      expect.objectContaining({
        despesasMes: 0,
        economiaMes: 0,
        mesReferencia: E2E_DATES.targetMonth,
        receitasMes: 0,
        saldoTotal: 0,
        totalContas: 0,
      }),
    );
    expect(dashboard.contas).toEqual([]);
    expect(dashboard.gastosPorCategoria).toEqual([]);
    expect(dashboard.transacoesRecentes).toEqual([]);
  });

  it('calculates monthly income, expenses and balance without treating transfers as income or expenses', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '39053344705',
      email: 'dashboard.summary.e2e@example.com',
      nome: 'Dashboard Summary E2E',
    });
    const scenario = await createMonthlyFinancialScenario(
      app,
      session,
      'dashboard-summary',
    );

    const response = await withAuth(
      request(app.getHttpServer()).get('/dashboard'),
      session,
    )
      .query({ mes: E2E_DATES.targetMonth })
      .expect(200);
    const dashboard = expectApiSuccess<DashboardResponse>(response);

    expect(dashboard.mesReferencia).toBe(E2E_DATES.targetMonth);
    expectMoney(dashboard.receitasMes, scenario.expected.currentMonthIncome);
    expectMoney(dashboard.despesasMes, scenario.expected.currentMonthExpense);
    expectMoney(dashboard.economiaMes, scenario.expected.currentMonthNet);
    expectMoney(
      dashboard.saldoTotal,
      scenario.expected.totalBalanceAfterScenario,
    );
    expect(dashboard.totalContas).toBe(2);

    expect(dashboard.gastosPorCategoria).toEqual([
      {
        categoriaId: scenario.categories.expense.id,
        categoriaNome: 'Despesa dashboard-summary',
        percentual: 81.25,
        total: scenario.expected.expenseByCategory.expense,
      },
      {
        categoriaId: scenario.categories.debtPayment.id,
        categoriaNome: 'Pagamento divida dashboard-summary',
        percentual: 18.75,
        total: scenario.expected.expenseByCategory.debtPayment,
      },
    ]);
    expect(dashboard.transacoesRecentes.map((item) => item.id)).toContain(
      scenario.debtPayment.transacaoId,
    );
  });

  it('isolates dashboard data between users', async () => {
    const ownerSession = await registerAndLoginTestUser(app, {
      cpf: '68199965000',
      email: 'dashboard.owner.e2e@example.com',
      nome: 'Dashboard Owner E2E',
    });
    await createMonthlyFinancialScenario(app, ownerSession, 'dashboard-owner');

    const otherSession = await registerAndLoginTestUser(app, {
      cpf: '11144477735',
      email: 'dashboard.other.e2e@example.com',
      nome: 'Dashboard Other E2E',
    });
    const otherAccount = await createConta(app, otherSession, {
      nome: 'Conta isolada dashboard',
      saldoInicial: 999,
      tipo: TipoConta.BANCO,
    });

    const response = await withAuth(
      request(app.getHttpServer()).get('/dashboard'),
      otherSession,
    )
      .query({ mes: E2E_DATES.targetMonth })
      .expect(200);
    const dashboard = expectApiSuccess<DashboardResponse>(response);

    expectMoney(dashboard.receitasMes, 0);
    expectMoney(dashboard.despesasMes, 0);
    expectMoney(dashboard.saldoTotal, 999);
    expect(dashboard.totalContas).toBe(1);
    expect(dashboard.contas.map((conta) => conta.id)).toEqual([
      otherAccount.id,
    ]);
    expect(dashboard.transacoesRecentes).toEqual([]);
  });
});
