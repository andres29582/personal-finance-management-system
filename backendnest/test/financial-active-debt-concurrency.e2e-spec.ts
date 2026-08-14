import request, { type Response } from 'supertest';
import { DataSource } from 'typeorm';
import { TipoCategoria } from '../src/categorias/enums/tipo-categoria.enum';
import { TipoConta } from '../src/contas/enums/tipo-conta.enum';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { makePagoDividaPayload } from './factories/pago-divida.factory';
import {
  registerAndLoginTestUser,
  type E2eAuthSession,
  withAuth,
} from './helpers/auth.e2e-helper';
import {
  createCategoria,
  createConta,
  createDivida,
} from './helpers/financial-scenario.helper';
import { unwrapSuccess } from './helpers/http.helper';
import {
  type BackendActivity,
  expectBlockedBy,
  PostgresConcurrencyHarness,
  type PostgresBarrier,
  withTimeout,
} from './helpers/postgres-concurrency.helper';

type ContaResponse = {
  ativa: boolean;
  id: string;
  saldoAtual: number | string;
};

type DividaResponse = {
  ativa: boolean;
  id: string;
};

type PagamentoDividaResponse = {
  contaId: string;
  dividaId: string;
  id: string;
  transacaoId: string;
  valor: number | string;
};

type DebtBarrierDefinition = {
  debtId: string;
  holder: 'debt-deactivation' | 'debt-payment';
};

jest.setTimeout(60000);

