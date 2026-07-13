import request from 'supertest';
import { TipoCategoria } from '../src/categorias/enums/tipo-categoria.enum';
import { TipoConta } from '../src/contas/enums/tipo-conta.enum';
import { PeriodoRelatorio } from '../src/relatorios/enums/periodo-relatorio.enum';
import { TipoTransacao } from '../src/transacoes/enums/tipo-transacao.enum';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { registerAndLoginTestUser, withAuth } from './helpers/auth.e2e-helper';
import { E2E_DATES } from './helpers/date.helper';
import {
  expectApiSuccess,
  expectMoney,
  expectUnauthorized,
} from './helpers/expectations.helper';
import {
  createCategoria,
  createConta,
  createMonthlyFinancialScenario,
  createTransacao,
  monthlyReportQuery,
} from './helpers/financial-scenario.helper';

type RelatorioResponse = {
  despesasPorCategoria: Array<{
    categoriaId: string;
    categoriaNome: string;
    percentual: number;
    total: number;
  }>;
  periodo: PeriodoRelatorio;
  periodoReferencia: string;
  resumo: {
    economia: number;
    totalDespesas: number;
    totalReceitas: number;
    totalTransacoes: number;
  };
  transacoes: Array<{
    categoriaId: string;
    categoriaNome: string;
    contaId: string;
    contaNome: string;
    id: string;
    tipo: TipoTransacao;
    valor: number;
  }>;
};

jest.setTimeout(60000);

