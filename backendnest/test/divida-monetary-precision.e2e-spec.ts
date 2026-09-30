import { readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { Divida } from '../src/dividas/entities/divida.entity';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';

jest.setTimeout(60000);

const columns = ['parcela_mensal', 'valor_total'];
const migrationPath = join(
  __dirname,
  '..',
  'migrations',
  '0008_align_divida_monetary_precision.sql',
);

describe('Divida monetary precision (e2e)', () => {
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
      entities: [Divida],
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    await dataSource?.destroy();
  });

  it('creates fresh schemas and entity metadata with numeric(14,2)', async () => {
    expect(dataSource.getMetadata(Divida).columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          databaseName: 'valor_total',
          precision: 14,
          scale: 2,
        }),
        expect.objectContaining({
          databaseName: 'parcela_mensal',
          precision: 14,
          scale: 2,
        }),
      ]),
    );

    await expect(getPrecision()).resolves.toEqual([
      {
        column_name: 'parcela_mensal',
        numeric_precision: 14,
        numeric_scale: 2,
      },
      { column_name: 'valor_total', numeric_precision: 14, numeric_scale: 2 },
    ]);
  });

  it('upgrades legacy numeric(12,2) debt columns', async () => {
    await dataSource.query(
      'ALTER TABLE public.divida ALTER COLUMN valor_total TYPE numeric(12,2), ALTER COLUMN parcela_mensal TYPE numeric(12,2)',
    );

    await dataSource.query(readFileSync(migrationPath, 'utf8'));

    await expect(getPrecision()).resolves.toEqual([
      {
        column_name: 'parcela_mensal',
        numeric_precision: 14,
        numeric_scale: 2,
      },
      { column_name: 'valor_total', numeric_precision: 14, numeric_scale: 2 },
    ]);
  });

  function getPrecision() {
    return dataSource.query<
      Array<{
        column_name: string;
        numeric_precision: number;
        numeric_scale: number;
      }>
    >(
      `SELECT column_name, numeric_precision, numeric_scale
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'divida'
         AND column_name = ANY($1::text[])
       ORDER BY column_name`,
      [columns],
    );
  }
});
