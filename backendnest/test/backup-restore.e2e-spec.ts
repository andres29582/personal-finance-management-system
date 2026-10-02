import { spawn, spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { DataSource } from 'typeorm';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const {
  inspectDatabase,
}: {
  inspectDatabase: (config: object) => Promise<object>;
} = require('../scripts/data-readiness.cjs');

jest.setTimeout(120000);
describe('Native backup recovery rehearsal (synthetic fixtures only)', () => {
  const names = ['source', 'restored', 'corrupt'].map(
    (role) => `restore_test_${role}_${randomUUID().replace(/-/g, '')}`,
  );
  const owned: string[] = [];
  const fixtureRole = `restore_role_test_${randomUUID().replace(/-/g, '')}`;
  const fixturePassword = randomUUID().replace(/-/g, '');
  let roleOwned = false;
  const connections: DataSource[] = [];
  const credentials = {
    host: process.env.E2E_DB_HOST ?? 'localhost',
    port: Number(process.env.E2E_DB_PORT ?? 5432),
    username: process.env.E2E_DB_USERNAME ?? 'postgres',
    password: process.env.E2E_DB_PASSWORD ?? '1234',
  };
  let admin: DataSource;
  let source: DataSource;
  let restored: DataSource;
  let corrupt: DataSource;
  let directory: string;
  const executable = (tool: string) =>
    process.env.PG_TOOLS_DIRECTORY
      ? join(process.env.PG_TOOLS_DIRECTORY, tool)
      : tool;
  const environment = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('PG')),
    ),
    PGHOST: credentials.host,
    PGPORT: String(credentials.port),
    PGUSER: fixtureRole,
    PGPASSWORD: fixturePassword,
    PGCONNECT_TIMEOUT: '5',
    PGSSLMODE: 'disable',
    PGCLIENTENCODING: 'UTF8',
    PGOPTIONS: '-c statement_timeout=60000 -c lock_timeout=5000',
    LC_ALL: 'C',
    LANG: 'C',
  };
  async function native(tool: string, args: string[]): Promise<string> {
    return new Promise((accept, reject) => {
      const child = spawn(executable(tool), args, {
        env: environment,
        windowsHide: true,
      });
      let output = '';
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, 65000);
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
      // Drain without echoing database names, passwords or SQL from stderr.
      child.stderr.resume();
      child.once('error', () => {
        clearTimeout(timeout);
        reject(new Error('PG_TOOLS_UNAVAILABLE'));
      });
      child.once('close', (code) => {
        clearTimeout(timeout);
        if (timedOut || code !== 0)
          reject(
            new Error(
              timedOut ? 'PG_TOOL_TIMEOUT' : `PG_TOOL_FAILED:${code}:${tool}`,
            ),
          );
        else accept(output);
      });
    });
  }
  beforeAll(async () => {
    admin = new DataSource({
      type: 'postgres',
      ...credentials,
      database: process.env.E2E_DB_ADMIN_DATABASE ?? 'postgres',
    });
    await admin.initialize();
    const [{ version }] = await admin.query<Array<{ version: string }>>(
      "SELECT current_setting('server_version_num') AS version",
    );
    const major = Math.floor(Number(version) / 10000);
    for (const tool of ['pg_dump', 'pg_restore']) {
      const output = await native(tool, ['--version']);
      // Same major removes cross-version archive and restore ambiguity.
      expect(Number(output.match(/PostgreSQL\) (\d+)/)?.[1])).toBe(major);
    }
    expect(
      await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [
        fixtureRole,
      ]),
    ).toEqual([]);
    // Native fixture login uses an ASCII password, never the application's credentials.
    await admin.query(
      `CREATE ROLE "${fixtureRole}" LOGIN PASSWORD '${fixturePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
    );
    roleOwned = true;
    directory = mkdtempSync(join(tmpdir(), 'finance-restore-fixture-'));
    chmodSync(directory, 0o700);
    if (process.platform === 'win32') {
      const account = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
      const permissions = spawnSync(
        'icacls',
        [directory, '/inheritance:r', '/grant:r', `${account}:(OI)(CI)F`],
        { windowsHide: true, stdio: 'ignore' },
      );
      if (permissions.status !== 0)
        throw new Error('PRIVATE_FIXTURE_DIRECTORY_REQUIRED');
    }
    for (const database of names) {
      await admin.query(
        `CREATE DATABASE "${database}" OWNER "${fixtureRole}" TEMPLATE template0`,
      );
      owned.push(database);
      const connection = new DataSource({
        type: 'postgres',
        ...credentials,
        database,
      });
      connections.push(connection);
      await connection.initialize();
      expect(
        await connection.query(
          "SELECT tablename FROM pg_tables WHERE schemaname='public'",
        ),
      ).toEqual([]);
    }
    [source, restored, corrupt] = connections;
    // Only the newly created, verified-empty SOURCE receives migrations.
    const migrations = join(__dirname, '..', 'migrations');
    for (const file of readdirSync(migrations)
      .filter((name) => name.endsWith('.sql'))
      .sort()) {
      await source.query(readFileSync(join(migrations, file), 'utf8'));
    }
    await source.query(`
      INSERT INTO usuario(id,nome,email,senha_hash) VALUES (md5('user')::uuid,'Synthetic','fixture@example.invalid','synthetic-only');
      INSERT INTO conta(id,usuario_id,nome,tipo,saldo_inicial) VALUES
        (md5('primary')::uuid,md5('user')::uuid,'Primary','banco',1000),
        (md5('reserve')::uuid,md5('user')::uuid,'Reserve','banco',500);
      INSERT INTO categoria(id,usuario_id,nome,tipo) VALUES
        (md5('income')::uuid,md5('user')::uuid,'Income','receita'),
        (md5('expense')::uuid,md5('user')::uuid,'Expense','despesa');
      INSERT INTO transacao(id,usuario_id,conta_id,categoria_id,tipo,valor,data,eh_ajuste,excluido_em)
        SELECT md5(label)::uuid,md5('user')::uuid,md5('primary')::uuid,md5(kind)::uuid,kind,amount,'2026-01-10',adjustment,deleted
        FROM (VALUES ('salary','income',3000,false,NULL::timestamp),('purchase','expense',650,false,NULL::timestamp),
          ('adjust','income',25,true,NULL::timestamp),('payment','expense',150,false,NULL::timestamp),
          ('deleted','expense',999,false,'2026-01-11'::timestamp)) v(label,kind,amount,adjustment,deleted);
      UPDATE transacao SET tipo=CASE tipo WHEN 'income' THEN 'receita' ELSE 'despesa' END;
      INSERT INTO transferencia(id,usuario_id,conta_origem_id,conta_destino_id,valor,comissao,data,excluido_em) VALUES
        (md5('transfer')::uuid,md5('user')::uuid,md5('primary')::uuid,md5('reserve')::uuid,200,10,'2026-01-10',NULL),
        (md5('deleted-transfer')::uuid,md5('user')::uuid,md5('primary')::uuid,md5('reserve')::uuid,888,2,'2026-01-10','2026-01-11');
      INSERT INTO divida(id,usuario_id,conta_id,nome,valor_total,data_inicio,data_vencimento) VALUES
        (md5('debt')::uuid,md5('user')::uuid,md5('primary')::uuid,'Synthetic debt',1200,'2026-01-01','2026-12-31');
      INSERT INTO pagamento_divida(id,usuario_id,divida_id,conta_id,transacao_id,valor,data) VALUES
        (md5('payment-link')::uuid,md5('user')::uuid,md5('debt')::uuid,md5('primary')::uuid,md5('payment')::uuid,150,'2026-01-10');
      INSERT INTO orcamento(id,usuario_id,mes_referencia,valor_planejado) VALUES (md5('budget')::uuid,md5('user')::uuid,'2026-01',2000);
      INSERT INTO meta(id,usuario_id,nome,tipo,valor_objetivo,valor_atual,conta_id) VALUES (md5('goal')::uuid,md5('user')::uuid,'Synthetic goal','economia',2000,200,md5('reserve')::uuid);
      INSERT INTO alerta(id,usuario_id,tipo,referencia_id,dias_antecedencia) VALUES (md5('alert')::uuid,md5('user')::uuid,'meta',md5('goal')::uuid,3);
      INSERT INTO audit_log(id,level,event,module,action,user_id,details) VALUES (md5('audit')::uuid,'info','fixture','transacoes','create',md5('user')::uuid,'{"synthetic":true}');
      INSERT INTO auth_session(id,usuario_id,refresh_token_hash,expires_at) VALUES (md5('session')::uuid,md5('user')::uuid,'synthetic-only','2026-12-31');
      INSERT INTO password_reset_token(id,user_id,token_hash,expires_at) VALUES (md5('reset')::uuid,md5('user')::uuid,repeat('a',64),'2026-12-31');
    `);
    await source.query(
      `GRANT USAGE ON SCHEMA public TO "${fixtureRole}"; GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${fixtureRole}"`,
    );
  });
  afterAll(async () => {
    try {
      for (const connection of connections)
        if (connection.isInitialized) await connection.destroy();
      for (const database of owned)
        await admin.query(`DROP DATABASE "${database}"`);
      if (roleOwned) await admin.query(`DROP ROLE "${fixtureRole}"`);
    } finally {
      if (admin?.isInitialized) await admin.destroy();
      if (directory) {
        const path = resolve(directory);
        if (
          dirname(path) !== resolve(tmpdir()) ||
          !path.split(/[\\/]/).pop()?.startsWith('finance-restore-fixture-')
        )
          throw new Error('UNSAFE_FIXTURE_CLEANUP');
        rmSync(path, { recursive: true });
      }
    }
  });
  async function snapshot(database: DataSource) {
    const tables = await database.query<Array<{ name: string }>>(
      "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    );
    const data: Record<string, unknown> = {};
    for (const { name } of tables) {
      // Catalog identifiers, never user-controlled; preserve every synthetic row.
      data[name] = await database.query(
        `SELECT to_jsonb(t) AS row FROM public."${name.replace(/"/g, '""')}" t ORDER BY id`,
      );
    }
    const columns =
      await database.query(`SELECT table_name,column_name,data_type,udt_name,numeric_precision,numeric_scale,is_nullable,column_default
      FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`);
    const constraints =
      await database.query(`SELECT t.relname,c.conname,c.convalidated,pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE c.connamespace='public'::regnamespace ORDER BY t.relname,c.conname`);
    const financials = await database.query(`SELECT
      (SELECT sum(valor)::text FROM transacao) AS all_transactions,
      (SELECT sum(valor)::text FROM transacao WHERE excluido_em IS NULL AND tipo='despesa' AND NOT eh_ajuste) AS expenses,
      (SELECT sum(valor)::text FROM transferencia WHERE excluido_em IS NULL) AS transfers,
      (SELECT sum(comissao)::text FROM transferencia WHERE excluido_em IS NULL) AS fees,
      (SELECT sum(valor)::text FROM pagamento_divida WHERE excluido_em IS NULL) AS payments`);
    const indexes = await database.query(
      "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
    );
    return { data, columns, constraints, indexes, financials };
  }
  it('restores actual data, schema, financial totals and enforced constraints', async () => {
    const before = await snapshot(source);
    const archive = join(directory, 'synthetic.dump');
    await native('pg_dump', [
      '--dbname',
      names[0],
      '--format=custom',
      '--file',
      archive,
    ]);
    chmodSync(archive, 0o600);
    // Explicit fixture role mapping: tables belong to the test role, not a production role.
    await native('pg_restore', [
      '--dbname',
      names[1],
      '--exit-on-error',
      '--single-transaction',
      '--no-owner',
      '--no-privileges',
      archive,
    ]);
    expect(await snapshot(restored)).toEqual(before);
    expect(before.financials).toEqual([
      {
        all_transactions: '4824.00',
        expenses: '800.00',
        transfers: '200.00',
        fees: '10.00',
        payments: '150.00',
      },
    ]);
    const config = (database: string) => ({
      host: credentials.host,
      port: credentials.port,
      user: credentials.username,
      password: credentials.password,
      database,
    });
    expect(await inspectDatabase(config(names[1]))).toEqual(
      await inspectDatabase(config(names[0])),
    );
    const balances = await restored.query(`SELECT c.nome,(c.saldo_inicial
      + COALESCE((SELECT sum(CASE WHEN t.tipo='receita' THEN t.valor ELSE -t.valor END) FROM transacao t WHERE t.conta_id=c.id AND t.excluido_em IS NULL),0)
      + COALESCE((SELECT sum(CASE WHEN tr.conta_origem_id=c.id THEN -tr.valor-tr.comissao ELSE tr.valor END) FROM transferencia tr WHERE (tr.conta_origem_id=c.id OR tr.conta_destino_id=c.id) AND tr.excluido_em IS NULL),0))::text AS balance
      FROM conta c ORDER BY c.nome`);
    // ContasService includes adjustments and excludes soft-deleted entries; payment is counted once through transacao.
    expect(balances).toEqual([
      { nome: 'Primary', balance: '3015.00' },
      { nome: 'Reserve', balance: '700.00' },
    ]);
    await expect(
      restored.query(
        "INSERT INTO orcamento(id,usuario_id,mes_referencia,valor_planejado) VALUES (md5('bad')::uuid,md5('user')::uuid,'2026-13',10)",
      ),
    ).rejects.toMatchObject({ driverError: { code: '23514' } });
    await expect(
      restored.query(
        "UPDATE transacao SET categoria_id=md5('missing')::uuid WHERE id=md5('payment')::uuid",
      ),
    ).rejects.toMatchObject({ driverError: { code: '23503' } });
    await restored.query(
      "UPDATE meta SET nome='Writable restored fixture' WHERE id=md5('goal')::uuid",
    );
    expect(await snapshot(source)).toEqual(before);
  });
  it('rejects a truncated archive without accepting a partial recovery or changing the source', async () => {
    const before = await snapshot(source);
    const archive = join(directory, 'truncated.dump');
    writeFileSync(archive, Buffer.from('PGDMP'));
    chmodSync(archive, 0o600);
    await expect(
      native('pg_restore', [
        '--dbname',
        names[2],
        '--exit-on-error',
        '--single-transaction',
        '--no-owner',
        '--no-privileges',
        archive,
      ]),
    ).rejects.toThrow('PG_TOOL_FAILED:');
    expect(
      await corrupt.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public'",
      ),
    ).toEqual([]);
    expect(await snapshot(source)).toEqual(before);
  });
});
