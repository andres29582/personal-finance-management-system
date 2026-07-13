import request from 'supertest';
import type { App } from 'supertest/types';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import {
  makeLoginPayload,
  makeRegisterUserPayload,
} from './factories/auth.factory';
import { unwrapSuccess } from './helpers/http.helper';

type ForgotPasswordResponse = {
  message: string;
  resetToken?: string;
};

jest.setTimeout(60000);

describe('Auth password reset (e2e)', () => {
  let app: E2eApplication;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);

    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('resets password with the test-only reset token and rejects reuse', async () => {
    const server = app.getHttpServer() as unknown as App;
    const oldPassword = 'SenhaAntiga123';
    const newPassword = 'SenhaNova123';
    const email = 'reset-token.e2e@example.com';

    await request(server)
      .post('/auth/register')
      .send(
        makeRegisterUserPayload({
          cpf: '93541134780',
          email,
          nome: 'Reset Token E2E',
          senha: oldPassword,
        }),
      )
      .expect(201);

    const forgotPasswordResponse = await request(server)
      .post('/auth/forgot-password')
      .send({ email })
      .expect(200);
    const forgotPasswordData = unwrapSuccess<ForgotPasswordResponse>(
      forgotPasswordResponse,
    );
    expect(forgotPasswordData.resetToken).toEqual(expect.any(String));

    const resetToken = forgotPasswordData.resetToken;
    if (!resetToken) {
      throw new Error('Expected test reset token to be returned.');
    }

    await request(server)
      .post('/auth/reset-password-token')
      .send({
        novaSenha: newPassword,
        token: resetToken,
      })
      .expect(200);

    await request(server)
      .post('/auth/login')
      .send(makeLoginPayload({ email, senha: oldPassword }))
      .expect(401);

    await request(server)
      .post('/auth/login')
      .send(makeLoginPayload({ email, senha: newPassword }))
      .expect(200);

    await request(server)
      .post('/auth/reset-password-token')
      .send({
        novaSenha: 'OutraSenha123',
        token: resetToken,
      })
      .expect(400);
  });
});
