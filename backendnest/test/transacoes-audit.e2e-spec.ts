import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TipoCategoria } from '../src/categorias/enums/tipo-categoria.enum';
import { Transacao } from '../src/transacoes/entities/transacao.entity';
import { TipoTransacao } from '../src/transacoes/enums/tipo-transacao.enum';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { makeCategoriaPayload } from './factories/categoria.factory';
import { makeContaPayload } from './factories/conta.factory';
import { makeTransacaoPayload } from './factories/transacao.factory';
import {
  registerAndLoginTestUser,
  withAuth,
  type E2eAuthSession,
} from './helpers/auth.e2e-helper';
import { type Identifiable, unwrapSuccess } from './helpers/http.helper';

type TransacaoResponse = Identifiable & {
  descricao: string | null;
};

type AuditFailureTrigger = {
  functionName: string;
  triggerName: string;
};

jest.setTimeout(60000);

describe('Transacoes audit atomicity (e2e)', () => {
  let app: E2eApplication;
  let dataSource: DataSource;
  let session: E2eAuthSession;
  let auditFailureTrigger: AuditFailureTrigger | null = null;

  beforeAll(async () => {
    await prepareE2eDatabase(configureE2eEnvironment());
    app = await createE2eApp();
    dataSource = app.get(DataSource);
    session = await registerAndLoginTestUser(app, {
      cpf: '43115161726',
      email: 'transacoes.audit.e2e@example.com',
      nome: 'Transacoes Auditoria E2E',
    });
  });

  afterEach(async () => {
    if (!auditFailureTrigger) return;

    await dataSource.query(
      `DROP TRIGGER IF EXISTS ${auditFailureTrigger.triggerName} ON audit_log`,
    );
    await dataSource.query(
      `DROP FUNCTION IF EXISTS ${auditFailureTrigger.functionName}()`,
    );
    auditFailureTrigger = null;
  });

  afterAll(async () => {
    await app?.close();
  });

  async function createFinancialFixture(descricao: string) {
    const conta = unwrapSuccess<Identifiable>(
      await withAuth(request(app.getHttpServer()).post('/contas'), session)
        .send(makeContaPayload({ nome: `Conta ${descricao}` }))
        .expect(201),
    );
    const categoria = unwrapSuccess<Identifiable>(
      await withAuth(request(app.getHttpServer()).post('/categorias'), session)
        .send(
          makeCategoriaPayload({
            nome: `Categoria ${descricao}`,
            tipo: TipoCategoria.DESPESA,
          }),
        )
        .expect(201),
    );

    return { categoriaId: categoria.id, contaId: conta.id };
  }

  async function createTransaction(
    descricao: string,
    fixture?: { categoriaId: string; contaId: string },
  ) {
    const resolvedFixture =
      fixture ?? (await createFinancialFixture(descricao));

    return unwrapSuccess<TransacaoResponse>(
      await withAuth(request(app.getHttpServer()).post('/transacoes'), session)
        .send(
          makeTransacaoPayload({
            categoriaId: resolvedFixture.categoriaId,
            contaId: resolvedFixture.contaId,
            descricao,
            tipo: TipoTransacao.DESPESA,
          }),
        )
        .expect(201),
    );
  }

  async function failAuditEvent(event: string): Promise<void> {
    const suffix = randomUUID().replace(/-/g, '_');
    auditFailureTrigger = {
      functionName: `falhar_auditoria_transacao_${suffix}`,
      triggerName: `trigger_falhar_auditoria_transacao_${suffix}`,
    };

    await dataSource.query(`
      CREATE FUNCTION ${auditFailureTrigger.functionName}() RETURNS trigger AS $$
      BEGIN
        IF NEW.entity = 'transacao'
          AND NEW.event = '${event}'
          AND NEW.user_id = '${session.userId}' THEN
          RAISE EXCEPTION 'falha de auditoria induzida pelo teste';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER ${auditFailureTrigger.triggerName}
      BEFORE INSERT ON audit_log
      FOR EACH ROW EXECUTE FUNCTION ${auditFailureTrigger.functionName}();
    `);
  }

  it('rolls back create when its audit insert fails', async () => {
    const before = await dataSource.getRepository(Transacao).countBy({
      usuarioId: session.userId,
    });
    const fixture = await createFinancialFixture('criar com auditoria falha');
    await failAuditEvent('TRANSACAO_CREATED');

    await withAuth(request(app.getHttpServer()).post('/transacoes'), session)
      .send(
        makeTransacaoPayload({
          categoriaId: fixture.categoriaId,
          contaId: fixture.contaId,
          descricao: 'criar com auditoria falha',
        }),
      )
      .expect(500);

    await expect(
      dataSource
        .getRepository(Transacao)
        .countBy({ usuarioId: session.userId }),
    ).resolves.toBe(before);
  });

  it('rolls back update when its audit insert fails', async () => {
    const transaction = await createTransaction('antes da atualizacao');
    await failAuditEvent('TRANSACAO_UPDATED');

    await withAuth(
      request(app.getHttpServer()).patch(`/transacoes/${transaction.id}`),
      session,
    )
      .send({ descricao: 'depois da atualizacao' })
      .expect(500);

    await expect(
      dataSource
        .getRepository(Transacao)
        .findOneByOrFail({ id: transaction.id }),
    ).resolves.toEqual(
      expect.objectContaining({ descricao: transaction.descricao }),
    );
  });

  it('rolls back remove when its audit insert fails', async () => {
    const transaction = await createTransaction('antes da exclusao');
    await failAuditEvent('TRANSACAO_SOFT_DELETED');

    await withAuth(
      request(app.getHttpServer()).delete(`/transacoes/${transaction.id}`),
      session,
    ).expect(500);

    await expect(
      dataSource
        .getRepository(Transacao)
        .findOneByOrFail({ id: transaction.id }),
    ).resolves.toEqual(expect.objectContaining({ excluidoEm: null }));
  });
});
