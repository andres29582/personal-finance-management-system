import request from 'supertest';
import { DataSource } from 'typeorm';
import { TipoCategoria } from './../src/categorias/enums/tipo-categoria.enum';
import { TipoConta } from './../src/contas/enums/tipo-conta.enum';
import { PagoDivida } from './../src/pagos-divida/entities/pago-divida.entity';
import { Transacao } from './../src/transacoes/entities/transacao.entity';
import { TipoTransacao } from './../src/transacoes/enums/tipo-transacao.enum';
import { Transferencia } from './../src/transferencias/entities/transferencia.entity';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import {
  makeRegisterUserPayload,
  makeLoginPayload,
} from './factories/auth.factory';
import { makeCategoriaPayload } from './factories/categoria.factory';
import { makeContaPayload } from './factories/conta.factory';
import { makeDividaPayload } from './factories/divida.factory';
import { makePagoDividaPayload } from './factories/pago-divida.factory';
import { makeTransacaoPayload } from './factories/transacao.factory';
import { makeTransferenciaPayload } from './factories/transferencia.factory';
import { registerAndLoginTestUser, withAuth } from './helpers/auth.e2e-helper';
import {
  ContaResponse,
  expectSaldo,
} from './helpers/financial-assertions.helper';
import {
  createDivida,
  createPagoDivida,
  createTransferencia,
  listContas as listFinancialContas,
} from './helpers/financial-scenario.helper';
import { bearer, Identifiable, unwrapSuccess } from './helpers/http.helper';

type RegisterResponse = {
  usuario: {
    email: string;
    senha?: string;
    senhaHash?: string;
  };
  access_token?: string;
};

type LoginResponse = {
  access_token: string;
  usuario: {
    senha?: string;
    senhaHash?: string;
  };
};

type TransacaoResponse = Identifiable & {
  contaId: string;
  categoriaId: string;
  tipo: TipoTransacao;
  valor: number | string;
};

type PagamentoDividaResponse = Identifiable & {
  transacaoId: string;
};

type ContaDetalheResponse = ContaResponse & {
  ativa: boolean;
  nome: string;
};

type AuditLogResponse = {
  total: number;
  items: Array<{
    event: string;
    success: boolean;
  }>;
};

type FinancialPersistenceSnapshot = {
  paymentIds: string[];
  transactionIds: string[];
  transferIds: string[];
};

jest.setTimeout(60000);

