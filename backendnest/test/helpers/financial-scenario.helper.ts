import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TipoCategoria } from '../../src/categorias/enums/tipo-categoria.enum';
import { TipoConta } from '../../src/contas/enums/tipo-conta.enum';
import { TipoMeta } from '../../src/metas/enums/tipo-meta.enum';
import { TipoTransacao } from '../../src/transacoes/enums/tipo-transacao.enum';
import { makeCategoriaPayload } from '../factories/categoria.factory';
import { makeContaPayload } from '../factories/conta.factory';
import { makeDividaPayload } from '../factories/divida.factory';
import { makePagoDividaPayload } from '../factories/pago-divida.factory';
import { makeTransacaoPayload } from '../factories/transacao.factory';
import { makeTransferenciaPayload } from '../factories/transferencia.factory';
import { E2eAuthSession, withAuth } from './auth.e2e-helper';
import { E2E_DATES, E2E_DATE_VALUES } from './date.helper';
import { expectApiSuccess } from './expectations.helper';
import { Identifiable } from './http.helper';

type EntityResponse = Identifiable & Record<string, unknown>;

type AccountResponse = EntityResponse & {
  saldoAtual: number | string;
};

type DebtPaymentResponse = EntityResponse & {
  transacaoId: string;
};

export type MonthlyFinancialScenario = {
  accounts: {
    primary: EntityResponse;
    reserve: EntityResponse;
  };
  categories: {
    debtPayment: EntityResponse;
    expense: EntityResponse;
    income: EntityResponse;
  };
  debt: EntityResponse;
  debtPayment: DebtPaymentResponse;
  expected: {
    currentMonthExpense: number;
    currentMonthIncome: number;
    currentMonthNet: number;
    debtPaymentExpense: number;
    expenseByCategory: {
      debtPayment: number;
      expense: number;
    };
    futureIncome: number;
    totalBalanceAfterScenario: number;
    transferFee: number;
  };
  futureIncome: EntityResponse;
  goal: EntityResponse;
  transactions: {
    expense: EntityResponse;
    income: EntityResponse;
  };
  transfer: EntityResponse;
};

export async function createMonthlyFinancialScenario(
  app: INestApplication,
  session: E2eAuthSession,
  label = 'monthly',
): Promise<MonthlyFinancialScenario> {
  const incomeCategory = await createCategoria(app, session, {
    nome: `Receita ${label}`,
    tipo: TipoCategoria.RECEITA,
  });
  const expenseCategory = await createCategoria(app, session, {
    nome: `Despesa ${label}`,
    tipo: TipoCategoria.DESPESA,
  });
  const debtPaymentCategory = await createCategoria(app, session, {
    nome: `Pagamento divida ${label}`,
    tipo: TipoCategoria.DESPESA,
  });

  const primaryAccount = await createConta(app, session, {
    nome: `Conta principal ${label}`,
    saldoInicial: 1000,
    tipo: TipoConta.BANCO,
  });
  const reserveAccount = await createConta(app, session, {
    nome: `Reserva ${label}`,
    saldoInicial: 500,
    tipo: TipoConta.BANCO,
  });

  const income = await createTransacao(app, session, {
    categoriaId: incomeCategory.id,
    contaId: primaryAccount.id,
    data: E2E_DATE_VALUES.income,
    descricao: `Salario ${label}`,
    tipo: TipoTransacao.RECEITA,
    valor: 3000,
  });
  const expense = await createTransacao(app, session, {
    categoriaId: expenseCategory.id,
    contaId: primaryAccount.id,
    data: E2E_DATE_VALUES.expense,
    descricao: `Mercado ${label}`,
    tipo: TipoTransacao.DESPESA,
    valor: 650,
  });

  const transfer = await createTransferencia(app, session, {
    comissao: 10,
    contaDestinoId: reserveAccount.id,
    contaOrigemId: primaryAccount.id,
    data: E2E_DATE_VALUES.transfer,
    descricao: `Reserva mensal ${label}`,
    valor: 200,
  });

  const debt = await createDivida(app, session, {
    contaId: primaryAccount.id,
    fechaInicio: E2E_DATE_VALUES.debtStart,
    fechaVencimiento: E2E_DATE_VALUES.debtDue,
    montoTotal: 1200,
    nome: `Financiamento ${label}`,
    proximoVencimiento: E2E_DATE_VALUES.debtDue,
  });
  const debtPayment = await createPagoDivida(app, session, {
    categoriaId: debtPaymentCategory.id,
    contaId: primaryAccount.id,
    data: E2E_DATE_VALUES.debtPayment,
    descricao: `Parcela financiamento ${label}`,
    dividaId: debt.id,
    valor: 150,
  });

  const goal = await createMeta(app, session, {
    contaId: reserveAccount.id,
    fechaLimite: E2E_DATE_VALUES.goalDeadline,
    montoObjetivo: 2000,
    nome: `Meta reserva ${label}`,
    tipo: TipoMeta.ECONOMIA,
  });

  const futureIncome = await createTransacao(app, session, {
    categoriaId: incomeCategory.id,
    contaId: primaryAccount.id,
    data: E2E_DATE_VALUES.futureIncome,
    descricao: `Receita fora periodo ${label}`,
    tipo: TipoTransacao.RECEITA,
    valor: 900,
  });

  const currentMonthExpense = 650 + 150;
  const currentMonthIncome = 3000;
  const transferFee = 10;

  return {
    accounts: {
      primary: primaryAccount,
      reserve: reserveAccount,
    },
    categories: {
      debtPayment: debtPaymentCategory,
      expense: expenseCategory,
      income: incomeCategory,
    },
    debt,
    debtPayment,
    expected: {
      currentMonthExpense,
      currentMonthIncome,
      currentMonthNet: currentMonthIncome - currentMonthExpense,
      debtPaymentExpense: 150,
      expenseByCategory: {
        debtPayment: 150,
        expense: 650,
      },
      futureIncome: 900,
      totalBalanceAfterScenario:
        1000 +
        500 +
        currentMonthIncome -
        currentMonthExpense +
        900 -
        transferFee,
      transferFee,
    },
    futureIncome,
    goal,
    transactions: {
      expense,
      income,
    },
    transfer,
  };
}