describe('Relatorios (e2e)', () => {
  let app: E2eApplication;

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
      .get('/relatorios')
      .query(monthlyReportQuery())
      .expect(401);

    expectUnauthorized(response);
  });

  it('filters monthly reports by period and excludes movements outside the selected month', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'relatorios.periodo.e2e@example.com',
      nome: 'Relatorios Periodo E2E',
    });
    const scenario = await createMonthlyFinancialScenario(
      app,
      session,
      'relatorio-periodo',
    );

    const response = await withAuth(
      request(app.getHttpServer()).get('/relatorios'),
      session,
    )
      .query(monthlyReportQuery())
      .expect(200);
    const relatorio = expectApiSuccess<RelatorioResponse>(response);

    expect(relatorio.periodo).toBe(PeriodoRelatorio.MENSAL);
    expect(relatorio.periodoReferencia).toBe(E2E_DATES.targetMonth);
    expectMoney(
      relatorio.resumo.totalReceitas,
      scenario.expected.currentMonthIncome,
    );
    expectMoney(
      relatorio.resumo.totalDespesas,
      scenario.expected.currentMonthExpense,
    );
    expectMoney(relatorio.resumo.economia, scenario.expected.currentMonthNet);
    expect(relatorio.resumo.totalTransacoes).toBe(3);
    expect(relatorio.transacoes.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        scenario.transactions.income.id,
        scenario.transactions.expense.id,
        scenario.debtPayment.transacaoId,
      ]),
    );
    expect(relatorio.transacoes.map((item) => item.id)).not.toContain(
      scenario.futureIncome.id,
    );
  });

  it('groups expenses by category with explicit totals and percentages', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '39053344705',
      email: 'relatorios.categoria.e2e@example.com',
      nome: 'Relatorios Categoria E2E',
    });
    const scenario = await createMonthlyFinancialScenario(
      app,
      session,
      'relatorio-categoria',
    );

    const response = await withAuth(
      request(app.getHttpServer()).get('/relatorios'),
      session,
    )
      .query(monthlyReportQuery())
      .expect(200);
    const relatorio = expectApiSuccess<RelatorioResponse>(response);

    expect(relatorio.despesasPorCategoria).toEqual([
      {
        categoriaId: scenario.categories.expense.id,
        categoriaNome: 'Despesa relatorio-categoria',
        percentual: 81.25,
        total: scenario.expected.expenseByCategory.expense,
      },
      {
        categoriaId: scenario.categories.debtPayment.id,
        categoriaNome: 'Pagamento divida relatorio-categoria',
        percentual: 18.75,
        total: scenario.expected.expenseByCategory.debtPayment,
      },
    ]);
  });

  it('excludes soft-deleted debt payments from expense totals', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '10000001252',
      email: 'relatorios.pagamento-deletado.e2e@example.com',
      nome: 'Relatorios Pagamento Deletado E2E',
    });
    const scenario = await createMonthlyFinancialScenario(
      app,
      session,
      'relatorio-pagamento-deletado',
    );

    const beforeDeleteResponse = await withAuth(
      request(app.getHttpServer()).get('/relatorios'),
      session,
    )
      .query(monthlyReportQuery())
      .expect(200);
    const beforeDelete =
      expectApiSuccess<RelatorioResponse>(beforeDeleteResponse);

    expectMoney(
      beforeDelete.resumo.totalDespesas,
      scenario.expected.currentMonthExpense,
    );
    expect(beforeDelete.transacoes.map((item) => item.id)).toContain(
      scenario.debtPayment.transacaoId,
    );
    expect(beforeDelete.despesasPorCategoria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoriaId: scenario.categories.debtPayment.id,
          total: scenario.expected.debtPaymentExpense,
        }),
      ]),
    );

    await withAuth(
      request(app.getHttpServer()).delete(
        `/pagos-divida/${scenario.debtPayment.id}`,
      ),
      session,
    ).expect(200);

    const afterDeleteResponse = await withAuth(
      request(app.getHttpServer()).get('/relatorios'),
      session,
    )
      .query(monthlyReportQuery())
      .expect(200);
    const afterDelete =
      expectApiSuccess<RelatorioResponse>(afterDeleteResponse);

    expectMoney(
      afterDelete.resumo.totalDespesas,
      scenario.expected.expenseByCategory.expense,
    );
    expect(afterDelete.resumo.totalTransacoes).toBe(2);
    expect(afterDelete.transacoes.map((item) => item.id)).not.toContain(
      scenario.debtPayment.transacaoId,
    );
    expect(afterDelete.despesasPorCategoria).toEqual([
      {
        categoriaId: scenario.categories.expense.id,
        categoriaNome: 'Despesa relatorio-pagamento-deletado',
        percentual: 100,
        total: scenario.expected.expenseByCategory.expense,
      },
    ]);
  });

  it('filters report transactions by account when contaId is provided', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '68199965000',
      email: 'relatorios.conta.e2e@example.com',
      nome: 'Relatorios Conta E2E',
    });
    const scenario = await createMonthlyFinancialScenario(
      app,
      session,
      'relatorio-conta',
    );

    const primaryResponse = await withAuth(
      request(app.getHttpServer()).get('/relatorios'),
      session,
    )
      .query({
        ...monthlyReportQuery(),
        contaId: scenario.accounts.primary.id,
      })
      .expect(200);
    const primaryReport = expectApiSuccess<RelatorioResponse>(primaryResponse);

    expect(primaryReport.resumo.totalTransacoes).toBe(3);
    expect(primaryReport.transacoes.map((item) => item.contaId)).toEqual([
      scenario.accounts.primary.id,
      scenario.accounts.primary.id,
      scenario.accounts.primary.id,
    ]);

    const reserveResponse = await withAuth(
      request(app.getHttpServer()).get('/relatorios'),
      session,
    )
      .query({
        ...monthlyReportQuery(),
        contaId: scenario.accounts.reserve.id,
      })
      .expect(200);
    const reserveReport = expectApiSuccess<RelatorioResponse>(reserveResponse);

    expect(reserveReport.resumo).toEqual({
      economia: 0,
      totalDespesas: 0,
      totalReceitas: 0,
      totalTransacoes: 0,
    });
    expect(reserveReport.transacoes).toEqual([]);
  });

  it('returns empty data for a period without movements', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '11144477735',
      email: 'relatorios.empty.e2e@example.com',
      nome: 'Relatorios Empty E2E',
    });
    await createMonthlyFinancialScenario(app, session, 'relatorio-empty');

    const response = await withAuth(
      request(app.getHttpServer()).get('/relatorios'),
      session,
    )
      .query({
        mes: E2E_DATES.emptyMonth,
        periodo: PeriodoRelatorio.MENSAL,
      })
      .expect(200);
    const relatorio = expectApiSuccess<RelatorioResponse>(response);

    expect(relatorio.periodoReferencia).toBe(E2E_DATES.emptyMonth);
    expect(relatorio.resumo).toEqual({
      economia: 0,
      totalDespesas: 0,
      totalReceitas: 0,
      totalTransacoes: 0,
    });
    expect(relatorio.despesasPorCategoria).toEqual([]);
    expect(relatorio.transacoes).toEqual([]);
  });

  it('isolates report data between authenticated users', async () => {
    const ownerSession = await registerAndLoginTestUser(app, {
      cpf: '10000001090',
      email: 'relatorios.owner.e2e@example.com',
      nome: 'Relatorios Owner E2E',
    });
    await createMonthlyFinancialScenario(app, ownerSession, 'relatorio-owner');

    const otherSession = await registerAndLoginTestUser(app, {
      cpf: '10000001171',
      email: 'relatorios.other.e2e@example.com',
      nome: 'Relatorios Other E2E',
    });
    const incomeCategory = await createCategoria(app, otherSession, {
      nome: 'Receita isolada relatorio',
      tipo: TipoCategoria.RECEITA,
    });
    const account = await createConta(app, otherSession, {
      nome: 'Conta isolada relatorio',
      saldoInicial: 0,
      tipo: TipoConta.BANCO,
    });
    const otherIncome = await createTransacao(app, otherSession, {
      categoriaId: incomeCategory.id,
      contaId: account.id,
      data: E2E_DATES.targetMonthStart,
      descricao: 'Receita isolada',
      tipo: TipoTransacao.RECEITA,
      valor: 123,
    });

    const response = await withAuth(
      request(app.getHttpServer()).get('/relatorios'),
      otherSession,
    )
      .query(monthlyReportQuery())
      .expect(200);
    const relatorio = expectApiSuccess<RelatorioResponse>(response);

    expectMoney(relatorio.resumo.totalReceitas, 123);
    expectMoney(relatorio.resumo.totalDespesas, 0);
    expect(relatorio.resumo.totalTransacoes).toBe(1);
    expect(relatorio.transacoes).toEqual([
      expect.objectContaining({
        id: otherIncome.id,
        contaId: account.id,
        categoriaId: incomeCategory.id,
        tipo: TipoTransacao.RECEITA,
        valor: 123,
      }),
    ]);
  });
});
