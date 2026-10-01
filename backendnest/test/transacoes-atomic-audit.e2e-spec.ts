import request from 'supertest';
import { DataSource } from 'typeorm';
import { AuditLog } from '../src/logs/entities/audit-log.entity';
import { Transacao } from '../src/transacoes/entities/transacao.entity';
import { TipoTransacao } from '../src/transacoes/enums/tipo-transacao.enum';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { makeTransacaoPayload } from './factories/transacao.factory';
import {
  registerAndLoginTestUser,
  withAuth,
  type E2eAuthSession,
} from './helpers/auth.e2e-helper';
import { expectApiSuccess } from './helpers/expectations.helper';
import {
  createCategoria,
  createConta,
  createTransacao,
} from './helpers/financial-scenario.helper';

jest.setTimeout(60000);

describe('Transaction business audit atomicity (e2e)', () => {
  let app: E2eApplication;
  let db: DataSource;
  let session: E2eAuthSession;
  let accountId: string;
  let categoryId: string;
  const operations = [
    { action: 'create', event: 'TRANSACAO_CREATED' },
    { action: 'update', event: 'TRANSACAO_UPDATED' },
    { action: 'delete', event: 'TRANSACAO_SOFT_DELETED' },
  ] as const;

  beforeAll(async () => {
    await prepareE2eDatabase(configureE2eEnvironment());
    app = await createE2eApp();
    db = app.get(DataSource);
    session = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'atomic-audit@example.com',
      nome: 'Atomic audit',
    });
    accountId = (await createConta(app, session, { saldoInicial: 1000 })).id;
    categoryId = (await createCategoria(app, session)).id;
  });

  afterAll(async () => {
    await app?.close();
  });

  function payload() {
    return makeTransacaoPayload({
      contaId: accountId,
      categoriaId: categoryId,
    });
  }

  function execute(action: (typeof operations)[number]['action'], id?: string) {
    const http = request(app.getHttpServer());
    const operation =
      action === 'create'
        ? http.post('/transacoes').send(payload())
        : action === 'update'
          ? http
              .patch(`/transacoes/${id}`)
              .send({ valor: 250, descricao: null })
          : http.delete(`/transacoes/${id}`);
    return withAuth(operation, session);
  }

  async function balance() {
    const response = await withAuth(
      request(app.getHttpServer()).get(`/contas/${accountId}`),
      session,
    ).expect(200);
    return expectApiSuccess<{ saldoAtual: number }>(response).saldoAtual;
  }

  it.each(operations)(
    'rolls back $action when its business audit INSERT fails',
    async ({ action, event }) => {
      const transaction =
        action === 'create'
          ? undefined
          : await createTransacao(app, session, payload());
      const rowsBefore = await db
        .getRepository(Transacao)
        .find({ where: { usuarioId: session.userId }, order: { id: 'ASC' } });
      const logsBefore = await db
        .getRepository(AuditLog)
        .find({ where: { userId: session.userId, event } });
      const balanceBefore = await balance();
      try {
        await db.query(`CREATE FUNCTION fail_transaction_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'phase_a_audit_failure'; END; $$`);
        await db.query(`CREATE TRIGGER fail_transaction_audit BEFORE INSERT ON audit_log
        FOR EACH ROW WHEN (NEW.user_id = '${session.userId}'::uuid
          AND NEW.entity = 'transacao' AND NEW.event = '${event}'
          ${transaction ? `AND NEW.entity_id = '${transaction.id}'::uuid` : ''})
        EXECUTE FUNCTION fail_transaction_audit()`);
        const response = await execute(action, transaction?.id);
        expect(
          await db.getRepository(Transacao).find({
            where: { usuarioId: session.userId },
            order: { id: 'ASC' },
          }),
        ).toEqual(rowsBefore);
        expect(await balance()).toEqual(balanceBefore);
        expect(
          await db
            .getRepository(AuditLog)
            .find({ where: { userId: session.userId, event } }),
        ).toEqual(logsBefore);
        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          success: false,
          error: { code: 'INTERNAL_SERVER_ERROR' },
        });
        expect(JSON.stringify(response.body)).not.toMatch(
          /phase_a_audit_failure|INSERT INTO|audit_log|QueryFailedError/,
        );
      } finally {
        await db.query(
          'DROP TRIGGER IF EXISTS fail_transaction_audit ON audit_log',
        );
        await db.query('DROP FUNCTION IF EXISTS fail_transaction_audit()');
      }
    },
  );

  it.each(operations)(
    'persists one matching business audit on successful $action',
    async ({ action, event }) => {
      const transaction =
        action === 'create'
          ? undefined
          : await createTransacao(app, session, payload());
      const response = await execute(action, transaction?.id);
      expect(response.status).toBe(action === 'create' ? 201 : 200);
      const entityId =
        transaction?.id ?? expectApiSuccess<{ id: string }>(response).id;
      const logs = await db
        .getRepository(AuditLog)
        .find({ where: { userId: session.userId, entityId, event } });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action,
        entity: 'transacao',
        module: 'transacoes',
        success: true,
        method:
          action === 'create'
            ? 'POST'
            : action === 'update'
              ? 'PATCH'
              : 'DELETE',
      });
      expect(logs[0].route).toBe(
        action === 'create' ? '/transacoes' : `/transacoes/${entityId}`,
      );
      expect(logs[0].details).toEqual(
        action === 'update'
          ? { changedFields: ['valor', 'descricao'] }
          : {
              contaId: accountId,
              categoriaId: categoryId,
              tipo: TipoTransacao.DESPESA,
              valor: 100,
            },
      );
      expect(logs[0].details).not.toHaveProperty('descricao');
    },
  );
});
