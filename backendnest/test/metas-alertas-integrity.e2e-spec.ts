import request from 'supertest';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { registerAndLoginTestUser, withAuth } from './helpers/auth.e2e-helper';
import { unwrapSuccess } from './helpers/http.helper';

type Identifiable = { id: string };

jest.setTimeout(60000);

describe('Metas and alert references (e2e)', () => {
  let app: E2eApplication;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('accepts zero as a goal current amount and rejects a foreign alert reference', async () => {
    const owner = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'metas-alertas.owner.e2e@example.com',
      nome: 'Meta Alerta Owner E2E',
    });
    const otherUser = await registerAndLoginTestUser(app, {
      cpf: '39053344705',
      email: 'metas-alertas.other.e2e@example.com',
      nome: 'Meta Alerta Other E2E',
    });

    const meta = unwrapSuccess<Identifiable>(
      await withAuth(request(app.getHttpServer()).post('/metas'), owner)
        .send({
          fechaLimite: '2026-12-31',
          montoObjetivo: 1000,
          nome: 'Reserva E2E',
          tipo: 'economia',
        })
        .expect(201),
    );

    const updatedMeta = unwrapSuccess<{ montoActual: number }>(
      await withAuth(
        request(app.getHttpServer()).patch(`/metas/${meta.id}`),
        owner,
      )
        .send({ montoActual: 0 })
        .expect(200),
    );
    expect(Number(updatedMeta.montoActual)).toBe(0);

    const rejectedAlert = await withAuth(
      request(app.getHttpServer()).post('/alertas'),
      otherUser,
    )
      .send({
        diasAnticipacion: 3,
        referenciaId: meta.id,
        tipo: 'vencimento_meta',
      })
      .expect(404);

    const responseBody: unknown = rejectedAlert.body;
    expect(responseBody).toMatchObject({ success: false });
    expect(responseBody).toHaveProperty('error.code', 'META_NOT_FOUND');
  });
});
