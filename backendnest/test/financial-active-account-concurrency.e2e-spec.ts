import { randomUUID } from 'node:crypto';
import request, { type Response } from 'supertest';
import { DataSource, type QueryRunner } from 'typeorm';
import { TipoCategoria } from '../src/categorias/enums/tipo-categoria.enum';
import { TipoConta } from '../src/contas/enums/tipo-conta.enum';
import { TipoTransacao } from '../src/transacoes/enums/tipo-transacao.enum';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { makeTransacaoPayload } from './factories/transacao.factory';
import { makePagoDividaPayload } from './factories/pago-divida.factory';
import { makeTransferenciaPayload } from './factories/transferencia.factory';
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

type ContaResponse = {
  ativa: boolean;
  id: string;
  saldoAtual: number | string;
};

type TransacaoResponse = {
  contaId: string;
  id: string;
  tipo: TipoTransacao;
  valor: number | string;
};

type TransferenciaResponse = {
  comissao: number | string;
  contaDestinoId: string;
  contaOrigemId: string;
  id: string;
  valor: number | string;
};

type PagamentoDividaResponse = {
  contaId: string;
  dividaId: string;
  id: string;
  transacaoId: string;
  valor: number | string;
};

type BackendActivity = {
  blockers: number[];
  pid: number;
  query: string;
  waitEvent: string | null;
  waitEventType: string | null;
};

type Barrier = {
  applicationName: string;
  functionName: string;
  marker: string;
  pendingRequests: Promise<Response>[];
  pids: Set<number>;
  queryRunner: QueryRunner;
  table: 'conta' | 'pagamento_divida' | 'transacao' | 'transferencia';
  triggerName: string;
  unlocked: boolean;
};

type BarrierDefinition = {
  accountId: string;
  holder: 'deactivation' | 'debt-payment' | 'transaction' | 'transfer';
};

const DATABASE_POLL_DEADLINE_MS = 5000;
const REQUEST_DEADLINE_MS = 15000;

jest.setTimeout(60000);

