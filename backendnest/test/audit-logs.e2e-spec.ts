import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TipoCategoria } from '../src/categorias/enums/tipo-categoria.enum';
import { TipoConta } from '../src/contas/enums/tipo-conta.enum';
import { TipoTransacao } from '../src/transacoes/enums/tipo-transacao.enum';
import { createE2eApp } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import {
  makeLoginPayload,
  makeRegisterUserPayload,
} from './factories/auth.factory';
import { makeCategoriaPayload } from './factories/categoria.factory';
import { makeContaPayload } from './factories/conta.factory';
import { makeTransacaoPayload } from './factories/transacao.factory';
import { bearer, Identifiable, unwrapSuccess } from './helpers/http.helper';

type LoginResponse = {
  access_token: string;
};

type AuditLogListResponse = {
  total: number;
  items: AuditLogResponse[];
};

type AuditLogResponse = {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  entity: string | null;
  entityId: string | null;
  event: string;
  level: string;
  message: string | null;
  method: string | null;
  module: string;
  route: string | null;
  success: boolean;
};

jest.setTimeout(60000);

describe('Audit logs (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);

    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('lists only the authenticated user audit logs with pagination and sanitized details', async () => {
    const tokenA = await registerAndLogin({
      cpf: '52998224725',
      email: 'audit.a.e2e@example.com',
      nome: 'Audit Usuario A',
      senha: 'SenhaForte123',
    });
    const tokenB = await registerAndLogin({
      cpf: '39053344705',
      email: 'audit.b.e2e@example.com',
      nome: 'Audit Usuario B',
      senha: 'OutraSenha123',
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send(
        makeLoginPayload({
          email: 'audit.a.e2e@example.com',
          senha: 'senha-incorreta',
        }),
      )
      .expect(401);

    const receitaCategoria = await createCategoria(
      tokenA,
      makeCategoriaPayload({
        nome: 'Receita Audit E2E',
        tipo: TipoCategoria.RECEITA,
      }),
    );
    const contaA = await createConta(
      tokenA,
      makeContaPayload({
        nome: 'Conta Audit A',
        tipo: TipoConta.BANCO,
        saldoInicial: 1000,
      }),
    );
    const transacaoA = await createTransacao(
      tokenA,
      makeTransacaoPayload({
        contaId: contaA.id,
        categoriaId: receitaCategoria.id,
        data: '2026-05-01',
        descricao: 'Receita Audit',
        tipo: TipoTransacao.RECEITA,
        valor: 500,
      }),
    );
    const contaB = await createConta(
      tokenB,
      makeContaPayload({
        nome: 'Conta Audit B',
        tipo: TipoConta.BANCO,
        saldoInicial: 999,
      }),
    );

    const auditAResponse = await request(app.getHttpServer())
      .get('/audit-logs')
      .query({ limit: 20, offset: 0 })
      .set(bearer(tokenA))
      .expect(200);
    const auditA = unwrapSuccess<AuditLogListResponse>(auditAResponse);

    expect(auditA.total).toBeGreaterThanOrEqual(4);
    expect(auditA.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'LOGIN_SUCCESS',
          module: 'auth',
          success: true,
        }),
        expect.objectContaining({
          entity: 'categoria',
          entityId: receitaCategoria.id,
          event: 'CATEGORIA_CREATED',
          module: 'categorias',
        }),
        expect.objectContaining({
          entity: 'conta',
          entityId: contaA.id,
          event: 'CONTA_CREATED',
          module: 'contas',
        }),
        expect.objectContaining({
          entity: 'transacao',
          entityId: transacaoA.id,
          event: 'TRANSACAO_CREATED',
          module: 'transacoes',
        }),
        expect.objectContaining({
          event: 'LOGIN_FAILED',
          module: 'auth',
          success: false,
        }),
      ]),
    );
    expect(JSON.stringify(auditA.items)).not.toContain('senha-incorreta');
    expect(JSON.stringify(auditA.items)).not.toContain('SenhaForte123');
    expect(JSON.stringify(auditA.items)).not.toContain(contaB.id);

    const paginatedResponse = await request(app.getHttpServer())
      .get('/audit-logs')
      .query({ limit: 1, offset: 0 })
      .set(bearer(tokenA))
      .expect(200);
    const paginated = unwrapSuccess<AuditLogListResponse>(paginatedResponse);

    expect(paginated.total).toBe(auditA.total);
    expect(paginated.items).toHaveLength(1);

    const auditBResponse = await request(app.getHttpServer())
      .get('/audit-logs')
      .query({ limit: 20, offset: 0 })
      .set(bearer(tokenB))
      .expect(200);
    const auditB = unwrapSuccess<AuditLogListResponse>(auditBResponse);

    expect(auditB.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'conta',
          entityId: contaB.id,
          event: 'CONTA_CREATED',
        }),
      ]),
    );
    expect(JSON.stringify(auditB.items)).not.toContain(contaA.id);
    expect(JSON.stringify(auditB.items)).not.toContain(transacaoA.id);
  });

  async function registerAndLogin(input: {
    cpf: string;
    email: string;
    nome: string;
    senha: string;
  }): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(makeRegisterUserPayload(input))
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(
        makeLoginPayload({
          email: input.email,
          senha: input.senha,
        }),
      )
      .expect(200);

    return unwrapSuccess<LoginResponse>(loginResponse).access_token;
  }

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

  async function createTransacao(
    token: string,
    body: Record<string, unknown>,
  ): Promise<Identifiable> {
    const response = await request(app.getHttpServer())
      .post('/transacoes')
      .set(bearer(token))
      .send(body)
      .expect(201);

    return unwrapSuccess<Identifiable>(response);
  }
});
