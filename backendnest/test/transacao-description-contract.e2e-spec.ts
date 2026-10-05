import request from 'supertest';
import { DataSource } from 'typeorm';
import { Transacao } from '../src/transacoes/entities/transacao.entity';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { makeCategoriaPayload } from './factories/categoria.factory';
import { makeContaPayload } from './factories/conta.factory';
import { makeTransacaoPayload } from './factories/transacao.factory';
import { registerAndLoginTestUser, withAuth } from './helpers/auth.e2e-helper';
import { unwrapSuccess } from './helpers/http.helper';

type TransactionResponse = { id: string; descricao: string | null };

jest.setTimeout(60000);

describe('Transaction description contract (e2e)', () => {
  let app: E2eApplication;
  let session: Awaited<ReturnType<typeof registerAndLoginTestUser>>;
  let contaId: string;
  let categoriaId: string;

  beforeAll(async () => {
    await prepareE2eDatabase(configureE2eEnvironment());
    app = await createE2eApp();
    session = await registerAndLoginTestUser(app, {
      cpf: '16899535004',
      email: 'description.contract.e2e@example.com',
      nome: 'Description Contract E2E',
    });
    contaId = unwrapSuccess<{ id: string }>(
      await withAuth(request(app.getHttpServer()).post('/contas'), session)
        .send(makeContaPayload())
        .expect(201),
    ).id;
    categoriaId = unwrapSuccess<{ id: string }>(
      await withAuth(request(app.getHttpServer()).post('/categorias'), session)
        .send(makeCategoriaPayload())
        .expect(201),
    ).id;
  });
  afterAll(async () => {
    await app?.close();
  });

  it.each([undefined, null, '', 'Initial description'])(
    'persists creation description %p without normalization',
    async (descricao) => {
      const { descricao: defaultDescription, ...payload } =
        makeTransacaoPayload({ contaId, categoriaId });
      void defaultDescription;
      const created = unwrapSuccess<TransactionResponse>(
        await withAuth(
          request(app.getHttpServer()).post('/transacoes'),
          session,
        )
          .send({
            ...payload,
            ...(descricao === undefined ? {} : { descricao }),
          })
          .expect(201),
      );
      const persisted = await app
        .get(DataSource)
        .getRepository(Transacao)
        .findOneByOrFail({ id: created.id, usuarioId: session.userId });
      expect(persisted.descricao).toBe(
        descricao === undefined ? null : descricao,
      );
      const retrieved = unwrapSuccess<TransactionResponse>(
        await withAuth(
          request(app.getHttpServer()).get(`/transacoes/${created.id}`),
          session,
        ).expect(200),
      );
      expect(retrieved.descricao).toBe(persisted.descricao);
    },
  );

  it('preserves an omitted description and clears explicit null', async () => {
    const created = unwrapSuccess<TransactionResponse>(
      await withAuth(request(app.getHttpServer()).post('/transacoes'), session)
        .send(
          makeTransacaoPayload({ contaId, categoriaId, descricao: 'Keep me' }),
        )
        .expect(201),
    );
    const updated = unwrapSuccess<TransactionResponse>(
      await withAuth(
        request(app.getHttpServer()).patch(`/transacoes/${created.id}`),
        session,
      )
        .send({ valor: 12 })
        .expect(200),
    );
    expect(updated.descricao).toBe('Keep me');
    const preserved = await app
      .get(DataSource)
      .getRepository(Transacao)
      .findOneByOrFail({ id: created.id, usuarioId: session.userId });
    expect(preserved.descricao).toBe('Keep me');
    await withAuth(
      request(app.getHttpServer()).patch(`/transacoes/${created.id}`),
      session,
    )
      .send({ descricao: null })
      .expect(200);
    const cleared = await app
      .get(DataSource)
      .getRepository(Transacao)
      .findOneByOrFail({ id: created.id, usuarioId: session.userId });
    expect(cleared.descricao).toBeNull();
  });
});
