import { readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { Transacao } from '../src/transacoes/entities/transacao.entity';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';

jest.setTimeout(60000);

const migrationPath = join(
  __dirname,
  '..',
  'migrations',
  '0009_align_transacao_schema.sql',
);

describe('Transacao schema alignment (e2e)', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    await prepareE2eDatabase(configureE2eEnvironment());
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [Transacao],
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    await dataSource?.destroy();
  });

  it('creates fresh schemas and entity metadata with numeric(14,2) and text', async () => {
    expect(dataSource.getMetadata(Transacao).columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          databaseName: 'valor',
          precision: 14,
          scale: 2,
        }),
        expect.objectContaining({
          databaseName: 'descricao',
          type: 'text',
          isNullable: true,
        }),
      ]),
    );

    await expect(getSchema()).resolves.toEqual([
      {
        column_name: 'descricao',
        data_type: 'text',
        numeric_precision: null,
        numeric_scale: null,
      },
      {
        column_name: 'valor',
        data_type: 'numeric',
        numeric_precision: 14,
        numeric_scale: 2,
      },
    ]);
  });

  it('upgrades legacy numeric(12,2) and varchar(255) transaction columns', async () => {
    await dataSource.query(
      'ALTER TABLE public.transacao ALTER COLUMN valor TYPE numeric(12,2), ALTER COLUMN descricao TYPE varchar(255)',
    );

    await dataSource.query(readFileSync(migrationPath, 'utf8'));

    await expect(getSchema()).resolves.toEqual([
      {
        column_name: 'descricao',
        data_type: 'text',
        numeric_precision: null,
        numeric_scale: null,
      },
      {
        column_name: 'valor',
        data_type: 'numeric',
        numeric_precision: 14,
        numeric_scale: 2,
      },
    ]);
  });

  function getSchema() {
    return dataSource.query<
      Array<{
        column_name: string;
        data_type: string;
        numeric_precision: number | null;
        numeric_scale: number | null;
      }>
    >(
      `SELECT column_name, data_type, numeric_precision, numeric_scale
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'transacao'
         AND column_name = ANY($1::text[])
       ORDER BY column_name`,
      [['descricao', 'valor']],
    );
  }
});
