import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TipoCategoria } from './../src/categorias/enums/tipo-categoria.enum';
import { TipoConta } from './../src/contas/enums/tipo-conta.enum';
import { TipoTransacao } from './../src/transacoes/enums/tipo-transacao.enum';
import { createE2eApp } from './e2e-app';
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

jest.setTimeout(60000);

describe('Financial flow (e2e)', () => {
  let app: INestApplication;

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
      request(app.getHttpServer()).get(
        `/transacoes/${pagamento.transacaoId}`,
      ),
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
    expect(unwrapSuccess<PagamentoDividaResponse[]>(pagamentosDaDivida)).toEqual(
      [],
    );

    const transacoes = await withAuth(
      request(app.getHttpServer()).get('/transacoes'),
      session,
    ).expect(200);
    expect(unwrapSuccess<Identifiable[]>(transacoes)).toEqual([]);
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
});
