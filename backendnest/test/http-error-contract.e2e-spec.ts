import request from 'supertest';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';

jest.setTimeout(60000);

describe('HTTP error contract (e2e)', () => {
  let app: E2eApplication;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('normalizes an unknown route', async () => {
    const response = await request(app.getHttpServer())
      .get('/route-that-does-not-exist')
      .expect(404);

    expectErrorEnvelope(response, 'NOT_FOUND');
  });

  it('normalizes authentication errors', async () => {
    const response = await request(app.getHttpServer())
      .get('/contas')
      .expect(401);

    expectErrorEnvelope(response, 'UNAUTHORIZED');
  });

  it('preserves all ValidationPipe messages', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({})
      .expect(400);

    const body = expectErrorEnvelope(response, 'VALIDATION_ERROR');
    const messages = body.error.details?.messages;
    expect(body.error.message).toBe(messages?.[0]);
    expect(messages).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it('repairs requestId for malformed JSON before route middleware', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);

    expectErrorEnvelope(response, 'BAD_REQUEST');
  });

  it('preserves 413 for payloads rejected before route middleware', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ payload: 'x'.repeat(1_048_577) })
      .expect(413);

    expectErrorEnvelope(response, 'PAYLOAD_TOO_LARGE');
  });
});

type ErrorEnvelopeBody = {
  error: {
    code: string;
    details?: { messages: string[] };
    message: string;
  };
  requestId: string;
  success: false;
  timestamp: string;
};

function expectErrorEnvelope(
  response: { body: unknown; headers: Record<string, string | undefined> },
  code: string,
): ErrorEnvelopeBody {
  const body = response.body as ErrorEnvelopeBody;

  expect(body.success).toBe(false);
  expect(body.error.code).toBe(code);
  expect(body.error.message).toEqual(expect.any(String));
  expect(body.timestamp).toEqual(expect.any(String));
  expect(body.requestId).toEqual(expect.any(String));
  expect(response.headers['x-request-id']).toBe(body.requestId);

  return body;
}
