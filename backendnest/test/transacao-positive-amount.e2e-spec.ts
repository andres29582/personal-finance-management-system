import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const {
  inspectDatabase,
}: {
  inspectDatabase: (config: object) => Promise<{ status: string }>;
} = require('../scripts/data-readiness.cjs');

jest.setTimeout(120000);
describe('Transaction positive SQL amount invariant (owned fixtures only)', () => {
  const database = `amount_test_${randomUUID().replace(/-/g, '')}`;
  const role = `amount_role_test_${randomUUID().replace(/-/g, '')}`;
  const password = randomUUID().replace(/-/g, '');
  const credentials = {
    host: process.env.E2E_DB_HOST ?? 'localhost',
    port: Number(process.env.E2E_DB_PORT ?? 5432),
    username: process.env.E2E_DB_USERNAME ?? 'postgres',
    password: process.env.E2E_DB_PASSWORD ?? '1234',
  };
  const migration = join(
    __dirname,
    '..',
    'migrations',
    '0011_validate_transacao_positive_amount.sql',
  );
  let admin: DataSource;
  let fixture: DataSource;
  let databaseOwned = false;
  let roleOwned = false;

  beforeAll(async () => {
    admin = new DataSource({
      type: 'postgres',
      ...credentials,
      database: 'postgres',
      extra: { connectionTimeoutMillis: 5000 },
    });
    await admin.initialize();
    expect(
      await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [
        database,
      ]),
    ).toEqual([]);
    expect(
      await admin.query('SELECT rolname FROM pg_roles WHERE rolname=$1', [
        role,
      ]),
    ).toEqual([]);
    await admin.query(
      `CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
    );
    roleOwned = true;
    await admin.query(
      `CREATE DATABASE "${database}" OWNER "${role}" TEMPLATE template0`,
    );
    databaseOwned = true;
    fixture = new DataSource({
      type: 'postgres',
      ...credentials,
      username: role,
      password,
      database,
    });
    await fixture.initialize();
  });
  beforeEach(async () => {
    await fixture.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    const directory = join(__dirname, '..', 'migrations');
    for (const name of readdirSync(directory)
      .filter((name) => name.endsWith('.sql') && name < '0011')
      .sort())
      await fixture.query(readFileSync(join(directory, name), 'utf8'));
    await fixture.query(`INSERT INTO usuario(id,nome,email,senha_hash) VALUES (md5('user')::uuid,'Synthetic','amount@example.invalid','synthetic');
      INSERT INTO conta(id,usuario_id,nome,tipo,saldo_inicial) VALUES (md5('account')::uuid,md5('user')::uuid,'Synthetic','corrente',-10);
      INSERT INTO categoria(id,usuario_id,nome,tipo) VALUES (md5('category')::uuid,md5('user')::uuid,'Synthetic','despesa')`);
  });
  afterAll(async () => {
    if (fixture?.isInitialized) await fixture.destroy();
    if (databaseOwned) await admin.query(`DROP DATABASE "${database}"`);
    if (roleOwned) await admin.query(`DROP ROLE "${role}"`);
    if (admin?.isInitialized) await admin.destroy();
  });
  async function insert(
    value: string | null,
    kind = 'despesa',
    adjustment = false,
    deleted = false,
  ) {
    return fixture.query(
      `INSERT INTO transacao(id,usuario_id,conta_id,categoria_id,tipo,valor,data,eh_ajuste,excluido_em)
      VALUES ($1,md5('user')::uuid,md5('account')::uuid,md5('category')::uuid,$2,$3,CURRENT_DATE,$4,$5)`,
      [randomUUID(), kind, value, adjustment, deleted ? '2026-01-01' : null],
    );
  }
  async function apply() {
    await fixture.query(readFileSync(migration, 'utf8'));
  }
  async function rows() {
    return fixture.query('SELECT * FROM transacao ORDER BY id');
  }
  async function constraint() {
    return fixture.query(
      `SELECT convalidated FROM pg_constraint WHERE conrelid='public.transacao'::regclass AND conname='chk_transacao_valor_positivo'`,
    );
  }
  it.each(['0', '-1', 'NaN'])(
    'rejects direct inserts and updates for %s',
    async (value) => {
      await apply();
      await expect(insert(value)).rejects.toMatchObject({
        driverError: {
          code: '23514',
          constraint: 'chk_transacao_valor_positivo',
        },
      });
      await insert('0.01');
      const before = await rows();
      await expect(
        fixture.query('UPDATE transacao SET valor=$1', [value]),
      ).rejects.toMatchObject({ driverError: { code: '23514' } });
      expect(await rows()).toEqual(before);
    },
  );
  it('preserves valid legacy amounts and recognizes fully validated protection', async () => {
    await insert('0.01');
    await insert('15.25', 'receita');
    await insert('2.00', 'despesa', true, true);
    const before = await rows();
    await apply();
    expect(await rows()).toEqual(before);
    expect(await constraint()).toEqual([{ convalidated: true }]);
    expect(
      (
        await inspectDatabase({
          host: credentials.host,
          port: credentials.port,
          user: role,
          password,
          database,
        })
      ).status,
    ).toBe('ready');
    await insert('4.00', 'receita', true);
    await expect(insert(null)).rejects.toMatchObject({
      driverError: { code: '23502' },
    });
  });
  it('blocks invalid legacy rows including soft-deleted values atomically', async () => {
    await insert('0');
    await insert('-1', 'despesa', false, true);
    await insert('NaN');
    await insert('10');
    const before = await rows();
    const runner = fixture.createQueryRunner();
    await runner.connect();
    try {
      await expect(
        runner.query(readFileSync(migration, 'utf8')),
      ).rejects.toMatchObject({
        driverError: {
          code: '23514',
          message: 'TRANSACAO_INVALID_AMOUNTS: zero=1 negative=1 nan=1',
        },
      });
    } finally {
      await runner.query('ROLLBACK');
      await runner.release();
    }
    expect(await rows()).toEqual(before);
    expect(await constraint()).toEqual([]);
  });
  it('psql ON_ERROR_STOP does not run the next file after a failed migration', async () => {
    await insert('-1');
    const executable = process.env.PG_TOOLS_DIRECTORY
      ? join(process.env.PG_TOOLS_DIRECTORY, 'psql')
      : 'psql';
    const version = spawnSync(executable, ['--version'], {
      windowsHide: true,
      encoding: 'utf8',
    });
    expect(version.status).toBe(0);
    const [{ version: server }] = await fixture.query<
      Array<{ version: string }>
    >("SELECT current_setting('server_version_num') AS version");
    expect(Number(version.stdout.match(/PostgreSQL\) (\d+)/)?.[1])).toBe(
      Math.floor(Number(server) / 10000),
    );
    const directory = mkdtempSync(join(tmpdir(), 'finance-amount-sentinel-'));
    try {
      const sentinel = join(directory, 'sentinel.sql');
      writeFileSync(sentinel, 'CREATE TABLE migration_sentinel(id integer);');
      const result = spawnSync(
        executable,
        [
          '-X',
          '-v',
          'ON_ERROR_STOP=1',
          '-d',
          database,
          '-f',
          migration,
          '-f',
          sentinel,
        ],
        {
          windowsHide: true,
          timeout: 65000,
          stdio: 'ignore',
          env: {
            ...Object.fromEntries(
              Object.entries(process.env).filter(
                ([key]) => !key.startsWith('PG'),
              ),
            ),
            PGHOST: credentials.host,
            PGPORT: String(credentials.port),
            PGUSER: role,
            PGPASSWORD: password,
            PGSSLMODE: 'disable',
            PGCONNECT_TIMEOUT: '5',
            PGCLIENTENCODING: 'UTF8',
          },
        },
      );
      expect(result.status).toBe(3);
      expect(
        await fixture.query(
          "SELECT to_regclass('public.migration_sentinel') AS marker",
        ),
      ).toEqual([{ marker: null }]);
      expect(await constraint()).toEqual([]);
      expect(await fixture.query('SELECT valor::text FROM transacao')).toEqual([
        { valor: '-1.00' },
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
