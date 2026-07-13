import request from 'supertest';
import { TipoCategoria } from '../src/categorias/enums/tipo-categoria.enum';
import { TipoConta } from '../src/contas/enums/tipo-conta.enum';
import { TipoTransacao } from '../src/transacoes/enums/tipo-transacao.enum';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { registerAndLoginTestUser, withAuth } from './helpers/auth.e2e-helper';
import { E2E_DATES } from './helpers/date.helper';
import {
  expectApiSuccess,
  expectUnauthorized,
  expectValidIsoTimestamp,
} from './helpers/expectations.helper';
import {
  createCategoria,
  createConta,
  createTransacao,
} from './helpers/financial-scenario.helper';

type AuditLogListResponse = {
  total: number;
  items: AuditLogResponse[];
};

type AuditLogResponse = {
  id: string;
  action: string;
  createdAt: string;
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
      .get('/audit-logs')
      .query({ limit: 10, offset: 0 })
      .expect(401);

    expectUnauthorized(response);
  });

  it('records create, update and soft-delete events for financial entities', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'audit.events.e2e@example.com',
      nome: 'Audit Events E2E',
    });
    const category = await createCategoria(app, session, {
      nome: 'Despesa audit events',
      tipo: TipoCategoria.DESPESA,
    });
    const account = await createConta(app, session, {
      nome: 'Conta audit events',
      saldoInicial: 1000,
      tipo: TipoConta.BANCO,
    });
    const transaction = await createTransacao(app, session, {
      categoriaId: category.id,
      contaId: account.id,
      data: E2E_DATES.targetMonthStart,
      descricao: 'Despesa auditada',
      tipo: TipoTransacao.DESPESA,
      valor: 50,
    });

    await withAuth(
      request(app.getHttpServer()).patch(`/contas/${account.id}`),
      session,
    )
      .send({ nome: 'Conta audit events atualizada' })
      .expect(200);
    await withAuth(
      request(app.getHttpServer()).delete(`/transacoes/${transaction.id}`),
      session,
    ).expect(200);

    const response = await withAuth(
      request(app.getHttpServer()).get('/audit-logs'),
      session,
    )
      .query({ limit: 30, offset: 0 })
      .expect(200);
    const audit = expectApiSuccess<AuditLogListResponse>(response);

    expect(audit.total).toBeGreaterThanOrEqual(5);
    expect(audit.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'conta',
          entityId: account.id,
          event: 'CONTA_CREATED',
          module: 'contas',
        }),
        expect.objectContaining({
          entity: 'transacao',
          entityId: transaction.id,
          event: 'TRANSACAO_CREATED',
          module: 'transacoes',
        }),
        expect.objectContaining({
          entity: 'conta',
          entityId: account.id,
          event: 'CONTA_UPDATED',
          module: 'contas',
        }),
        expect.objectContaining({
          entity: 'transacao',
          entityId: transaction.id,
          event: 'TRANSACAO_SOFT_DELETED',
          module: 'transacoes',
        }),
      ]),
    );
    audit.items.forEach((item) => {
      expectValidIsoTimestamp(item.createdAt);
    });
  });

  it('lists only logs from the authenticated user and sanitizes sensitive details', async () => {
    const ownerSession = await registerAndLoginTestUser(app, {
      cpf: '39053344705',
      email: 'audit.owner.e2e@example.com',
      nome: 'Audit Owner E2E',
      senha: 'SenhaAuditOwner123',
    });
    const otherSession = await registerAndLoginTestUser(app, {
      cpf: '68199965000',
      email: 'audit.other.e2e@example.com',
      nome: 'Audit Other E2E',
      senha: 'SenhaAuditOther123',
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: ownerSession.email,
        senha: 'senha-incorreta-audit',
      })
      .expect(401);

    const ownerAccount = await createConta(app, ownerSession, {
      nome: 'Conta audit owner',
      saldoInicial: 10,
      tipo: TipoConta.BANCO,
    });
    const otherAccount = await createConta(app, otherSession, {
      nome: 'Conta audit other',
      saldoInicial: 20,
      tipo: TipoConta.BANCO,
    });

    const ownerResponse = await withAuth(
      request(app.getHttpServer()).get('/audit-logs'),
      ownerSession,
    )
      .query({ limit: 30, offset: 0 })
      .expect(200);
    const ownerAudit = expectApiSuccess<AuditLogListResponse>(ownerResponse);

    expect(ownerAudit.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'conta',
          entityId: ownerAccount.id,
          event: 'CONTA_CREATED',
        }),
        expect.objectContaining({
          event: 'LOGIN_FAILED',
          module: 'auth',
          success: false,
        }),
      ]),
    );
    expect(JSON.stringify(ownerAudit.items)).not.toContain(otherAccount.id);
    expect(JSON.stringify(ownerAudit.items)).not.toContain(
      'senha-incorreta-audit',
    );
    expect(JSON.stringify(ownerAudit.items)).not.toContain(ownerSession.senha);

    const otherResponse = await withAuth(
      request(app.getHttpServer()).get('/audit-logs'),
      otherSession,
    )
      .query({ limit: 30, offset: 0 })
      .expect(200);
    const otherAudit = expectApiSuccess<AuditLogListResponse>(otherResponse);

    expect(otherAudit.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'conta',
          entityId: otherAccount.id,
          event: 'CONTA_CREATED',
        }),
      ]),
    );
    expect(JSON.stringify(otherAudit.items)).not.toContain(ownerAccount.id);
  });
});
