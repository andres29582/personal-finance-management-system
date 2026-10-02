import { randomUUID } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';

type Report = {
  status: string;
  issues: string[];
  invalidAmounts: string | null;
};
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports
const {
  inspectDatabase,
  main,
}: {
  inspectDatabase: (config: object) => Promise<Report>;
  main: (args: string[], env: object) => Promise<number>;
} = require('../scripts/data-readiness.cjs');

jest.setTimeout(60000);
describe('Read-only data readiness (e2e)', () => {
  let admin: DataSource;
  let fixture: DataSource;
  let connection: object;
  const database = `readiness_test_${randomUUID().replace(/-/g, '')}`;

  beforeAll(async () => {
    const credentials = {
      host: process.env.E2E_DB_HOST ?? 'localhost',
      port: Number(process.env.E2E_DB_PORT ?? 5432),
      username: process.env.E2E_DB_USERNAME ?? 'postgres',
      password: process.env.E2E_DB_PASSWORD ?? '1234',
    };
    admin = new DataSource({
      type: 'postgres',
      ...credentials,
      database: 'postgres',
    });
    await admin.initialize();
    // CREATE fails rather than reusing/resetting any existing database.
    await admin.query(`CREATE DATABASE "${database}"`);
    fixture = new DataSource({ type: 'postgres', ...credentials, database });
    await fixture.initialize();
    connection = {
      host: credentials.host,
      port: credentials.port,
      user: credentials.username,
      password: credentials.password,
      database,
    };
  });
  beforeEach(async () => {
    await fixture.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    const directory = join(__dirname, '..', 'migrations');
    for (const name of readdirSync(directory)
      .filter((name) => name.endsWith('.sql') && name < '0011')
      .sort()) {
      await fixture.query(readFileSync(join(directory, name), 'utf8'));
    }
  });
  afterAll(async () => {
    await fixture?.destroy();
    // Only the unique database successfully created by this suite is removed.
    if (fixture?.isInitialized === false)
      await admin.query(`DROP DATABASE "${database}"`);
    await admin?.destroy();
  });
  it('reports the current schema and pending SQL amount protection without mutation', async () => {
    const before = await snapshot();
    expect(await inspectDatabase(connection)).toEqual({
      status: 'blocked',
      issues: ['transacao.amount_check'],
      invalidAmounts: '0',
    });
    expect(await snapshot()).toEqual(before);
  });
  it('counts zero, negative, NaN and soft-deleted values without exposing data', async () => {
    await fixture.query(`INSERT INTO usuario(id,nome,email,senha_hash) VALUES ('00000000-0000-0000-0000-000000000001','PRIVATE','private@example.invalid','PRIVATE');
      INSERT INTO conta(id,usuario_id,nome,tipo,saldo_inicial) VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','PRIVATE','corrente',0);
      INSERT INTO categoria(id,usuario_id,nome,tipo) VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','PRIVATE','despesa');
      INSERT INTO transacao(id,usuario_id,conta_id,categoria_id,tipo,valor,data,excluido_em)
      SELECT md5(value)::uuid,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','despesa',value::numeric,CURRENT_DATE,CURRENT_TIMESTAMP FROM unnest(ARRAY['0','-1','NaN','10']) value`);
    const before = await snapshot();
    const report = await inspectDatabase(connection);
    expect(report.invalidAmounts).toBe('3');
    expect(report.issues).toContain('transacao.invalid_amounts');
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE|private@|00000000/);
    expect(await snapshot()).toEqual(before);
  });
  it('fails closed for legacy types, missing columns and missing tables', async () => {
    await fixture.query(
      'ALTER TABLE transacao ALTER COLUMN valor TYPE numeric(12,2), ALTER COLUMN descricao TYPE varchar(255); ALTER TABLE transacao DROP COLUMN excluido_em; DROP TABLE orcamento',
    );
    const report = await inspectDatabase(connection);
    expect(report.status).toBe('blocked');
    expect(report.issues).toEqual(
      expect.arrayContaining([
        'transacao.valor',
        'transacao.descricao',
        'transacao.excluido_em',
        'orcamento.id',
      ]),
    );
    expect(report.invalidAmounts).toBeNull();
  });
  it('rejects same-name weak checks, wrong foreign keys and unvalidated constraints', async () => {
    await fixture.query(`ALTER TABLE orcamento DROP CONSTRAINT chk_orcamento_mes_referencia;
      ALTER TABLE orcamento ADD CONSTRAINT chk_orcamento_mes_referencia CHECK (mes_referencia ~ '^[0-9]{4}-[0-9]{2}$');
      ALTER TABLE transacao DROP CONSTRAINT transacao_categoria_id_fkey;
      ALTER TABLE transacao ADD CONSTRAINT transacao_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES conta(id) NOT VALID`);
    const report = await inspectDatabase(connection);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        'orcamento.month_check',
        'transacao.categoria_id.fk',
      ]),
    );
  });
  it('recognizes validated amount protection and blocks absent uniqueness', async () => {
    await fixture.query(
      `ALTER TABLE transacao ADD CONSTRAINT arbitrary_name CHECK (valor > 0 AND valor <> 'NaN'::numeric)`,
    );
    expect((await inspectDatabase(connection)).status).toBe('ready');
    await fixture.query(
      'ALTER TABLE orcamento DROP CONSTRAINT uq_orcamento_usuario_mes',
    );
    expect((await inspectDatabase(connection)).issues).toContain(
      'orcamento.unique_month',
    );
  });
  it('requires an explicit CLI target and never echoes connection failures', async () => {
    const output = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    try {
      expect(await main([], { DB_NAME: 'PRIVATE' })).toBe(2);
      expect(output).toHaveBeenLastCalledWith(
        JSON.stringify({
          status: 'blocked',
          error: 'EXPLICIT_CONNECTION_REQUIRED',
        }),
      );
      expect(
        await main(['--database', 'PRIVATE'], {
          DATA_CHECK_HOST: '127.0.0.1',
          DATA_CHECK_PORT: '1',
          DATA_CHECK_USER: 'PRIVATE',
          DATA_CHECK_PASSWORD: 'PRIVATE',
          DATA_CHECK_SSL_MODE: 'disable',
        }),
      ).toBe(2);
      expect(output).toHaveBeenLastCalledWith(
        JSON.stringify({ status: 'blocked', error: 'DATABASE_CHECK_FAILED' }),
      );
    } finally {
      output.mockRestore();
    }
  });
  async function snapshot() {
    return fixture.query(`SELECT (SELECT json_agg(t) FROM transacao t) AS data,
      (SELECT json_agg(c ORDER BY c.oid) FROM pg_constraint c WHERE connamespace='public'::regnamespace) AS constraints`);
  }
});
