import type { E2eApplication } from '../e2e-app';
import request, { Test } from 'supertest';
import {
  makeLoginPayload,
  makeRegisterUserPayload,
} from '../factories/auth.factory';
import { bearer } from './http.helper';
import { expectApiSuccess } from './expectations.helper';

type PublicUserResponse = {
  id: string;
  email: string;
  nome: string;
};

type RegisterResponse = {
  usuario: PublicUserResponse;
};

type LoginResponse = {
  access_token: string;
  refreshToken: string;
  usuario: PublicUserResponse;
};

export type RegisterAndLoginInput = {
  cpf: string;
  email: string;
  nome: string;
  senha?: string;
};

export type E2eAuthSession = {
  email: string;
  senha: string;
  token: string;
  userId: string;
};

export async function registerTestUser(
  app: E2eApplication,
  input: RegisterAndLoginInput,
): Promise<PublicUserResponse> {
  const senha = input.senha ?? 'SenhaForte123';
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send(
      makeRegisterUserPayload({
        cpf: input.cpf,
        email: input.email,
        nome: input.nome,
        senha,
      }),
    )
    .expect(201);

  return expectApiSuccess<RegisterResponse>(response).usuario;
}

export async function loginTestUser(
  app: E2eApplication,
  input: Pick<RegisterAndLoginInput, 'email'> & { senha?: string },
): Promise<LoginResponse> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send(
      makeLoginPayload({
        email: input.email,
        senha: input.senha ?? 'SenhaForte123',
      }),
    )
    .expect(200);

  return expectApiSuccess<LoginResponse>(response);
}

export async function registerAndLoginTestUser(
  app: E2eApplication,
  input: RegisterAndLoginInput,
): Promise<E2eAuthSession> {
  const senha = input.senha ?? 'SenhaForte123';
  const usuario = await registerTestUser(app, { ...input, senha });
  const login = await loginTestUser(app, { email: input.email, senha });

  return {
    email: input.email,
    senha,
    token: login.access_token,
    userId: usuario.id,
  };
}

export function authHeaders(sessionOrToken: E2eAuthSession | string) {
  return bearer(resolveToken(sessionOrToken));
}

export function withAuth<TTest extends Test>(
  test: TTest,
  sessionOrToken: E2eAuthSession | string,
): TTest {
  return test.set(authHeaders(sessionOrToken));
}

function resolveToken(sessionOrToken: E2eAuthSession | string): string {
  return typeof sessionOrToken === 'string'
    ? sessionOrToken
    : sessionOrToken.token;
}
