import { createHash } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import {
  makeLoginPayload,
  makeRegisterUserPayload,
} from './factories/auth.factory';
import { unwrapSuccess } from './helpers/http.helper';

type AuthTokensResponse = {
  access_token: string;
  refresh_token: string;
};

type ForgotPasswordResponse = {
  message: string;
  resetToken?: string;
};

type RegisterResponse = {
  usuario: { id: string };
};

jest.setTimeout(60000);

describe('Auth password reset (e2e)', () => {
  let app: E2eApplication;
  let appDataSource: DataSource;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);

    app = await createE2eApp();
    appDataSource = app.get(DataSource);
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

  it('allows exactly one parallel reset-token consumption against Postgres', async () => {
    const server = app.getHttpServer() as unknown as App;
    const email = 'reset-token.parallel.e2e@example.com';
    const registrationResponse = await request(server)
      .post('/auth/register')
      .send(
        makeRegisterUserPayload({
          cpf: '39053344705',
          email,
          nome: 'Parallel Reset Token E2E',
        }),
      )
      .expect(201);
    const registration = unwrapSuccess<RegisterResponse>(registrationResponse);
    const forgotPasswordResponse = await request(server)
      .post('/auth/forgot-password')
      .send({ email })
      .expect(200);
    const { resetToken } = unwrapSuccess<ForgotPasswordResponse>(
      forgotPasswordResponse,
    );

    if (!resetToken) {
      throw new Error('Expected test reset token to be returned.');
    }

    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        request(server)
          .post('/auth/reset-password-token')
          .send({ novaSenha: 'SenhaNova123', token: resetToken }),
      ),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 400,
    ]);
    const [{ used }] = await appDataSource.query<Array<{ used: number }>>(
      `SELECT COUNT(*)::integer AS used
       FROM password_reset_token
       WHERE user_id = $1 AND used_at IS NOT NULL`,
      [registration.usuario.id],
    );
    expect(used).toBe(1);
  });

  it('revokes a session when a rotated refresh token is reused', async () => {
    const server = app.getHttpServer() as unknown as App;
    const email = 'refresh.parallel.e2e@example.com';
    const registrationResponse = await request(server)
      .post('/auth/register')
      .send(
        makeRegisterUserPayload({
          cpf: '16899535009',
          email,
          nome: 'Parallel Refresh E2E',
        }),
      )
      .expect(201);
    const registration = unwrapSuccess<RegisterResponse>(registrationResponse);
    const loginResponse = await request(server)
      .post('/auth/login')
      .send(makeLoginPayload({ email }))
      .expect(200);
    const login = unwrapSuccess<AuthTokensResponse>(loginResponse);

    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        request(server)
          .post('/auth/refresh')
          .send({ refreshToken: login.refresh_token }),
      ),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 401,
    ]);
    const successfulResponse = responses.find(
      (response) => response.status === 200,
    );
    expect(successfulResponse).toBeDefined();
    const rotated = unwrapSuccess<AuthTokensResponse>(successfulResponse!);
    expect(rotated.refresh_token).not.toBe(login.refresh_token);

    const [session] = await appDataSource.query<
      Array<{ refreshTokenHash: string; revokedAt: Date | null }>
    >(
      `SELECT refresh_token_hash AS "refreshTokenHash", revoked_at AS "revokedAt"
       FROM auth_session
       WHERE usuario_id = $1`,
      [registration.usuario.id],
    );
    expect(session).toEqual(
      expect.objectContaining({
        refreshTokenHash: createHash('sha256')
          .update(rotated.refresh_token)
          .digest('hex'),
        revokedAt: expect.any(Date),
      }),
    );

    await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: login.refresh_token })
      .expect(401);
    await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: rotated.refresh_token })
      .expect(401);
  });

  it('keeps at most five active sessions for a user', async () => {
    const server = app.getHttpServer() as unknown as App;
    const email = 'session.limit.e2e@example.com';
    const registrationResponse = await request(server)
      .post('/auth/register')
      .send(
        makeRegisterUserPayload({
          cpf: '10535118007',
          email,
          nome: 'Session Limit E2E',
        }),
      )
      .expect(201);
    const registration = unwrapSuccess<RegisterResponse>(registrationResponse);

    await Promise.all(
      Array.from({ length: 6 }, () =>
        request(server)
          .post('/auth/login')
          .send(makeLoginPayload({ email }))
          .expect(200),
      ),
    );

    const [{ active }] = await appDataSource.query<Array<{ active: number }>>(
      `SELECT COUNT(*)::integer AS active
       FROM auth_session
       WHERE usuario_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [registration.usuario.id],
    );

    expect(active).toBe(5);
  });
});
