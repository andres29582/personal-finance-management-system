import request from 'supertest';
import { UsersService } from '../src/users/users.service';
import { DEFAULT_CATEGORIAS } from '../src/categorias/default-categorias';
import { createE2eApp, E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { withGuardedDatabase, DatabaseConfig } from './e2e-runtime.cjs';
import { makeRegisterUserPayload } from './factories/auth.factory';
import { expectApiSuccess } from './helpers/expectations.helper';

jest.setTimeout(30000);

describe('atomic registration on confined PostgreSQL', () => {
  let config: DatabaseConfig;
  let app: E2eApplication;
  let sequence = 0;

  beforeAll(async () => {
    config = configureE2eEnvironment();
    await prepareE2eDatabase(config);
  });
  beforeEach(async () => {
    // Fresh throttler state; every case stays below the real endpoint limit.
    app = await createE2eApp();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  function payload(prefix = 'atomic') {
    const suffix = String(++sequence).padStart(4, '0');
    return makeRegisterUserPayload({
      email: `${prefix}-${suffix}@example.test`,
      cpf: `5299822${suffix}`,
    });
  }

  async function query(sql: string, parameters?: unknown[]) {
    // A new, independently guarded connection observes committed state.
    return withGuardedDatabase(
      config,
      process.env,
      async (client) => (await client.query(sql, parameters)).rows,
    );
  }

  async function assertComplete(email: string) {
    const users = await query('SELECT id FROM usuario WHERE email=$1', [email]);
    expect(users).toHaveLength(1);
    const categories = await query(
      'SELECT nome,tipo,cor,icone FROM categoria WHERE usuario_id=$1 ORDER BY nome',
      [users[0].id],
    );
    expect(categories).toEqual(
      [...DEFAULT_CATEGORIAS]
        .sort((left, right) => left.nome.localeCompare(right.nome))
        .map((category) => ({ ...category })),
    );
    return users[0].id;
  }

  function rendezvous() {
    let arrivals = 0;
    let release!: () => void;
    let cancel!: (error: Error) => void;
    const gate = new Promise<void>((resolve, reject) => {
      release = resolve;
      cancel = reject;
    });
    const deadline = setTimeout(
      () =>
        cancel(new Error('Concurrent registration prechecks did not meet.')),
      5000,
    );
    return async () => {
      if (++arrivals === 2) {
        clearTimeout(deadline);
        release();
      }
      await gate;
    };
  }

  it('commits a complete account and returns only the public registration response', async () => {
    const input = payload();
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(input)
      .expect(201);
    const data = expectApiSuccess<{ usuario: { id: string; email: string } }>(
      response,
    );
    expect(data.usuario.email).toBe(input.email);
    expect(Object.keys(data)).toEqual(['usuario']);
    expect(data.usuario).not.toHaveProperty('senhaHash');
    expect(data.usuario).not.toHaveProperty('senha');
    expect(await assertComplete(input.email)).toBe(data.usuario.id);
    expect(
      await query('SELECT id FROM auth_session WHERE usuario_id=$1', [
        data.usuario.id,
      ]),
    ).toEqual([]);
  });

  it('rolls back the user and partially inserted catalogue, then permits a complete retry', async () => {
    const input = payload('atomic-fail');
    const before = await query(
      'SELECT (SELECT count(*)::int FROM usuario) AS users,(SELECT count(*)::int FROM categoria) AS categories',
    );
    await query(`CREATE FUNCTION registration_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.nome='Freelance' AND EXISTS(
          SELECT 1 FROM usuario WHERE id=NEW.usuario_id AND email LIKE 'atomic-fail-%@example.test'
        ) THEN RAISE EXCEPTION 'synthetic category failure'; END IF;
        RETURN NEW;
      END $$`);
    await query(`CREATE TRIGGER registration_test_failure BEFORE INSERT ON categoria
      FOR EACH ROW EXECUTE FUNCTION registration_test_failure()`);
    try {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(input)
        .expect(500);
      expect(
        await query('SELECT id FROM usuario WHERE email=$1', [input.email]),
      ).toEqual([]);
      expect(
        await query(
          'SELECT (SELECT count(*)::int FROM usuario) AS users,(SELECT count(*)::int FROM categoria) AS categories',
        ),
      ).toEqual(before);
    } finally {
      await query('DROP TRIGGER registration_test_failure ON categoria');
      await query('DROP FUNCTION registration_test_failure()');
    }
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(input)
      .expect(201);
    await assertComplete(input.email);
  });

  it.each(['email', 'cpf'] as const)(
    'returns the precise %s conflict when concurrent prechecks both see no user',
    async (field) => {
      const first = payload();
      const second = payload();
      second[field] = first[field];
      const users = app.get<UsersService>(UsersService);
      const meet = rendezvous();
      if (field === 'email') {
        const original = users.findByEmail.bind(
          users,
        ) as UsersService['findByEmail'];
        jest.spyOn(users, 'findByEmail').mockImplementation(async (email) => {
          const found = await original(email);
          if (email === first.email && !found) await meet();
          return found;
        });
        second.email = ` ${first.email.toUpperCase()} `;
      } else {
        const original = users.findByCpf.bind(
          users,
        ) as UsersService['findByCpf'];
        jest.spyOn(users, 'findByCpf').mockImplementation(async (cpf) => {
          const found = await original(cpf);
          if (cpf === first.cpf && !found) await meet();
          return found;
        });
      }
      const responses = await Promise.all([
        request(app.getHttpServer()).post('/auth/register').send(first),
        request(app.getHttpServer()).post('/auth/register').send(second),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      const conflict = responses.find((response) => response.status === 409)!;
      expect(conflict.body as unknown).toMatchObject({
        success: false,
        error: {
          code:
            field === 'email'
              ? 'AUTH_EMAIL_ALREADY_EXISTS'
              : 'AUTH_CPF_ALREADY_EXISTS',
          field,
        },
      });
      const winner = responses.find((response) => response.status === 201)!;
      const data = expectApiSuccess<{ usuario: { email: string } }>(winner);
      await assertComplete(data.usuario.email);
      expect(
        await query(`SELECT id FROM usuario WHERE ${field}=$1`, [first[field]]),
      ).toHaveLength(1);
    },
  );

  it('keeps independent simultaneous registrations isolated', async () => {
    const inputs = [payload(), payload()];
    const responses = await Promise.all(
      inputs.map((input) =>
        request(app.getHttpServer()).post('/auth/register').send(input),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    const owners = await Promise.all(
      inputs.map((input) => assertComplete(input.email)),
    );
    expect(new Set(owners).size).toBe(2);
  });

  it('rejects invalid consent before creating any account', async () => {
    const input = { ...payload(), aceitoPoliticaPrivacidade: false };
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(input)
      .expect(400);
    expect(
      await query('SELECT id FROM usuario WHERE email=$1', [input.email]),
    ).toEqual([]);
  });
});