describe('Financial active debt concurrency (e2e)', () => {
  let app: E2eApplication;
  let appDataSource: DataSource;
  let coordinatorDataSource: DataSource;
  let concurrencyHarness: PostgresConcurrencyHarness;
  let originalPgOptions: string | undefined;

  beforeAll(async () => {
    originalPgOptions = process.env.PGOPTIONS;
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);

    process.env.PGOPTIONS = [
      originalPgOptions,
      '-c lock_timeout=10000',
      '-c statement_timeout=20000',
    ]
      .filter(Boolean)
      .join(' ');

    app = await createE2eApp();
    appDataSource = app.get(DataSource);
    coordinatorDataSource = new DataSource({
      type: 'postgres',
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database,
    });
    await coordinatorDataSource.initialize();
    concurrencyHarness = new PostgresConcurrencyHarness(coordinatorDataSource);
  });

  afterEach(async () => {
    if (concurrencyHarness) {
      await concurrencyHarness.cleanupAll();
    }
  });

  afterAll(async () => {
    const cleanupResults = concurrencyHarness
      ? await concurrencyHarness.cleanupAllSettled()
      : [];
    if (coordinatorDataSource?.isInitialized) {
      await coordinatorDataSource.destroy();
    }
    await app?.close();

    if (originalPgOptions === undefined) {
      delete process.env.PGOPTIONS;
    } else {
      process.env.PGOPTIONS = originalPgOptions;
    }

    const cleanupFailure = cleanupResults.find(
      (result) => result.status === 'rejected',
    );
    if (cleanupFailure?.status === 'rejected') {
      throw cleanupFailure.reason instanceof Error
        ? cleanupFailure.reason
        : new Error('Final concurrency barrier cleanup failed');
    }
  });

  it('A commits a debt payment before deactivating the locked debt', async () => {
    const { account, category, debt, session } =
      await createDebtPaymentTestContext('A', '52998224725');
    const barrier = await installBarrier({
      debtId: debt.id,
      holder: 'debt-payment',
    });

    try {
      const paymentPromise = withAuth(
        request(app.getHttpServer()).post('/pagos-divida'),
        session,
      )
        .send(
          makePagoDividaPayload({
            categoriaId: category.id,
            contaId: account.id,
            data: '2026-08-07',
            descricao: 'Pagamento concorrente divida A',
            dividaId: debt.id,
            valor: 150,
          }),
        )
        .then((response) => response);
      barrier.pendingRequests.push(paymentPromise);

      const holder = await concurrencyHarness.waitForTaggedHolder(barrier);
      const deactivationPromise = withAuth(
        request(app.getHttpServer()).patch(`/dividas/${debt.id}/desativar`),
        session,
      ).then((response) => response);
      barrier.pendingRequests.push(deactivationPromise);

      const waitingDeactivation =
        await concurrencyHarness.waitForBlockedActivity(
          barrier,
          holder.pid,
          isDebtUpdateQuery,
        );
      expectBlockedBy(waitingDeactivation, holder.pid);

      await concurrencyHarness.unlockBarrier(barrier);
      const [paymentResponse, deactivationResponse] = await Promise.all([
        withTimeout(paymentPromise, 'A debt payment'),
        withTimeout(deactivationPromise, 'A debt deactivation'),
      ]);

      expect(paymentResponse.status).toBe(201);
      expect(deactivationResponse.status).toBe(200);
      const payment = unwrapSuccess<PagamentoDividaResponse>(paymentResponse);
      expect(payment).toEqual(
        expect.objectContaining({
          contaId: account.id,
          dividaId: debt.id,
          transacaoId: expect.any(String) as string,
        }),
      );
      expect(Number(payment.valor)).toBeCloseTo(150, 2);

      await expectPersistedDebtPayment(
        payment.id,
        payment.transacaoId,
        debt.id,
        account.id,
      );
      await expectDebtState(session, debt.id, false);
      await expectAccountState(session, account.id, 850);
      await expectSingleAuditEvent(
        session.userId,
        'PAGAMENTO_DIVIDA_CREATED',
        'pagamento_divida',
        payment.id,
      );
      await expectSingleAuditEvent(
        session.userId,
        'DIVIDA_DEACTIVATED',
        'divida',
        debt.id,
      );
    } finally {
      await concurrencyHarness.cleanupBarrier(barrier);
    }
  });

  it('B rejects a debt payment after debt deactivation commits first', async () => {
    const { account, category, debt, session } =
      await createDebtPaymentTestContext('B', '39053344705');
    const barrier = await installBarrier({
      debtId: debt.id,
      holder: 'debt-deactivation',
    });

    try {
      const deactivationPromise = withAuth(
        request(app.getHttpServer()).patch(`/dividas/${debt.id}/desativar`),
        session,
      ).then((response) => response);
      barrier.pendingRequests.push(deactivationPromise);

      const holder = await concurrencyHarness.waitForTaggedHolder(barrier);
      const paymentPromise = withAuth(
        request(app.getHttpServer()).post('/pagos-divida'),
        session,
      )
        .send(
          makePagoDividaPayload({
            categoriaId: category.id,
            contaId: account.id,
            data: '2026-08-08',
            descricao: 'Pagamento concorrente divida B rejeitado',
            dividaId: debt.id,
            valor: 150,
          }),
        )
        .then((response) => response);
      barrier.pendingRequests.push(paymentPromise);

      const waitingPayment = await concurrencyHarness.waitForBlockedActivity(
        barrier,
        holder.pid,
        isDebtShareLockQuery,
      );
      expectBlockedBy(waitingPayment, holder.pid);

      await concurrencyHarness.unlockBarrier(barrier);
      const [deactivationResponse, paymentResponse] = await Promise.all([
        withTimeout(deactivationPromise, 'B debt deactivation'),
        withTimeout(paymentPromise, 'B debt payment'),
      ]);

      expect(deactivationResponse.status).toBe(200);
      expectInactiveDebtError(paymentResponse);
      expect(await countDebtPayments(session.userId, debt.id)).toBe(0);
      expect(await countTransactions(session.userId, account.id)).toBe(0);
      await expectDebtState(session, debt.id, false);
      await expectAccountState(session, account.id, 1000);
      expect(
        await countAuditEvents(session.userId, 'PAGAMENTO_DIVIDA_CREATED'),
      ).toBe(0);
      await expectSingleAuditEvent(
        session.userId,
        'DIVIDA_DEACTIVATED',
        'divida',
        debt.id,
      );
    } finally {
      await concurrencyHarness.cleanupBarrier(barrier);
    }
  });

  async function createDebtPaymentTestContext(code: string, cpf: string) {
    const session = await registerAndLoginTestUser(app, {
      cpf,
      email: `active.debt.${code.toLowerCase()}.e2e@example.com`,
      nome: `Active Debt ${code} E2E`,
    });
    const category = await createCategoria(app, session, {
      nome: `Pagamento divida ${code}`,
      tipo: TipoCategoria.DESPESA,
    });
    const account = await createConta(app, session, {
      nome: `Conta pagamento divida ${code}`,
      saldoInicial: 1000,
      tipo: TipoConta.BANCO,
    });
    const debt = await createDivida(app, session, {
      contaId: account.id,
      montoTotal: 1000,
      nome: `Divida concorrente ${code}`,
    });

    return { account, category, debt, session };
  }

  function installBarrier({
    debtId,
    holder,
  }: DebtBarrierDefinition): Promise<PostgresBarrier> {
    const debtLiteral = quoteLiteral(debtId);
    const table = holder === 'debt-payment' ? 'pagamento_divida' : 'divida';
    const triggerEvent =
      holder === 'debt-payment'
        ? `AFTER INSERT ON "pagamento_divida"
          FOR EACH ROW WHEN (NEW."divida_id" = ${debtLiteral}::uuid)`
        : `AFTER UPDATE OF "ativa" ON "divida"
          FOR EACH ROW WHEN (
            NEW."id" = ${debtLiteral}::uuid
            AND OLD."ativa" IS DISTINCT FROM NEW."ativa"
            AND NEW."ativa" = false
          )`;

    return concurrencyHarness.installBarrier({ holder, table, triggerEvent });
  }

  function isDebtUpdateQuery(activity: BackendActivity): boolean {
    return /update\s+"divida"/i.test(activity.query);
  }

  function isDebtShareLockQuery(activity: BackendActivity): boolean {
    return (
      /select[\s\S]+from\s+"divida"/i.test(activity.query) &&
      /for share/i.test(activity.query)
    );
  }

  function expectInactiveDebtError(response: Response): void {
    expect(response.status).toBe(400);
    expect(response.body as unknown).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PAGAMENTO_DIVIDA_INACTIVE_DEBT',
          message:
            'Nao e possivel registrar pagamento para uma divida inativa.',
        }) as object,
        success: false,
      }),
    );
  }

  async function expectPersistedDebtPayment(
    paymentId: string,
    transactionId: string,
    debtId: string,
    accountId: string,
  ): Promise<void> {
    const rows = await appDataSource.query<
      Array<{
        debtId: string;
        paymentAccountId: string;
        paymentId: string;
        transactionAccountId: string;
        transactionId: string;
      }>
    >(
      `SELECT
         payment.id AS "paymentId",
         payment.divida_id AS "debtId",
         payment.transacao_id AS "transactionId",
         payment.conta_id AS "paymentAccountId",
         financial_transaction.conta_id AS "transactionAccountId"
       FROM pagamento_divida payment
       INNER JOIN transacao financial_transaction
         ON financial_transaction.id = payment.transacao_id
       WHERE payment.id = $1
         AND payment.excluido_em IS NULL
         AND financial_transaction.excluido_em IS NULL`,
      [paymentId],
    );
    expect(rows).toEqual([
      {
        debtId,
        paymentAccountId: accountId,
        paymentId,
        transactionAccountId: accountId,
        transactionId,
      },
    ]);
  }

  async function expectDebtState(
    session: E2eAuthSession,
    debtId: string,
    active: boolean,
  ): Promise<void> {
    const response = await withAuth(
      request(app.getHttpServer()).get(`/dividas/${debtId}`),
      session,
    ).expect(200);
    const debt = unwrapSuccess<DividaResponse>(response);
    expect(debt).toEqual(
      expect.objectContaining({ ativa: active, id: debtId }),
    );
  }

  async function expectAccountState(
    session: E2eAuthSession,
    accountId: string,
    expectedBalance: number,
  ): Promise<void> {
    const response = await withAuth(
      request(app.getHttpServer()).get(`/contas/${accountId}`),
      session,
    ).expect(200);
    const account = unwrapSuccess<ContaResponse>(response);
    expect(account).toEqual(
      expect.objectContaining({ ativa: true, id: accountId }),
    );
    expect(Number(account.saldoAtual)).toBeCloseTo(expectedBalance, 2);
  }

  async function countDebtPayments(
    userId: string,
    debtId: string,
  ): Promise<number> {
    const [{ count }] = await appDataSource.query<Array<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count
       FROM pagamento_divida
       WHERE usuario_id = $1 AND divida_id = $2 AND excluido_em IS NULL`,
      [userId, debtId],
    );
    return count;
  }

  async function countTransactions(
    userId: string,
    accountId: string,
  ): Promise<number> {
    const [{ count }] = await appDataSource.query<Array<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count
       FROM transacao
       WHERE usuario_id = $1 AND conta_id = $2 AND excluido_em IS NULL`,
      [userId, accountId],
    );
    return count;
  }

  async function countAuditEvents(
    userId: string,
    event: string,
  ): Promise<number> {
    const [{ count }] = await appDataSource.query<Array<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count
       FROM audit_log
       WHERE user_id = $1 AND event = $2 AND success = true`,
      [userId, event],
    );
    return count;
  }

  async function expectSingleAuditEvent(
    userId: string,
    event: string,
    entity: string,
    entityId: string,
  ): Promise<void> {
    const rows = await appDataSource.query<
      Array<{ entity: string; entityId: string; event: string }>
    >(
      `SELECT event, entity, entity_id AS "entityId"
       FROM audit_log
       WHERE user_id = $1 AND event = $2 AND success = true`,
      [userId, event],
    );
    expect(rows).toEqual([{ entity, entityId, event }]);
  }

  function quoteLiteral(value: string): string {
    return `'${value.replaceAll("'", "''")}'`;
  }
});