describe('Financial active account concurrency (e2e)', () => {
  let app: E2eApplication;
  let appDataSource: DataSource;
  let coordinatorDataSource: DataSource;
  let originalPgOptions: string | undefined;
  const activeBarriers = new Set<Barrier>();

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
  });

  afterEach(async () => {
    const results = await Promise.allSettled(
      [...activeBarriers].map(cleanupBarrier),
    );
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') {
      throw failure.reason instanceof Error
        ? failure.reason
        : new Error('Concurrency barrier cleanup failed');
    }
  });

  afterAll(async () => {
    const cleanupResults = await Promise.allSettled(
      [...activeBarriers].map(cleanupBarrier),
    );
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

  it('A1 commits a transaction before deactivating the locked account', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'active.account.a1.e2e@example.com',
      nome: 'Active Account A1 E2E',
    });
    const category = await createCategoria(app, session, {
      nome: 'Despesa concorrente A1',
      tipo: TipoCategoria.DESPESA,
    });
    const account = await createConta(app, session, {
      nome: 'Conta concorrente A1',
      saldoInicial: 1000,
      tipo: TipoConta.BANCO,
    });
    const barrier = await installBarrier({
      accountId: account.id,
      holder: 'transaction',
    });

    try {
      const transactionPromise = withAuth(
        request(app.getHttpServer()).post('/transacoes'),
        session,
      )
        .send(
          makeTransacaoPayload({
            categoriaId: category.id,
            contaId: account.id,
            data: '2026-08-01',
            descricao: 'Transacao concorrente A1',
            tipo: TipoTransacao.DESPESA,
            valor: 100,
          }),
        )
        .then((response) => response);
      barrier.pendingRequests.push(transactionPromise);

      const holder = await waitForTaggedHolder(barrier);
      const deactivationPromise = withAuth(
        request(app.getHttpServer()).patch(`/contas/${account.id}/desativar`),
        session,
      ).then((response) => response);
      barrier.pendingRequests.push(deactivationPromise);

      const waitingDeactivation = await waitForBlockedActivity(
        barrier,
        holder.pid,
        (activity) => /update\s+"conta"/i.test(activity.query),
      );
      expectBlockedBy(waitingDeactivation, holder.pid);

      await unlockBarrier(barrier);
      const [transactionResponse, deactivationResponse] = await Promise.all([
        withTimeout(transactionPromise, 'A1 transaction'),
        withTimeout(deactivationPromise, 'A1 deactivation'),
      ]);

      expect(transactionResponse.status).toBe(201);
      expect(deactivationResponse.status).toBe(200);
      const transaction = unwrapSuccess<TransacaoResponse>(transactionResponse);
      expect(transaction).toEqual(
        expect.objectContaining({
          contaId: account.id,
          tipo: TipoTransacao.DESPESA,
        }),
      );
      expect(Number(transaction.valor)).toBeCloseTo(100, 2);

      await expectPersistedTransaction(transaction.id, account.id);
      const finalAccount = await getAccount(session, account.id);
      expect(finalAccount.ativa).toBe(false);
      expect(Number(finalAccount.saldoAtual)).toBeCloseTo(900, 2);
      await expectSingleAuditEvent(
        session.userId,
        'TRANSACAO_CREATED',
        'transacao',
        transaction.id,
      );
      await expectSingleAuditEvent(
        session.userId,
        'CONTA_DEACTIVATED',
        'conta',
        account.id,
      );
    } finally {
      await cleanupBarrier(barrier);
    }
  });

  it('A2 rejects a transaction after deactivation commits first', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '39053344705',
      email: 'active.account.a2.e2e@example.com',
      nome: 'Active Account A2 E2E',
    });
    const category = await createCategoria(app, session, {
      nome: 'Despesa concorrente A2',
      tipo: TipoCategoria.DESPESA,
    });
    const account = await createConta(app, session, {
      nome: 'Conta concorrente A2',
      saldoInicial: 1000,
      tipo: TipoConta.BANCO,
    });
    const barrier = await installBarrier({
      accountId: account.id,
      holder: 'deactivation',
    });

    try {
      const deactivationPromise = withAuth(
        request(app.getHttpServer()).patch(`/contas/${account.id}/desativar`),
        session,
      ).then((response) => response);
      barrier.pendingRequests.push(deactivationPromise);

      const holder = await waitForTaggedHolder(barrier);
      const transactionPromise = withAuth(
        request(app.getHttpServer()).post('/transacoes'),
        session,
      )
        .send(
          makeTransacaoPayload({
            categoriaId: category.id,
            contaId: account.id,
            data: '2026-08-02',
            descricao: 'Transacao concorrente A2 rejeitada',
            tipo: TipoTransacao.DESPESA,
            valor: 100,
          }),
        )
        .then((response) => response);
      barrier.pendingRequests.push(transactionPromise);

      const waitingTransaction = await waitForBlockedActivity(
        barrier,
        holder.pid,
        isAccountShareLockQuery,
      );
      expectBlockedBy(waitingTransaction, holder.pid);

      await unlockBarrier(barrier);
      const [deactivationResponse, transactionResponse] = await Promise.all([
        withTimeout(deactivationPromise, 'A2 deactivation'),
        withTimeout(transactionPromise, 'A2 transaction'),
      ]);

      expect(deactivationResponse.status).toBe(200);
      expect(transactionResponse.status).toBe(400);
      expect(transactionResponse.body as unknown).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'CONTA_INACTIVE' }) as object,
          success: false,
        }),
      );

      const transactionCount = await countTransactions(
        session.userId,
        account.id,
      );
      expect(transactionCount).toBe(0);
      const finalAccount = await getAccount(session, account.id);
      expect(finalAccount.ativa).toBe(false);
      expect(Number(finalAccount.saldoAtual)).toBeCloseTo(1000, 2);
      expect(await countAuditEvents(session.userId, 'TRANSACAO_CREATED')).toBe(
        0,
      );
      await expectSingleAuditEvent(
        session.userId,
        'CONTA_DEACTIVATED',
        'conta',
        account.id,
      );
    } finally {
      await cleanupBarrier(barrier);
    }
  });

  it.each([
    { code: 'B1', cpf: '68199965000', target: 'origin' as const },
    { code: 'C1', cpf: '11144477735', target: 'destination' as const },
  ])(
    '$code commits a transfer before deactivating its $target account',
    async ({ code, cpf, target }) => {
      const { destination, origin, session } = await createTransferTestContext(
        code,
        cpf,
      );
      const accountToDeactivate = target === 'origin' ? origin : destination;
      const barrier = await installBarrier({
        accountId: accountToDeactivate.id,
        holder: 'transfer',
      });

      try {
        const transferPromise = withAuth(
          request(app.getHttpServer()).post('/transferencias'),
          session,
        )
          .send(
            makeTransferenciaPayload({
              comissao: 10,
              contaDestinoId: destination.id,
              contaOrigemId: origin.id,
              data: '2026-08-03',
              descricao: `Transferencia concorrente ${code}`,
              valor: 200,
            }),
          )
          .then((response) => response);
        barrier.pendingRequests.push(transferPromise);

        const holder = await waitForTaggedHolder(barrier);
        const deactivationPromise = withAuth(
          request(app.getHttpServer()).patch(
            `/contas/${accountToDeactivate.id}/desativar`,
          ),
          session,
        ).then((response) => response);
        barrier.pendingRequests.push(deactivationPromise);

        const waitingDeactivation = await waitForBlockedActivity(
          barrier,
          holder.pid,
          (activity) => /update\s+"conta"/i.test(activity.query),
        );
        expectBlockedBy(waitingDeactivation, holder.pid);

        await unlockBarrier(barrier);
        const [transferResponse, deactivationResponse] = await Promise.all([
          withTimeout(transferPromise, `${code} transfer`),
          withTimeout(deactivationPromise, `${code} deactivation`),
        ]);

        expect(transferResponse.status).toBe(201);
        expect(deactivationResponse.status).toBe(200);
        const transfer = unwrapSuccess<TransferenciaResponse>(transferResponse);
        expect(transfer).toEqual(
          expect.objectContaining({
            contaDestinoId: destination.id,
            contaOrigemId: origin.id,
          }),
        );
        expect(Number(transfer.valor)).toBeCloseTo(200, 2);
        expect(Number(transfer.comissao)).toBeCloseTo(10, 2);

        await expectPersistedTransfer(transfer.id, origin.id, destination.id);
        await expectAccountState(session, origin.id, 790, target === 'origin');
        await expectAccountState(
          session,
          destination.id,
          700,
          target === 'destination',
        );
        await expectSingleAuditEvent(
          session.userId,
          'TRANSFERENCIA_CREATED',
          'transferencia',
          transfer.id,
        );
        await expectSingleAuditEvent(
          session.userId,
          'CONTA_DEACTIVATED',
          'conta',
          accountToDeactivate.id,
        );
      } finally {
        await cleanupBarrier(barrier);
      }
    },
  );

  it.each([
    { code: 'B2', cpf: '16899535009', target: 'origin' as const },
    { code: 'C2', cpf: '24681357928', target: 'destination' as const },
  ])(
    '$code rejects a transfer after deactivating its $target account first',
    async ({ code, cpf, target }) => {
      const { destination, origin, session } = await createTransferTestContext(
        code,
        cpf,
      );
      const accountToDeactivate = target === 'origin' ? origin : destination;
      const barrier = await installBarrier({
        accountId: accountToDeactivate.id,
        holder: 'deactivation',
      });

      try {
        const deactivationPromise = withAuth(
          request(app.getHttpServer()).patch(
            `/contas/${accountToDeactivate.id}/desativar`,
          ),
          session,
        ).then((response) => response);
        barrier.pendingRequests.push(deactivationPromise);

        const holder = await waitForTaggedHolder(barrier);
        const transferPromise = withAuth(
          request(app.getHttpServer()).post('/transferencias'),
          session,
        )
          .send(
            makeTransferenciaPayload({
              comissao: 10,
              contaDestinoId: destination.id,
              contaOrigemId: origin.id,
              data: '2026-08-04',
              descricao: `Transferencia concorrente ${code} rejeitada`,
              valor: 200,
            }),
          )
          .then((response) => response);
        barrier.pendingRequests.push(transferPromise);

        const waitingTransfer = await waitForBlockedActivity(
          barrier,
          holder.pid,
          isAccountShareLockQuery,
        );
        expectBlockedBy(waitingTransfer, holder.pid);

        await unlockBarrier(barrier);
        const [deactivationResponse, transferResponse] = await Promise.all([
          withTimeout(deactivationPromise, `${code} deactivation`),
          withTimeout(transferPromise, `${code} transfer`),
        ]);

        expect(deactivationResponse.status).toBe(200);
        expectInactiveAccountError(transferResponse);
        expect(await countTransfers(session.userId)).toBe(0);
        await expectAccountState(session, origin.id, 1000, target === 'origin');
        await expectAccountState(
          session,
          destination.id,
          500,
          target === 'destination',
        );
        expect(
          await countAuditEvents(session.userId, 'TRANSFERENCIA_CREATED'),
        ).toBe(0);
        await expectSingleAuditEvent(
          session.userId,
          'CONTA_DEACTIVATED',
          'conta',
          accountToDeactivate.id,
        );
      } finally {
        await cleanupBarrier(barrier);
      }
    },
  );

  it('D1 commits a debt payment atomically before deactivating the account', async () => {
    const { account, category, debt, session } =
      await createDebtPaymentTestContext('D1', '27182818205');
    const barrier = await installBarrier({
      accountId: account.id,
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
            data: '2026-08-05',
            descricao: 'Pagamento concorrente D1',
            dividaId: debt.id,
            valor: 150,
          }),
        )
        .then((response) => response);
      barrier.pendingRequests.push(paymentPromise);

      const holder = await waitForTaggedHolder(barrier);
      const deactivationPromise = withAuth(
        request(app.getHttpServer()).patch(`/contas/${account.id}/desativar`),
        session,
      ).then((response) => response);
      barrier.pendingRequests.push(deactivationPromise);

      const waitingDeactivation = await waitForBlockedActivity(
        barrier,
        holder.pid,
        (activity) => /update\s+"conta"/i.test(activity.query),
      );
      expectBlockedBy(waitingDeactivation, holder.pid);

      await unlockBarrier(barrier);
      const [paymentResponse, deactivationResponse] = await Promise.all([
        withTimeout(paymentPromise, 'D1 debt payment'),
        withTimeout(deactivationPromise, 'D1 deactivation'),
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
        account.id,
      );
      await expectAccountState(session, account.id, 850, true);
      await expectSingleAuditEvent(
        session.userId,
        'PAGAMENTO_DIVIDA_CREATED',
        'pagamento_divida',
        payment.id,
      );
      await expectSingleAuditEvent(
        session.userId,
        'CONTA_DEACTIVATED',
        'conta',
        account.id,
      );
    } finally {
      await cleanupBarrier(barrier);
    }
  });

  it('D2 rejects a debt payment after deactivation commits first', async () => {
    const { account, category, debt, session } =
      await createDebtPaymentTestContext('D2', '31415926590');
    const barrier = await installBarrier({
      accountId: account.id,
      holder: 'deactivation',
    });

    try {
      const deactivationPromise = withAuth(
        request(app.getHttpServer()).patch(`/contas/${account.id}/desativar`),
        session,
      ).then((response) => response);
      barrier.pendingRequests.push(deactivationPromise);

      const holder = await waitForTaggedHolder(barrier);
      const paymentPromise = withAuth(
        request(app.getHttpServer()).post('/pagos-divida'),
        session,
      )
        .send(
          makePagoDividaPayload({
            categoriaId: category.id,
            contaId: account.id,
            data: '2026-08-06',
            descricao: 'Pagamento concorrente D2 rejeitado',
            dividaId: debt.id,
            valor: 150,
          }),
        )
        .then((response) => response);
      barrier.pendingRequests.push(paymentPromise);

      const waitingPayment = await waitForBlockedActivity(
        barrier,
        holder.pid,
        isAccountShareLockQuery,
      );
      expectBlockedBy(waitingPayment, holder.pid);

      await unlockBarrier(barrier);
      const [deactivationResponse, paymentResponse] = await Promise.all([
        withTimeout(deactivationPromise, 'D2 deactivation'),
        withTimeout(paymentPromise, 'D2 debt payment'),
      ]);

      expect(deactivationResponse.status).toBe(200);
      expectInactiveAccountError(paymentResponse);
      expect(await countTransactions(session.userId, account.id)).toBe(0);
      expect(await countDebtPayments(session.userId, account.id)).toBe(0);
      await expectAccountState(session, account.id, 1000, true);
      expect(
        await countAuditEvents(session.userId, 'PAGAMENTO_DIVIDA_CREATED'),
      ).toBe(0);
      await expectSingleAuditEvent(
        session.userId,
        'CONTA_DEACTIVATED',
        'conta',
        account.id,
      );
    } finally {
      await cleanupBarrier(barrier);
    }
  });

  it('E does not block deactivation of a different account', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '93541134780',
      email: 'active.account.e.e2e@example.com',
      nome: 'Active Account E E2E',
    });
    const category = await createCategoria(app, session, {
      nome: 'Despesa concorrente E',
      tipo: TipoCategoria.DESPESA,
    });
    const accountA = await createConta(app, session, {
      nome: 'Conta A concorrente E',
      saldoInicial: 1000,
      tipo: TipoConta.BANCO,
    });
    const accountB = await createConta(app, session, {
      nome: 'Conta B independente E',
      saldoInicial: 500,
      tipo: TipoConta.BANCO,
    });
    const accountABarrier = await installBarrier({
      accountId: accountA.id,
      holder: 'transaction',
    });
    let accountBBarrier: Barrier | undefined;

    try {
      const transactionPromise = withAuth(
        request(app.getHttpServer()).post('/transacoes'),
        session,
      )
        .send(
          makeTransacaoPayload({
            categoriaId: category.id,
            contaId: accountA.id,
            data: '2026-08-07',
            descricao: 'Transacao concorrente conta A E',
            tipo: TipoTransacao.DESPESA,
            valor: 100,
          }),
        )
        .then((response) => response);
      accountABarrier.pendingRequests.push(transactionPromise);
      const accountAHolder = await waitForTaggedHolder(accountABarrier);

      accountBBarrier = await installBarrier({
        accountId: accountB.id,
        holder: 'deactivation',
      });
      const deactivationPromise = withAuth(
        request(app.getHttpServer()).patch(`/contas/${accountB.id}/desativar`),
        session,
      ).then((response) => response);
      accountBBarrier.pendingRequests.push(deactivationPromise);
      const accountBHolder = await waitForTaggedHolder(accountBBarrier);

      expect(accountBHolder.blockers).not.toContain(accountAHolder.pid);
      await expectTaggedHolderStillBlocked(accountABarrier, accountAHolder.pid);
      await unlockBarrier(accountBBarrier);
      const deactivationResponse = await withTimeout(
        deactivationPromise,
        'E account B deactivation',
      );
      expect(deactivationResponse.status).toBe(200);
      await expectAccountState(session, accountB.id, 500, true);
      await expectTaggedHolderStillBlocked(accountABarrier, accountAHolder.pid);

      await unlockBarrier(accountABarrier);
      const transactionResponse = await withTimeout(
        transactionPromise,
        'E account A transaction',
      );
      expect(transactionResponse.status).toBe(201);
      const transaction = unwrapSuccess<TransacaoResponse>(transactionResponse);
      await expectPersistedTransaction(transaction.id, accountA.id);
      await expectAccountState(session, accountA.id, 900, false);
      await expectSingleAuditEvent(
        session.userId,
        'TRANSACAO_CREATED',
        'transacao',
        transaction.id,
      );
      await expectSingleAuditEvent(
        session.userId,
        'CONTA_DEACTIVATED',
        'conta',
        accountB.id,
      );
    } finally {
      if (accountBBarrier !== undefined) {
        await cleanupBarrier(accountBBarrier);
      }
      await cleanupBarrier(accountABarrier);
    }
  });

  async function createTransferTestContext(code: string, cpf: string) {
    const session = await registerAndLoginTestUser(app, {
      cpf,
      email: `active.account.${code.toLowerCase()}.e2e@example.com`,
      nome: `Active Account ${code} E2E`,
    });
    const origin = await createConta(app, session, {
      nome: `Conta origem ${code}`,
      saldoInicial: 1000,
      tipo: TipoConta.BANCO,
    });
    const destination = await createConta(app, session, {
      nome: `Conta destino ${code}`,
      saldoInicial: 500,
      tipo: TipoConta.BANCO,
    });

    return { destination, origin, session };
  }

  async function createDebtPaymentTestContext(code: string, cpf: string) {
    const session = await registerAndLoginTestUser(app, {
      cpf,
      email: `active.account.${code.toLowerCase()}.e2e@example.com`,
      nome: `Active Account ${code} E2E`,
    });
    const category = await createCategoria(app, session, {
      nome: `Pagamento divida ${code}`,
      tipo: TipoCategoria.DESPESA,
    });
    const account = await createConta(app, session, {
      nome: `Conta pagamento ${code}`,
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

  async function installBarrier({
    accountId,
    holder,
  }: BarrierDefinition): Promise<Barrier> {
    const marker = `fc_${randomUUID().replaceAll('-', '')}`;
    const table = getBarrierTable(holder);
    const barrier: Barrier = {
      applicationName: `${marker}_${holder}`,
      functionName: `fn_${marker}`,
      marker,
      pendingRequests: [],
      pids: new Set<number>(),
      queryRunner: coordinatorDataSource.createQueryRunner(),
      table,
      triggerName: `trg_${marker}`,
      unlocked: false,
    };
    activeBarriers.add(barrier);
    await barrier.queryRunner.connect();
    await barrier.queryRunner.query(`SET lock_timeout = '5s'`);
    await barrier.queryRunner.query(`SET statement_timeout = '15s'`);

    const accountLiteral = quoteLiteral(accountId);
    const markerLiteral = quoteLiteral(marker);
    const applicationNameLiteral = quoteLiteral(barrier.applicationName);
    await barrier.queryRunner.query(`
      CREATE FUNCTION ${quoteIdentifier(barrier.functionName)}()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $barrier$
      BEGIN
        PERFORM set_config('application_name', ${applicationNameLiteral}, true);
        PERFORM set_config('lock_timeout', '10000', true);
        PERFORM pg_advisory_xact_lock(hashtextextended(${markerLiteral}, 0));
        RETURN NEW;
      END;
      $barrier$
    `);

    const triggerEvent = getBarrierTriggerEvent(holder, accountLiteral);
    await barrier.queryRunner.query(`
      CREATE TRIGGER ${quoteIdentifier(barrier.triggerName)}
      ${triggerEvent}
      EXECUTE FUNCTION ${quoteIdentifier(barrier.functionName)}()
    `);
    await barrier.queryRunner.query(
      'SELECT pg_advisory_lock(hashtextextended($1, 0))',
      [marker],
    );

    return barrier;
  }

  function getBarrierTable(
    holder: BarrierDefinition['holder'],
  ): Barrier['table'] {
    switch (holder) {
      case 'deactivation':
        return 'conta';
      case 'debt-payment':
        return 'pagamento_divida';
      case 'transaction':
        return 'transacao';
      case 'transfer':
        return 'transferencia';
    }
  }

  function getBarrierTriggerEvent(
    holder: BarrierDefinition['holder'],
    accountLiteral: string,
  ): string {
    switch (holder) {
      case 'deactivation':
        return `AFTER UPDATE OF "ativa" ON "conta"
          FOR EACH ROW WHEN (
            NEW."id" = ${accountLiteral}::uuid
            AND OLD."ativa" IS DISTINCT FROM NEW."ativa"
            AND NEW."ativa" = false
          )`;
      case 'debt-payment':
        return `AFTER INSERT ON "pagamento_divida"
          FOR EACH ROW WHEN (NEW."conta_id" = ${accountLiteral}::uuid)`;
      case 'transaction':
        return `AFTER INSERT ON "transacao"
          FOR EACH ROW WHEN (NEW."conta_id" = ${accountLiteral}::uuid)`;
      case 'transfer':
        return `AFTER INSERT ON "transferencia"
          FOR EACH ROW WHEN (
            NEW."conta_origem_id" = ${accountLiteral}::uuid
            OR NEW."conta_destino_id" = ${accountLiteral}::uuid
          )`;
    }
  }

  async function waitForTaggedHolder(
    barrier: Barrier,
  ): Promise<BackendActivity> {
    const coordinatorPid = await getCoordinatorPid(barrier);
    const activity = await pollDatabase(async () => {
      const rows = await readActivities(
        barrier,
        'WHERE application_name = $1',
        [barrier.applicationName],
      );

      return rows.find(
        (row) =>
          row.waitEventType === 'Lock' && row.blockers.includes(coordinatorPid),
      );
    }, `${barrier.applicationName} to reach its advisory barrier`);

    barrier.pids.add(activity.pid);
    expectBlockedBy(activity, coordinatorPid);
    return activity;
  }

  async function expectTaggedHolderStillBlocked(
    barrier: Barrier,
    holderPid: number,
  ): Promise<void> {
    const coordinatorPid = await getCoordinatorPid(barrier);
    const [activity] = await readActivities(
      barrier,
      'WHERE pid = $1 AND application_name = $2',
      [holderPid, barrier.applicationName],
    );

    expect(activity).toBeDefined();
    expectBlockedBy(activity, coordinatorPid);
  }

  async function getCoordinatorPid(barrier: Barrier): Promise<number> {
    const [{ pid }] = (await barrier.queryRunner.query(
      'SELECT pg_backend_pid() AS pid',
    )) as Array<{ pid: number }>;
    return pid;
  }

  async function waitForBlockedActivity(
    barrier: Barrier,
    blockerPid: number,
    matchesRequest: (activity: BackendActivity) => boolean,
  ): Promise<BackendActivity> {
    const activity = await pollDatabase(async () => {
      const rows = await readActivities(
        barrier,
        'WHERE $1::integer = ANY(pg_blocking_pids(pid))',
        [blockerPid],
      );

      return rows.find(
        (row) => row.waitEventType === 'Lock' && matchesRequest(row),
      );
    }, `a request blocked by PostgreSQL PID ${blockerPid}`);

    barrier.pids.add(activity.pid);
    return activity;
  }

  async function readActivities(
    barrier: Barrier,
    whereClause: string,
    parameters: unknown[],
  ): Promise<BackendActivity[]> {
    return (await barrier.queryRunner.query(
      `SELECT
         pid,
         query,
         wait_event AS "waitEvent",
         wait_event_type AS "waitEventType",
         pg_blocking_pids(pid) AS blockers
       FROM pg_stat_activity
       ${whereClause}`,
      parameters,
    )) as BackendActivity[];
  }

  async function pollDatabase<T>(
    observe: () => Promise<T | undefined>,
    description: string,
  ): Promise<T> {
    const deadline = Date.now() + DATABASE_POLL_DEADLINE_MS;

    while (Date.now() < deadline) {
      const result = await observe();
      if (result !== undefined) {
        return result;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }

    throw new Error(`Timed out waiting for ${description}`);
  }

  function isAccountShareLockQuery(activity: BackendActivity): boolean {
    return (
      /select[\s\S]+from\s+"conta"/i.test(activity.query) &&
      /for share/i.test(activity.query)
    );
  }

  function expectBlockedBy(
    activity: BackendActivity,
    blockerPid: number,
  ): void {
    expect(activity.pid).not.toBe(blockerPid);
    expect(activity.waitEventType).toBe('Lock');
    expect(activity.waitEvent).toEqual(expect.any(String));
    expect(activity.blockers).toContain(blockerPid);
  }

  async function unlockBarrier(barrier: Barrier): Promise<void> {
    if (barrier.unlocked || barrier.queryRunner.isReleased) {
      return;
    }
    await barrier.queryRunner.query(
      'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
      [barrier.marker],
    );
    barrier.unlocked = true;
  }

  async function cleanupBarrier(barrier: Barrier): Promise<void> {
    if (barrier.queryRunner.isReleased) {
      activeBarriers.delete(barrier);
      return;
    }

    await barrier.queryRunner.connect();
    const discoveredPids = (await barrier.queryRunner
      .query(
        `WITH holders AS (
           SELECT pid
           FROM pg_stat_activity
           WHERE application_name = $1
         )
         SELECT activity.pid
         FROM pg_stat_activity activity
         WHERE activity.application_name = $1
            OR EXISTS (
              SELECT 1
              FROM holders
              WHERE holders.pid = ANY(pg_blocking_pids(activity.pid))
            )`,
        [barrier.applicationName],
      )
      .catch(() => [])) as Array<{ pid: number }>;
    for (const { pid } of discoveredPids) {
      barrier.pids.add(pid);
    }

    await unlockBarrier(barrier);
    await Promise.allSettled(
      barrier.pendingRequests.map((pending) =>
        withTimeout(pending, 'pending request cleanup', 1000),
      ),
    );

    const pids = [...barrier.pids];
    if (pids.length > 0) {
      await barrier.queryRunner.query(
        `SELECT pg_cancel_backend(pid)
         FROM pg_stat_activity
         WHERE pid = ANY($1::integer[]) AND state <> 'idle'`,
        [pids],
      );
    }
    const pendingResults = await Promise.allSettled(
      barrier.pendingRequests.map((pending) =>
        withTimeout(pending, 'cancelled request cleanup', 2000),
      ),
    );
    const timedOutRequest = pendingResults.find(
      (result) =>
        result.status === 'rejected' &&
        result.reason instanceof Error &&
        result.reason.message.startsWith('Timed out waiting for'),
    );
    if (timedOutRequest !== undefined) {
      throw new Error('Timed out cleaning up a pending HTTP request');
    }

    await barrier.queryRunner.query(
      `DROP TRIGGER IF EXISTS ${quoteIdentifier(barrier.triggerName)}
       ON ${quoteIdentifier(barrier.table)}`,
    );
    await barrier.queryRunner.query(
      `DROP FUNCTION IF EXISTS ${quoteIdentifier(barrier.functionName)}()`,
    );
    await barrier.queryRunner.release();
    activeBarriers.delete(barrier);
  }

  async function getAccount(
    session: E2eAuthSession,
    accountId: string,
  ): Promise<ContaResponse> {
    const response = await withAuth(
      request(app.getHttpServer()).get(`/contas/${accountId}`),
      session,
    ).expect(200);

    return unwrapSuccess<ContaResponse>(response);
  }

  async function expectPersistedTransaction(
    transactionId: string,
    accountId: string,
  ): Promise<void> {
    const rows = await appDataSource.query<
      Array<{ contaId: string; id: string }>
    >(
      `SELECT id, conta_id AS "contaId"
       FROM transacao
       WHERE id = $1 AND excluido_em IS NULL`,
      [transactionId],
    );
    expect(rows).toEqual([{ contaId: accountId, id: transactionId }]);
  }

  async function expectPersistedTransfer(
    transferId: string,
    originId: string,
    destinationId: string,
  ): Promise<void> {
    const rows = await appDataSource.query<
      Array<{ destinationId: string; id: string; originId: string }>
    >(
      `SELECT
         id,
         conta_origem_id AS "originId",
         conta_destino_id AS "destinationId"
       FROM transferencia
       WHERE id = $1 AND excluido_em IS NULL`,
      [transferId],
    );
    expect(rows).toEqual([{ destinationId, id: transferId, originId }]);
  }

  async function expectPersistedDebtPayment(
    paymentId: string,
    transactionId: string,
    accountId: string,
  ): Promise<void> {
    const rows = await appDataSource.query<
      Array<{
        paymentId: string;
        paymentAccountId: string;
        transactionId: string;
        transactionAccountId: string;
      }>
    >(
      `SELECT
         payment.id AS "paymentId",
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
        paymentAccountId: accountId,
        paymentId,
        transactionAccountId: accountId,
        transactionId,
      },
    ]);
  }

  async function expectAccountState(
    session: E2eAuthSession,
    accountId: string,
    expectedBalance: number,
    inactive: boolean,
  ): Promise<void> {
    const account = await getAccount(session, accountId);
    expect(account.ativa).toBe(!inactive);
    expect(Number(account.saldoAtual)).toBeCloseTo(expectedBalance, 2);
  }

  function expectInactiveAccountError(response: Response): void {
    expect(response.status).toBe(400);
    expect(response.body as unknown).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CONTA_INACTIVE' }) as object,
        success: false,
      }),
    );
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

  async function countTransfers(userId: string): Promise<number> {
    const [{ count }] = await appDataSource.query<Array<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count
       FROM transferencia
       WHERE usuario_id = $1 AND excluido_em IS NULL`,
      [userId],
    );
    return count;
  }

  async function countDebtPayments(
    userId: string,
    accountId: string,
  ): Promise<number> {
    const [{ count }] = await appDataSource.query<Array<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count
       FROM pagamento_divida
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

  function quoteIdentifier(identifier: string): string {
    if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
      throw new Error(`Invalid PostgreSQL identifier: ${identifier}`);
    }
    return `"${identifier}"`;
  }

  function quoteLiteral(value: string): string {
    return `'${value.replaceAll("'", "''")}'`;
  }

  async function withTimeout<T>(
    promise: Promise<T>,
    description: string,
    timeoutMs = REQUEST_DEADLINE_MS,
  ): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error(`Timed out waiting for ${description}`)),
        timeoutMs,
      );
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }
});