export async function createCategoria(
  app: INestApplication,
  session: E2eAuthSession,
  overrides: Partial<Parameters<typeof makeCategoriaPayload>[0]> = {},
): Promise<EntityResponse> {
  const response = await withAuth(
    request(app.getHttpServer()).post('/categorias'),
    session,
  )
    .send(makeCategoriaPayload(overrides))
    .expect(201);

  return expectApiSuccess<EntityResponse>(response);
}

export async function createConta(
  app: INestApplication,
  session: E2eAuthSession,
  overrides: Partial<Parameters<typeof makeContaPayload>[0]> = {},
): Promise<AccountResponse> {
  const response = await withAuth(
    request(app.getHttpServer()).post('/contas'),
    session,
  )
    .send(makeContaPayload(overrides))
    .expect(201);

  return expectApiSuccess<AccountResponse>(response);
}

export async function listContas(
  app: INestApplication,
  session: E2eAuthSession,
): Promise<AccountResponse[]> {
  const response = await withAuth(
    request(app.getHttpServer()).get('/contas'),
    session,
  ).expect(200);

  return expectApiSuccess<AccountResponse[]>(response);
}

export async function createTransacao(
  app: INestApplication,
  session: E2eAuthSession,
  overrides: Partial<Parameters<typeof makeTransacaoPayload>[0]> = {},
): Promise<EntityResponse> {
  const response = await withAuth(
    request(app.getHttpServer()).post('/transacoes'),
    session,
  )
    .send(makeTransacaoPayload(overrides))
    .expect(201);

  return expectApiSuccess<EntityResponse>(response);
}

export async function createTransferencia(
  app: INestApplication,
  session: E2eAuthSession,
  overrides: Partial<Parameters<typeof makeTransferenciaPayload>[0]> = {},
): Promise<EntityResponse> {
  const response = await withAuth(
    request(app.getHttpServer()).post('/transferencias'),
    session,
  )
    .send(makeTransferenciaPayload(overrides))
    .expect(201);

  return expectApiSuccess<EntityResponse>(response);
}

export async function createDivida(
  app: INestApplication,
  session: E2eAuthSession,
  overrides: Partial<Parameters<typeof makeDividaPayload>[0]> = {},
): Promise<EntityResponse> {
  const response = await withAuth(
    request(app.getHttpServer()).post('/dividas'),
    session,
  )
    .send(makeDividaPayload(overrides))
    .expect(201);

  return expectApiSuccess<EntityResponse>(response);
}

export async function createPagoDivida(
  app: INestApplication,
  session: E2eAuthSession,
  overrides: Partial<Parameters<typeof makePagoDividaPayload>[0]> = {},
): Promise<DebtPaymentResponse> {
  const response = await withAuth(
    request(app.getHttpServer()).post('/pagos-divida'),
    session,
  )
    .send(makePagoDividaPayload(overrides))
    .expect(201);

  return expectApiSuccess<DebtPaymentResponse>(response);
}

export async function createMeta(
  app: INestApplication,
  session: E2eAuthSession,
  body: Record<string, unknown>,
): Promise<EntityResponse> {
  const response = await withAuth(
    request(app.getHttpServer()).post('/metas'),
    session,
  )
    .send(body)
    .expect(201);

  return expectApiSuccess<EntityResponse>(response);
}

export function monthlyReportQuery() {
  return {
    mes: E2E_DATES.targetMonth,
    periodo: 'mensal',
  };
}
