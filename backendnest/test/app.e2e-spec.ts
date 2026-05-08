import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { TipoCategoria } from './../src/categorias/enums/tipo-categoria.enum';
import { TipoConta } from './../src/contas/enums/tipo-conta.enum';
import { TipoTransacao } from './../src/transacoes/enums/tipo-transacao.enum';
import {
  configureE2eEnvironment,
  prepareE2eDatabase,
} from './e2e-database';

type Identifiable = {
  id: string;
};

type ContaResponse = Identifiable & {
  saldoAtual: number | string;
};

jest.setTimeout(60000);

describe('Financial flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
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

  it('covers the critical MVP financial lifecycle in PostgreSQL', async () => {
    const userAPassword = 'SenhaForte123';
    const userBPassword = 'OutraSenha123';

    const userARegistration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nome: 'Usuario A E2E',
        email: 'usuario.a.e2e@example.com',
        cpf: '52998224725',
        cep: '01001000',
        endereco: 'Rua A',
        numero: '100',
        cidade: 'Sao Paulo',
        senha: userAPassword,
        aceitoPoliticaPrivacidade: true,
      })
      .expect(201);

    expect(userARegistration.body.usuario).toEqual(
      expect.objectContaining({
        email: 'usuario.a.e2e@example.com',
      }),
    );
    expect(userARegistration.body.usuario.senha).toBeUndefined();
    expect(userARegistration.body.usuario.senhaHash).toBeUndefined();
    expect(userARegistration.body.access_token).toBeUndefined();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nome: 'Usuario B E2E',
        email: 'usuario.b.e2e@example.com',
        cpf: '39053344705',
        cep: '20040002',
        endereco: 'Rua B',
        numero: '200',
        cidade: 'Rio de Janeiro',
        senha: userBPassword,
        aceitoPoliticaPrivacidade: true,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'usuario.a.e2e@example.com',
        senha: 'senha-incorreta',
      })
      .expect(401);

    const userALogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'usuario.a.e2e@example.com',
        senha: userAPassword,
      })
      .expect(200);
    const tokenA = userALogin.body.access_token as string;

    const userBLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'usuario.b.e2e@example.com',
        senha: userBPassword,
      })
      .expect(200);
    const tokenB = userBLogin.body.access_token as string;

    expect(tokenA).toEqual(expect.any(String));
    expect(tokenB).toEqual(expect.any(String));
    expect(userALogin.body.usuario.senha).toBeUndefined();
    expect(userALogin.body.usuario.senhaHash).toBeUndefined();

    const receitaCategoria = await createCategoria(tokenA, {
      nome: 'Receita E2E',
      tipo: TipoCategoria.RECEITA,
      cor: '#16a34a',
      icone: 'wallet',
    });
    const despesaCategoria = await createCategoria(tokenA, {
      nome: 'Despesa E2E',
      tipo: TipoCategoria.DESPESA,
      cor: '#dc2626',
      icone: 'shopping-cart',
    });
    const pagamentoDividaCategoria = await createCategoria(tokenA, {
      nome: 'Pagamento Divida E2E',
      tipo: TipoCategoria.DESPESA,
      cor: '#f97316',
      icone: 'receipt',
    });

    const contaOrigem = await createConta(tokenA, {
      nome: 'Conta Origem E2E',
      tipo: TipoConta.BANCO,
      saldoInicial: 1000,
    });
    const contaDestino = await createConta(tokenA, {
      nome: 'Conta Destino E2E',
      tipo: TipoConta.DINHEIRO,
      saldoInicial: 200,
    });
    const contaUsuarioB = await createConta(tokenB, {
      nome: 'Conta Usuario B E2E',
      tipo: TipoConta.BANCO,
      saldoInicial: 999,
    });

    const receita = await request(app.getHttpServer())
      .post('/transacoes')
      .set(bearer(tokenA))
      .send({
        contaId: contaOrigem.id,
        categoriaId: receitaCategoria.id,
        tipo: TipoTransacao.RECEITA,
        valor: 500,
        data: '2026-05-01',
        descricao: 'Receita E2E',
      })
      .expect(201);

    const despesa = await request(app.getHttpServer())
      .post('/transacoes')
      .set(bearer(tokenA))
      .send({
        contaId: contaOrigem.id,
        categoriaId: despesaCategoria.id,
        tipo: TipoTransacao.DESPESA,
        valor: 150,
        data: '2026-05-02',
        descricao: 'Despesa E2E',
      })
      .expect(201);

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
      .get(`/transacoes/${receita.body.id}`)
      .set(bearer(tokenB))
      .expect(404);
    await request(app.getHttpServer())
      .post('/transferencias')
      .set(bearer(tokenA))
      .send({
        contaOrigemId: contaOrigem.id,
        contaDestinoId: contaUsuarioB.id,
        valor: 50,
        comissao: 0,
        data: '2026-05-03',
      })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/transacoes/${despesa.body.id}`)
      .set(bearer(tokenA))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/transacoes/${despesa.body.id}`)
      .set(bearer(tokenA))
      .expect(404);

    const transacoes = await request(app.getHttpServer())
      .get('/transacoes')
      .set(bearer(tokenA))
      .expect(200);
    expect(transacoes.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: receita.body.id })]),
    );
    expect(transacoes.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: despesa.body.id }),
      ]),
    );

    contasUsuarioA = await listContas(tokenA);
    expectSaldo(contasUsuarioA, contaOrigem.id, 1500);
    expectSaldo(contasUsuarioA, contaDestino.id, 200);

    const transferencia = await request(app.getHttpServer())
      .post('/transferencias')
      .set(bearer(tokenA))
      .send({
        contaOrigemId: contaOrigem.id,
        contaDestinoId: contaDestino.id,
        valor: 200,
        comissao: 5,
        data: '2026-05-04',
        descricao: 'Transferencia E2E',
      })
      .expect(201);

    expect(transferencia.body).toEqual(
      expect.objectContaining({
        contaOrigemId: contaOrigem.id,
        contaDestinoId: contaDestino.id,
      }),
    );

    contasUsuarioA = await listContas(tokenA);
    expectSaldo(contasUsuarioA, contaOrigem.id, 1295);
    expectSaldo(contasUsuarioA, contaDestino.id, 400);

    const divida = await request(app.getHttpServer())
      .post('/dividas')
      .set(bearer(tokenA))
      .send({
        contaId: contaOrigem.id,
        nome: 'Divida E2E',
        montoTotal: 1000,
        tasaInteres: 0,
        cuotaMensual: 100,
        fechaInicio: '2026-05-01',
        fechaVencimiento: '2026-12-01',
        proximoVencimiento: '2026-06-01',
      })
      .expect(201);

    const pagamento = await request(app.getHttpServer())
      .post('/pagos-divida')
      .set(bearer(tokenA))
      .send({
        dividaId: divida.body.id,
        contaId: contaOrigem.id,
        categoriaId: pagamentoDividaCategoria.id,
        valor: 100,
        data: '2026-05-05',
        descricao: 'Pagamento de divida E2E',
      })
      .expect(201);

    expect(pagamento.body.transacaoId).toEqual(expect.any(String));

    const transacaoPagamento = await request(app.getHttpServer())
      .get(`/transacoes/${pagamento.body.transacaoId}`)
      .set(bearer(tokenA))
      .expect(200);
    expect(transacaoPagamento.body).toEqual(
      expect.objectContaining({
        id: pagamento.body.transacaoId,
        contaId: contaOrigem.id,
        categoriaId: pagamentoDividaCategoria.id,
        tipo: TipoTransacao.DESPESA,
      }),
    );
    expect(Number(transacaoPagamento.body.valor)).toBeCloseTo(100, 2);

    const pagamentosDaDivida = await request(app.getHttpServer())
      .get(`/pagos-divida/divida/${divida.body.id}`)
      .set(bearer(tokenA))
      .expect(200);
    expect(pagamentosDaDivida.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: pagamento.body.id,
          transacaoId: pagamento.body.transacaoId,
        }),
      ]),
    );

    await request(app.getHttpServer())
      .get(`/pagos-divida/${pagamento.body.id}`)
      .set(bearer(tokenB))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/transacoes/${pagamento.body.transacaoId}`)
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

    return response.body as Identifiable;
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

    return response.body as Identifiable;
  }

  async function listContas(token: string): Promise<ContaResponse[]> {
    const response = await request(app.getHttpServer())
      .get('/contas')
      .set(bearer(token))
      .expect(200);

    return response.body as ContaResponse[];
  }
});

function bearer(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function expectSaldo(
  contas: ContaResponse[],
  contaId: string,
  saldoEsperado: number,
): void {
  const conta = contas.find((item) => item.id === contaId);

  expect(conta).toBeDefined();
  expect(Number(conta?.saldoAtual)).toBeCloseTo(saldoEsperado, 2);
}