describe('Financial flow (e2e)', () => {
  let app: E2eApplication;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);

    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('protects financial routes with JWT', async () => {
    await request(app.getHttpServer()).get('/contas').expect(401);

    await request(app.getHttpServer())
      .get('/contas')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('reverts account balances when a transfer is soft-deleted', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '68199965000',
      email: 'transferencia.soft-delete.e2e@example.com',
      nome: 'Transferencia Soft Delete E2E',
    });

    const contaOrigem = await createConta(
      session.token,
      makeContaPayload({
        nome: 'Conta origem soft delete',
        tipo: TipoConta.BANCO,
        saldoInicial: 1000,
      }),
    );
    const contaDestino = await createConta(
      session.token,
      makeContaPayload({
        nome: 'Conta destino soft delete',
        tipo: TipoConta.DINHEIRO,
        saldoInicial: 150,
      }),
    );

    let contas = await listFinancialContas(app, session);
    expectSaldo(contas, contaOrigem.id, 1000);
    expectSaldo(contas, contaDestino.id, 150);

    const transferencia = await createTransferencia(app, session, {
      comissao: 15,
      contaDestinoId: contaDestino.id,
      contaOrigemId: contaOrigem.id,
      data: '2026-05-18',
      descricao: 'Transferencia com reversao E2E',
      valor: 200,
    });

    contas = await listFinancialContas(app, session);
    expectSaldo(contas, contaOrigem.id, 785);
    expectSaldo(contas, contaDestino.id, 350);

    await withAuth(
      request(app.getHttpServer()).delete(
        `/transferencias/${transferencia.id}`,
      ),
      session,
    ).expect(200);
    await withAuth(
      request(app.getHttpServer()).get(`/transferencias/${transferencia.id}`),
      session,
    ).expect(404);

    contas = await listFinancialContas(app, session);
    expectSaldo(contas, contaOrigem.id, 1000);
    expectSaldo(contas, contaDestino.id, 150);
  });

  it('reverts account balance and linked transaction when a debt payment is soft-deleted', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '11144477735',
      email: 'pagamento-divida.soft-delete.e2e@example.com',
      nome: 'Pagamento Divida Soft Delete E2E',
    });

    const pagamentoDividaCategoria = await createCategoria(session.token, {
      nome: 'Pagamento divida soft delete',
      tipo: TipoCategoria.DESPESA,
      cor: '#f97316',
      icone: 'receipt',
    });
    const conta = await createConta(
      session.token,
      makeContaPayload({
        nome: 'Conta pagamento soft delete',
        tipo: TipoConta.BANCO,
        saldoInicial: 1000,
      }),
    );
    const divida = await createDivida(app, session, {
      contaId: conta.id,
      montoTotal: 600,
      nome: 'Divida pagamento soft delete',
    });

    let contas = await listFinancialContas(app, session);
    expectSaldo(contas, conta.id, 1000);

    const pagamento = await createPagoDivida(app, session, {
      categoriaId: pagamentoDividaCategoria.id,
      contaId: conta.id,
      data: '2026-05-19',
      descricao: 'Pagamento com reversao E2E',
      dividaId: divida.id,
      valor: 125,
    });

    expect(pagamento.transacaoId).toEqual(expect.any(String));

    contas = await listFinancialContas(app, session);
    expectSaldo(contas, conta.id, 875);

    await withAuth(
      request(app.getHttpServer()).delete(`/pagos-divida/${pagamento.id}`),
      session,
    ).expect(200);
    await withAuth(
      request(app.getHttpServer()).get(`/pagos-divida/${pagamento.id}`),
      session,
    ).expect(404);
    await withAuth(
      request(app.getHttpServer()).get(`/transacoes/${pagamento.transacaoId}`),
      session,
    ).expect(404);

    contas = await listFinancialContas(app, session);
    expectSaldo(contas, conta.id, 1000);
  });

  it('blocks debt payment creation for an inactive debt without financial side effects', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '10000001090',
      email: 'pagamento-divida.inactive-debt.e2e@example.com',
      nome: 'Pagamento Divida Inativa E2E',
    });

    const pagamentoDividaCategoria = await createCategoria(session.token, {
      nome: 'Pagamento divida inativa',
      tipo: TipoCategoria.DESPESA,
      cor: '#f97316',
      icone: 'receipt',
    });
    const conta = await createConta(
      session.token,
      makeContaPayload({
        nome: 'Conta divida inativa',
        tipo: TipoConta.BANCO,
        saldoInicial: 1000,
      }),
    );
    const divida = await createDivida(app, session, {
      contaId: conta.id,
      montoTotal: 600,
      nome: 'Divida inativa E2E',
    });

    await withAuth(
      request(app.getHttpServer()).patch(`/dividas/${divida.id}/desativar`),
      session,
    ).expect(200);

    const rejectedPayment = await withAuth(
      request(app.getHttpServer()).post('/pagos-divida'),
      session,
    )
      .send(
        makePagoDividaPayload({
          categoriaId: pagamentoDividaCategoria.id,
          contaId: conta.id,
          data: '2026-05-20',
          descricao: 'Pagamento rejeitado para divida inativa',
          dividaId: divida.id,
          valor: 125,
        }),
      )
      .expect(400);

    expect(rejectedPayment.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'PAGAMENTO_DIVIDA_INACTIVE_DEBT',
          message:
            'Nao e possivel registrar pagamento para uma divida inativa.',
        }) as { code: string; message: string },
      }),
    );

    const dividaAtual = await withAuth(
      request(app.getHttpServer()).get(`/dividas/${divida.id}`),
      session,
    ).expect(200);
    expect(unwrapSuccess<Record<string, unknown>>(dividaAtual)).toEqual(
      expect.objectContaining({
        ativa: false,
        id: divida.id,
      }),
    );

    const contas = await listFinancialContas(app, session);
    expectSaldo(contas, conta.id, 1000);

    const pagamentosDaDivida = await withAuth(
      request(app.getHttpServer()).get(`/pagos-divida/divida/${divida.id}`),
      session,
    ).expect(200);
    expect(
      unwrapSuccess<PagamentoDividaResponse[]>(pagamentosDaDivida),
    ).toEqual([]);

    const transacoes = await withAuth(
      request(app.getHttpServer()).get('/transacoes'),
      session,
    ).expect(200);
    expect(unwrapSuccess<Identifiable[]>(transacoes)).toEqual([]);
  });

  it('enforces active accounts for financial writes while preserving history and reactivation', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '31415926590',
      email: 'conta.inativa.e2e@example.com',
      nome: 'Conta Inativa E2E',
    });
    const otherSession = await registerAndLoginTestUser(app, {
      cpf: '27182818205',
      email: 'conta.inativa.outro.usuario.e2e@example.com',
      nome: 'Outro Usuario Conta Inativa E2E',
    });

    const expenseCategory = await createCategoria(
      session.token,
      makeCategoriaPayload({
        nome: 'Despesa conta inativa E2E',
        tipo: TipoCategoria.DESPESA,
      }),
    );
    const incomeCategory = await createCategoria(
      session.token,
      makeCategoriaPayload({
        nome: 'Receita conta reativada E2E',
        tipo: TipoCategoria.RECEITA,
      }),
    );
    const accountToDeactivate = await createConta(
      session.token,
      makeContaPayload({
        nome: 'Conta que sera desativada E2E',
        saldoInicial: 1000,
        tipo: TipoConta.BANCO,
      }),
    );
    const activeAccount = await createConta(
      session.token,
      makeContaPayload({
        nome: 'Conta ativa contraparte E2E',
        saldoInicial: 250,
        tipo: TipoConta.DINHEIRO,
      }),
    );
    const otherUserAccount = await createConta(
      otherSession.token,
      makeContaPayload({
        nome: 'Conta alheia E2E',
        saldoInicial: 700,
        tipo: TipoConta.BANCO,
      }),
    );

    const historicalTransactionResponse = await withAuth(
      request(app.getHttpServer()).post('/transacoes'),
      session,
    )
      .send(
        makeTransacaoPayload({
          categoriaId: expenseCategory.id,
          contaId: accountToDeactivate.id,
          data: '2026-06-01',
          descricao: 'Transacao historica conta inativa E2E',
          tipo: TipoTransacao.DESPESA,
          valor: 100,
        }),
      )
      .expect(201);
    const historicalTransaction = unwrapSuccess<TransacaoResponse>(
      historicalTransactionResponse,
    );

    const activeAccountTransactionResponse = await withAuth(
      request(app.getHttpServer()).post('/transacoes'),
      session,
    )
      .send(
        makeTransacaoPayload({
          categoriaId: expenseCategory.id,
          contaId: activeAccount.id,
          data: '2026-06-01',
          descricao: 'Transacao historica conta ativa E2E',
          tipo: TipoTransacao.DESPESA,
          valor: 20,
        }),
      )
      .expect(201);
    const activeAccountTransaction = unwrapSuccess<TransacaoResponse>(
      activeAccountTransactionResponse,
    );

    const historicalOriginInactiveTransfer = await createTransferencia(
      app,
      session,
      {
        comissao: 5,
        contaDestinoId: activeAccount.id,
        contaOrigemId: accountToDeactivate.id,
        data: '2026-06-02',
        descricao: 'Transferencia historica origem inativa E2E',
        valor: 50,
      },
    );
    const historicalDestinationInactiveTransfer = await createTransferencia(
      app,
      session,
      {
        comissao: 2,
        contaDestinoId: accountToDeactivate.id,
        contaOrigemId: activeAccount.id,
        data: '2026-06-02',
        descricao: 'Transferencia historica destino inativo E2E',
        valor: 30,
      },
    );
    const debt = await createDivida(app, session, {
      contaId: accountToDeactivate.id,
      montoTotal: 500,
      nome: 'Divida historica conta inativa E2E',
    });
    const historicalPayment = await createPagoDivida(app, session, {
      categoriaId: expenseCategory.id,
      contaId: accountToDeactivate.id,
      data: '2026-06-03',
      descricao: 'Pagamento historico conta inativa E2E',
      dividaId: debt.id,
      valor: 75,
    });

    let activeAccounts = await listContas(session.token);
    expectSaldo(activeAccounts, accountToDeactivate.id, 800);
    expectSaldo(activeAccounts, activeAccount.id, 248);

    await withAuth(
      request(app.getHttpServer()).patch(
        `/contas/${accountToDeactivate.id}/desativar`,
      ),
      session,
    ).expect(200);

    activeAccounts = await listContas(session.token);
    expect(activeAccounts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: accountToDeactivate.id }),
      ]),
    );
    expectSaldo(activeAccounts, activeAccount.id, 248);

    const inactiveAccount = await getConta(
      session.token,
      accountToDeactivate.id,
    );
    expect(inactiveAccount).toEqual(
      expect.objectContaining({
        ativa: false,
        id: accountToDeactivate.id,
        nome: 'Conta que sera desativada E2E',
      }),
    );
    expect(Number(inactiveAccount.saldoAtual)).toBeCloseTo(800, 2);

    await withAuth(
      request(app.getHttpServer()).get(
        `/transacoes/${historicalTransaction.id}`,
      ),
      session,
    ).expect(200);
    await withAuth(
      request(app.getHttpServer()).get(
        `/transacoes/${activeAccountTransaction.id}`,
      ),
      session,
    ).expect(200);
    await withAuth(
      request(app.getHttpServer()).get(
        `/transferencias/${historicalOriginInactiveTransfer.id}`,
      ),
      session,
    ).expect(200);
    await withAuth(
      request(app.getHttpServer()).get(
        `/transferencias/${historicalDestinationInactiveTransfer.id}`,
      ),
      session,
    ).expect(200);
    await withAuth(
      request(app.getHttpServer()).get(`/pagos-divida/${historicalPayment.id}`),
      session,
    ).expect(200);

    const stateBeforeRejections = {
      auditEvents: await countSuccessfulAuditEvents(session.token, [
        'TRANSACAO_CREATED',
        'TRANSACAO_UPDATED',
        'TRANSFERENCIA_CREATED',
        'TRANSFERENCIA_UPDATED',
        'PAGAMENTO_DIVIDA_CREATED',
      ]),
      paymentIds: await listEntityIds(
        session.token,
        `/pagos-divida/divida/${debt.id}`,
      ),
      persistedRows: await snapshotPersistedFinancialRows(session.userId),
      transactionIds: await listEntityIds(session.token, '/transacoes'),
      transferIds: await listEntityIds(session.token, '/transferencias'),
    };
    const expectedHistoricalRows: FinancialPersistenceSnapshot = {
      paymentIds: [historicalPayment.id],
      transactionIds: [
        activeAccountTransaction.id,
        historicalPayment.transacaoId,
        historicalTransaction.id,
      ].sort(),
      transferIds: [
        historicalDestinationInactiveTransfer.id,
        historicalOriginInactiveTransfer.id,
      ].sort(),
    };
    expect(stateBeforeRejections.auditEvents).toEqual({
      PAGAMENTO_DIVIDA_CREATED: 1,
      TRANSACAO_CREATED: 2,
      TRANSACAO_UPDATED: 0,
      TRANSFERENCIA_CREATED: 2,
      TRANSFERENCIA_UPDATED: 0,
    });
    expect(stateBeforeRejections.paymentIds).toEqual(
      expectedHistoricalRows.paymentIds,
    );
    expect(stateBeforeRejections.transactionIds).toEqual(
      expectedHistoricalRows.transactionIds,
    );
    expect(stateBeforeRejections.transferIds).toEqual(
      expectedHistoricalRows.transferIds,
    );
    expect(stateBeforeRejections.persistedRows).toEqual(expectedHistoricalRows);

    const inactiveTransaction = await withAuth(
      request(app.getHttpServer()).post('/transacoes'),
      session,
    )
      .send(
        makeTransacaoPayload({
          categoriaId: expenseCategory.id,
          contaId: accountToDeactivate.id,
          data: '2026-06-04',
          descricao: 'Transacao rejeitada conta inativa E2E',
          tipo: TipoTransacao.DESPESA,
          valor: 125,
        }),
      )
      .expect(400);
    expectApiError(
      inactiveTransaction,
      'CONTA_INACTIVE',
      'Não é possível realizar operações financeiras em uma conta inativa.',
    );

    const inactiveTransactionUpdate = await withAuth(
      request(app.getHttpServer()).patch(
        `/transacoes/${historicalTransaction.id}`,
      ),
      session,
    )
      .send({
        descricao: 'Transacao historica alterada indevidamente',
        valor: 175,
      })
      .expect(400);
    expectApiError(
      inactiveTransactionUpdate,
      'CONTA_INACTIVE',
      'Não é possível realizar operações financeiras em uma conta inativa.',
    );

    const moveTransactionToInactiveAccount = await withAuth(
      request(app.getHttpServer()).patch(
        `/transacoes/${activeAccountTransaction.id}`,
      ),
      session,
    )
      .send({
        contaId: accountToDeactivate.id,
        descricao: 'Transacao movida indevidamente para conta inativa',
      })
      .expect(400);
    expectApiError(
      moveTransactionToInactiveAccount,
      'CONTA_INACTIVE',
      'Não é possível realizar operações financeiras em uma conta inativa.',
    );

    const inactiveOriginTransfer = await withAuth(
      request(app.getHttpServer()).post('/transferencias'),
      session,
    )
      .send(
        makeTransferenciaPayload({
          comissao: 2,
          contaDestinoId: activeAccount.id,
          contaOrigemId: accountToDeactivate.id,
          data: '2026-06-05',
          descricao: 'Transferencia rejeitada origem inativa E2E',
          valor: 40,
        }),
      )
      .expect(400);
    expectApiError(
      inactiveOriginTransfer,
      'CONTA_INACTIVE',
      'Não é possível realizar operações financeiras em uma conta inativa.',
    );

    const inactiveDestinationTransfer = await withAuth(
      request(app.getHttpServer()).post('/transferencias'),
      session,
    )
      .send(
        makeTransferenciaPayload({
          comissao: 0,
          contaDestinoId: accountToDeactivate.id,
          contaOrigemId: activeAccount.id,
          data: '2026-06-06',
          descricao: 'Transferencia rejeitada destino inativo E2E',
          valor: 30,
        }),
      )
      .expect(400);
    expectApiError(
      inactiveDestinationTransfer,
      'CONTA_INACTIVE',
      'Não é possível realizar operações financeiras em uma conta inativa.',
    );

    const inactiveOriginTransferUpdate = await withAuth(
      request(app.getHttpServer()).patch(
        `/transferencias/${historicalOriginInactiveTransfer.id}`,
      ),
      session,
    )
      .send({
        descricao: 'Transferencia com origem inativa alterada indevidamente',
        valor: 90,
      })
      .expect(400);
    expectApiError(
      inactiveOriginTransferUpdate,
      'CONTA_INACTIVE',
      'Não é possível realizar operações financeiras em uma conta inativa.',
    );

    const inactiveDestinationTransferUpdate = await withAuth(
      request(app.getHttpServer()).patch(
        `/transferencias/${historicalDestinationInactiveTransfer.id}`,
      ),
      session,
    )
      .send({
        descricao: 'Transferencia com destino inativo alterada indevidamente',
        valor: 95,
      })
      .expect(400);
    expectApiError(
      inactiveDestinationTransferUpdate,
      'CONTA_INACTIVE',
      'Não é possível realizar operações financeiras em uma conta inativa.',
    );

    const inactiveDebtPayment = await withAuth(
      request(app.getHttpServer()).post('/pagos-divida'),
      session,
    )
      .send(
        makePagoDividaPayload({
          categoriaId: expenseCategory.id,
          contaId: accountToDeactivate.id,
          data: '2026-06-07',
          descricao: 'Pagamento rejeitado conta inativa E2E',
          dividaId: debt.id,
          valor: 60,
        }),
      )
      .expect(400);
    expectApiError(
      inactiveDebtPayment,
      'CONTA_INACTIVE',
      'Não é possível realizar operações financeiras em uma conta inativa.',
    );

    const foreignAccountTransaction = await withAuth(
      request(app.getHttpServer()).post('/transacoes'),
      session,
    )
      .send(
        makeTransacaoPayload({
          categoriaId: expenseCategory.id,
          contaId: otherUserAccount.id,
          data: '2026-06-08',
          descricao: 'Transacao rejeitada conta alheia E2E',
          tipo: TipoTransacao.DESPESA,
          valor: 25,
        }),
      )
      .expect(404);
    expectApiError(
      foreignAccountTransaction,
      'CONTA_NOT_FOUND',
      'Conta não encontrada',
    );

    const missingAccountId = '00000000-0000-4000-8000-000000000001';
    const missingAccountTransaction = await withAuth(
      request(app.getHttpServer()).post('/transacoes'),
      session,
    )
      .send(
        makeTransacaoPayload({
          categoriaId: expenseCategory.id,
          contaId: missingAccountId,
          data: '2026-06-09',
          descricao: 'Transacao rejeitada conta inexistente E2E',
          tipo: TipoTransacao.DESPESA,
          valor: 25,
        }),
      )
      .expect(404);
    expectApiError(
      missingAccountTransaction,
      'CONTA_NOT_FOUND',
      'Conta não encontrada',
    );

    const mixedOwnershipTransfer = await withAuth(
      request(app.getHttpServer()).post('/transferencias'),
      session,
    )
      .send(
        makeTransferenciaPayload({
          contaDestinoId: otherUserAccount.id,
          contaOrigemId: accountToDeactivate.id,
          data: '2026-06-10',
          descricao: 'Transferencia rejeitada sem revelar conta alheia E2E',
          valor: 20,
        }),
      )
      .expect(404);
    expectApiError(
      mixedOwnershipTransfer,
      'CONTA_NOT_FOUND',
      'Conta não encontrada',
    );

    const stateAfterRejections = {
      auditEvents: await countSuccessfulAuditEvents(session.token, [
        'TRANSACAO_CREATED',
        'TRANSACAO_UPDATED',
        'TRANSFERENCIA_CREATED',
        'TRANSFERENCIA_UPDATED',
        'PAGAMENTO_DIVIDA_CREATED',
      ]),
      paymentIds: await listEntityIds(
        session.token,
        `/pagos-divida/divida/${debt.id}`,
      ),
      persistedRows: await snapshotPersistedFinancialRows(session.userId),
      transactionIds: await listEntityIds(session.token, '/transacoes'),
      transferIds: await listEntityIds(session.token, '/transferencias'),
    };
    expect(stateAfterRejections).toEqual(stateBeforeRejections);

    const transactionAfterRejectedPatch = await withAuth(
      request(app.getHttpServer()).get(
        `/transacoes/${historicalTransaction.id}`,
      ),
      session,
    ).expect(200);
    const transactionAfterRejectedPatchData = unwrapSuccess<
      TransacaoResponse & { descricao: string }
    >(transactionAfterRejectedPatch);
    expect(transactionAfterRejectedPatchData).toEqual(
      expect.objectContaining({
        descricao: 'Transacao historica conta inativa E2E',
      }),
    );
    expect(Number(transactionAfterRejectedPatchData.valor)).toBeCloseTo(100, 2);

    const movedTransactionAfterRejectedPatch = await withAuth(
      request(app.getHttpServer()).get(
        `/transacoes/${activeAccountTransaction.id}`,
      ),
      session,
    ).expect(200);
    const movedTransactionAfterRejectedPatchData = unwrapSuccess<
      TransacaoResponse & { descricao: string }
    >(movedTransactionAfterRejectedPatch);
    expect(movedTransactionAfterRejectedPatchData).toEqual(
      expect.objectContaining({
        contaId: activeAccount.id,
        descricao: 'Transacao historica conta ativa E2E',
      }),
    );
    expect(Number(movedTransactionAfterRejectedPatchData.valor)).toBeCloseTo(
      20,
      2,
    );

    const originTransferAfterRejectedPatch = await withAuth(
      request(app.getHttpServer()).get(
        `/transferencias/${historicalOriginInactiveTransfer.id}`,
      ),
      session,
    ).expect(200);
    const originTransferAfterRejectedPatchData = unwrapSuccess<{
      descricao: string;
      valor: number | string;
    }>(originTransferAfterRejectedPatch);
    expect(originTransferAfterRejectedPatchData).toEqual(
      expect.objectContaining({
        descricao: 'Transferencia historica origem inativa E2E',
      }),
    );
    expect(Number(originTransferAfterRejectedPatchData.valor)).toBeCloseTo(
      50,
      2,
    );

    const destinationTransferAfterRejectedPatch = await withAuth(
      request(app.getHttpServer()).get(
        `/transferencias/${historicalDestinationInactiveTransfer.id}`,
      ),
      session,
    ).expect(200);
    const destinationTransferAfterRejectedPatchData = unwrapSuccess<{
      descricao: string;
      valor: number | string;
    }>(destinationTransferAfterRejectedPatch);
    expect(destinationTransferAfterRejectedPatchData).toEqual(
      expect.objectContaining({
        descricao: 'Transferencia historica destino inativo E2E',
      }),
    );
    expect(Number(destinationTransferAfterRejectedPatchData.valor)).toBeCloseTo(
      30,
      2,
    );

    const accountAfterRejections = await getConta(
      session.token,
      accountToDeactivate.id,
    );
    const activeAccountAfterRejections = await getConta(
      session.token,
      activeAccount.id,
    );
    expect(Number(accountAfterRejections.saldoAtual)).toBeCloseTo(800, 2);
    expect(Number(activeAccountAfterRejections.saldoAtual)).toBeCloseTo(248, 2);

    await withAuth(
      request(app.getHttpServer()).delete(
        `/transacoes/${historicalTransaction.id}`,
      ),
      session,
    ).expect(200);
    await withAuth(
      request(app.getHttpServer()).delete(
        `/transferencias/${historicalOriginInactiveTransfer.id}`,
      ),
      session,
    ).expect(200);
    await withAuth(
      request(app.getHttpServer()).delete(
        `/transferencias/${historicalDestinationInactiveTransfer.id}`,
      ),
      session,
    ).expect(200);
    await withAuth(
      request(app.getHttpServer()).delete(
        `/pagos-divida/${historicalPayment.id}`,
      ),
      session,
    ).expect(200);

    await withAuth(
      request(app.getHttpServer()).get(
        `/transacoes/${historicalTransaction.id}`,
      ),
      session,
    ).expect(404);
    await withAuth(
      request(app.getHttpServer()).get(
        `/transferencias/${historicalOriginInactiveTransfer.id}`,
      ),
      session,
    ).expect(404);
    await withAuth(
      request(app.getHttpServer()).get(
        `/transferencias/${historicalDestinationInactiveTransfer.id}`,
      ),
      session,
    ).expect(404);
    await withAuth(
      request(app.getHttpServer()).get(`/pagos-divida/${historicalPayment.id}`),
      session,
    ).expect(404);
    await withAuth(
      request(app.getHttpServer()).get(
        `/transacoes/${historicalPayment.transacaoId}`,
      ),
      session,
    ).expect(404);

    const accountAfterInactiveDeletes = await getConta(
      session.token,
      accountToDeactivate.id,
    );
    const activeAccountAfterInactiveDeletes = await getConta(
      session.token,
      activeAccount.id,
    );
    expect(accountAfterInactiveDeletes.ativa).toBe(false);
    expect(Number(accountAfterInactiveDeletes.saldoAtual)).toBeCloseTo(1000, 2);
    expect(Number(activeAccountAfterInactiveDeletes.saldoAtual)).toBeCloseTo(
      230,
      2,
    );
    expect(await listEntityIds(session.token, '/transacoes')).toEqual([
      activeAccountTransaction.id,
    ]);
    expect(await listEntityIds(session.token, '/transferencias')).toEqual([]);
    expect(
      await listEntityIds(session.token, `/pagos-divida/divida/${debt.id}`),
    ).toEqual([]);

    await withAuth(
      request(app.getHttpServer()).delete(
        `/transacoes/${activeAccountTransaction.id}`,
      ),
      session,
    ).expect(200);
    await withAuth(
      request(app.getHttpServer()).get(
        `/transacoes/${activeAccountTransaction.id}`,
      ),
      session,
    ).expect(404);
    const activeAccountAfterCleanup = await getConta(
      session.token,
      activeAccount.id,
    );
    expect(Number(activeAccountAfterCleanup.saldoAtual)).toBeCloseTo(250, 2);
    expect(await listEntityIds(session.token, '/transacoes')).toEqual([]);

    const reactivationResponse = await withAuth(
      request(app.getHttpServer()).patch(`/contas/${accountToDeactivate.id}`),
      session,
    )
      .send({ ativa: true })
      .expect(200);
    expect(unwrapSuccess<ContaDetalheResponse>(reactivationResponse)).toEqual(
      expect.objectContaining({
        ativa: true,
        id: accountToDeactivate.id,
      }),
    );

    activeAccounts = await listContas(session.token);
    expectSaldo(activeAccounts, accountToDeactivate.id, 1000);

    const transactionAfterReactivation = await withAuth(
      request(app.getHttpServer()).post('/transacoes'),
      session,
    )
      .send(
        makeTransacaoPayload({
          categoriaId: incomeCategory.id,
          contaId: accountToDeactivate.id,
          data: '2026-06-11',
          descricao: 'Transacao apos reativacao E2E',
          tipo: TipoTransacao.RECEITA,
          valor: 40,
        }),
      )
      .expect(201);
    const transactionAfterReactivationData = unwrapSuccess<TransacaoResponse>(
      transactionAfterReactivation,
    );
    expect(transactionAfterReactivationData).toEqual(
      expect.objectContaining({
        contaId: accountToDeactivate.id,
        tipo: TipoTransacao.RECEITA,
      }),
    );
    expect(Number(transactionAfterReactivationData.valor)).toBeCloseTo(40, 2);

    activeAccounts = await listContas(session.token);
    expectSaldo(activeAccounts, accountToDeactivate.id, 1040);
  });

  it('covers the critical MVP financial lifecycle in PostgreSQL', async () => {
    const userAPassword = 'SenhaForte123';
    const userBPassword = 'OutraSenha123';

    const userARegistration = await request(app.getHttpServer())
      .post('/auth/register')
      .send(
        makeRegisterUserPayload({
          nome: 'Usuario A E2E',
          email: 'usuario.a.e2e@example.com',
          cpf: '52998224725',
          endereco: 'Rua A',
          senha: userAPassword,
        }),
      )
      .expect(201);

    const userARegistrationData =
      unwrapSuccess<RegisterResponse>(userARegistration);

    expect(userARegistrationData.usuario).toEqual(
      expect.objectContaining({
        email: 'usuario.a.e2e@example.com',
      }),
    );
    expect(userARegistrationData.usuario.senha).toBeUndefined();
    expect(userARegistrationData.usuario.senhaHash).toBeUndefined();
    expect(userARegistrationData.access_token).toBeUndefined();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(
        makeRegisterUserPayload({
          nome: 'Usuario B E2E',
          email: 'usuario.b.e2e@example.com',
          cpf: '39053344705',
          cep: '20040002',
          endereco: 'Rua B',
          numero: '200',
          cidade: 'Rio de Janeiro',
          senha: userBPassword,
        }),
      )
      .expect(201);

    const invalidLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send(
        makeLoginPayload({
          email: 'usuario.a.e2e@example.com',
          senha: 'senha-incorreta',
        }),
      )
      .expect(401);
    expect(invalidLogin.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'AUTH_INVALID_CREDENTIALS',
        }) as { code: string },
      }),
    );

    const userALogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send(
        makeLoginPayload({
          email: 'usuario.a.e2e@example.com',
          senha: userAPassword,
        }),
      )
      .expect(200);
    const userALoginData = unwrapSuccess<LoginResponse>(userALogin);
    const tokenA = userALoginData.access_token;

    const userBLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send(
        makeLoginPayload({
          email: 'usuario.b.e2e@example.com',
          senha: userBPassword,
        }),
      )
      .expect(200);
    const userBLoginData = unwrapSuccess<LoginResponse>(userBLogin);
    const tokenB = userBLoginData.access_token;

    expect(tokenA).toEqual(expect.any(String));
    expect(tokenB).toEqual(expect.any(String));
    expect(userALoginData.usuario.senha).toBeUndefined();
    expect(userALoginData.usuario.senhaHash).toBeUndefined();

    const receitaCategoria = await createCategoria(
      tokenA,
      makeCategoriaPayload({
        nome: 'Receita E2E',
        tipo: TipoCategoria.RECEITA,
        cor: '#16a34a',
        icone: 'wallet',
      }),
    );
    const despesaCategoria = await createCategoria(
      tokenA,
      makeCategoriaPayload({
        nome: 'Despesa E2E',
        tipo: TipoCategoria.DESPESA,
        cor: '#dc2626',
        icone: 'shopping-cart',
      }),
    );
    const pagamentoDividaCategoria = await createCategoria(tokenA, {
      nome: 'Pagamento Divida E2E',
      tipo: TipoCategoria.DESPESA,
      cor: '#f97316',
      icone: 'receipt',
    });

    const contaOrigem = await createConta(
      tokenA,
      makeContaPayload({
        nome: 'Conta Origem E2E',
        tipo: TipoConta.BANCO,
        saldoInicial: 1000,
      }),
    );
    const contaDestino = await createConta(
      tokenA,
      makeContaPayload({
        nome: 'Conta Destino E2E',
        tipo: TipoConta.DINHEIRO,
        saldoInicial: 200,
      }),
    );
    const contaUsuarioB = await createConta(
      tokenB,
      makeContaPayload({
        nome: 'Conta Usuario B E2E',
        tipo: TipoConta.BANCO,
        saldoInicial: 999,
      }),
    );

    const receitaResponse = await request(app.getHttpServer())
      .post('/transacoes')
      .set(bearer(tokenA))
      .send(
        makeTransacaoPayload({
          contaId: contaOrigem.id,
          categoriaId: receitaCategoria.id,
          tipo: TipoTransacao.RECEITA,
          valor: 500,
          data: '2026-05-01',
          descricao: 'Receita E2E',
        }),
      )
      .expect(201);
    const receita = unwrapSuccess<Identifiable>(receitaResponse);

    const despesaResponse = await request(app.getHttpServer())
      .post('/transacoes')
      .set(bearer(tokenA))
      .send(
        makeTransacaoPayload({
          contaId: contaOrigem.id,
          categoriaId: despesaCategoria.id,
          tipo: TipoTransacao.DESPESA,
          valor: 150,
          data: '2026-05-02',
          descricao: 'Despesa E2E',
        }),
      )
      .expect(201);
    const despesa = unwrapSuccess<Identifiable>(despesaResponse);

    let contasUsuarioA = await listContas(tokenA);
    expectSaldo(contasUsuarioA, contaOrigem.id, 1350);
    expectSaldo(contasUsuarioA, contaDestino.id, 200);

    const contasUsuarioB = await listContas(tokenB);
    expect(contasUsuarioB).toEqual([
      expect.objectContaining({ id: contaUsuarioB.id }),
    ]);
    expect(contasUsuarioB).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: contaOrigem.id })]),
    );

    await request(app.getHttpServer())
      .get(`/contas/${contaOrigem.id}`)
      .set(bearer(tokenB))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/transacoes/${receita.id}`)
      .set(bearer(tokenB))
      .expect(404);
    await request(app.getHttpServer())
      .post('/transferencias')
      .set(bearer(tokenA))
      .send(
        makeTransferenciaPayload({
          contaOrigemId: contaOrigem.id,
          contaDestinoId: contaUsuarioB.id,
          valor: 50,
          comissao: 0,
          data: '2026-05-03',
        }),
      )
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/transacoes/${despesa.id}`)
      .set(bearer(tokenA))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/transacoes/${despesa.id}`)
      .set(bearer(tokenA))
      .expect(404);

    const transacoes = await request(app.getHttpServer())
      .get('/transacoes')
      .set(bearer(tokenA))
      .expect(200);
    const transacoesData = unwrapSuccess<Identifiable[]>(transacoes);
    expect(transacoesData).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: receita.id })]),
    );
    expect(transacoesData).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: despesa.id })]),
    );

    contasUsuarioA = await listContas(tokenA);
    expectSaldo(contasUsuarioA, contaOrigem.id, 1500);
    expectSaldo(contasUsuarioA, contaDestino.id, 200);

    const transferenciaResponse = await request(app.getHttpServer())
      .post('/transferencias')
      .set(bearer(tokenA))
      .send(
        makeTransferenciaPayload({
          contaOrigemId: contaOrigem.id,
          contaDestinoId: contaDestino.id,
          valor: 200,
          comissao: 5,
          data: '2026-05-04',
          descricao: 'Transferencia E2E',
        }),
      )
      .expect(201);
    const transferencia = unwrapSuccess<
      Identifiable & { contaOrigemId: string; contaDestinoId: string }
    >(transferenciaResponse);

    expect(transferencia).toEqual(
      expect.objectContaining({
        contaOrigemId: contaOrigem.id,
        contaDestinoId: contaDestino.id,
      }),
    );

    contasUsuarioA = await listContas(tokenA);
    expectSaldo(contasUsuarioA, contaOrigem.id, 1295);
    expectSaldo(contasUsuarioA, contaDestino.id, 400);

    const dividaResponse = await request(app.getHttpServer())
      .post('/dividas')
      .set(bearer(tokenA))
      .send(
        makeDividaPayload({
          contaId: contaOrigem.id,
        }),
      )
      .expect(201);
    const divida = unwrapSuccess<Identifiable>(dividaResponse);

    const pagamentoResponse = await request(app.getHttpServer())
      .post('/pagos-divida')
      .set(bearer(tokenA))
      .send(
        makePagoDividaPayload({
          dividaId: divida.id,
          contaId: contaOrigem.id,
          categoriaId: pagamentoDividaCategoria.id,
        }),
      )
      .expect(201);
    const pagamento = unwrapSuccess<PagamentoDividaResponse>(pagamentoResponse);

    expect(pagamento.transacaoId).toEqual(expect.any(String));

    const transacaoPagamento = await request(app.getHttpServer())
      .get(`/transacoes/${pagamento.transacaoId}`)
      .set(bearer(tokenA))
      .expect(200);
    const transacaoPagamentoData =
      unwrapSuccess<TransacaoResponse>(transacaoPagamento);
    expect(transacaoPagamentoData).toEqual(
      expect.objectContaining({
        id: pagamento.transacaoId,
        contaId: contaOrigem.id,
        categoriaId: pagamentoDividaCategoria.id,
        tipo: TipoTransacao.DESPESA,
      }),
    );
    expect(Number(transacaoPagamentoData.valor)).toBeCloseTo(100, 2);

    const pagamentosDaDivida = await request(app.getHttpServer())
      .get(`/pagos-divida/divida/${divida.id}`)
      .set(bearer(tokenA))
      .expect(200);
    const pagamentosDaDividaData =
      unwrapSuccess<PagamentoDividaResponse[]>(pagamentosDaDivida);
    expect(pagamentosDaDividaData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: pagamento.id,
          transacaoId: pagamento.transacaoId,
        }),
      ]),
    );

    await request(app.getHttpServer())
      .get(`/pagos-divida/${pagamento.id}`)
      .set(bearer(tokenB))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/transacoes/${pagamento.transacaoId}`)
      .set(bearer(tokenB))
      .expect(404);

    contasUsuarioA = await listContas(tokenA);
    expectSaldo(contasUsuarioA, contaOrigem.id, 1195);
    expectSaldo(contasUsuarioA, contaDestino.id, 400);
  });

  async function createCategoria(
    token: string,
    body: Record<string, unknown>,
  ): Promise<Identifiable> {
    const response = await request(app.getHttpServer())
      .post('/categorias')
      .set(bearer(token))
      .send(body)
      .expect(201);

    return unwrapSuccess<Identifiable>(response);
  }

  async function createConta(
    token: string,
    body: Record<string, unknown>,
  ): Promise<Identifiable> {
    const response = await request(app.getHttpServer())
      .post('/contas')
      .set(bearer(token))
      .send(body)
      .expect(201);

    return unwrapSuccess<Identifiable>(response);
  }

  async function listContas(token: string): Promise<ContaResponse[]> {
    const response = await request(app.getHttpServer())
      .get('/contas')
      .set(bearer(token))
      .expect(200);

    return unwrapSuccess<ContaResponse[]>(response);
  }

  async function getConta(
    token: string,
    contaId: string,
  ): Promise<ContaDetalheResponse> {
    const response = await request(app.getHttpServer())
      .get(`/contas/${contaId}`)
      .set(bearer(token))
      .expect(200);

    return unwrapSuccess<ContaDetalheResponse>(response);
  }

  async function listEntityIds(token: string, path: string): Promise<string[]> {
    const response = await request(app.getHttpServer())
      .get(path)
      .set(bearer(token))
      .expect(200);

    return unwrapSuccess<Identifiable[]>(response)
      .map((entity) => entity.id)
      .sort();
  }

  async function snapshotPersistedFinancialRows(
    usuarioId: string,
  ): Promise<FinancialPersistenceSnapshot> {
    const dataSource = app.get(DataSource);
    const [payments, transactions, transfers] = await Promise.all([
      dataSource.getRepository(PagoDivida).find({ where: { usuarioId } }),
      dataSource.getRepository(Transacao).find({ where: { usuarioId } }),
      dataSource.getRepository(Transferencia).find({ where: { usuarioId } }),
    ]);

    return {
      paymentIds: payments.map((payment) => payment.id).sort(),
      transactionIds: transactions.map((transaction) => transaction.id).sort(),
      transferIds: transfers.map((transfer) => transfer.id).sort(),
    };
  }

  async function countSuccessfulAuditEvents(
    token: string,
    events: string[],
  ): Promise<Record<string, number>> {
    const response = await request(app.getHttpServer())
      .get('/audit-logs?limit=100')
      .set(bearer(token))
      .expect(200);
    const auditLogs = unwrapSuccess<AuditLogResponse>(response);

    return Object.fromEntries(
      events.map((event) => [
        event,
        auditLogs.items.filter(
          (auditLog) => auditLog.event === event && auditLog.success,
        ).length,
      ]),
    );
  }

  function expectApiError(
    response: { body: unknown },
    code: string,
    message: string,
  ): void {
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code, message }) as {
          code: string;
          message: string;
        },
      }),
    );
  }
});
