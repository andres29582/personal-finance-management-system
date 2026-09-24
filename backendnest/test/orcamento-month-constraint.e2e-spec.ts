import { DataSource } from 'typeorm';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';

jest.setTimeout(60000);

describe('Orcamento month constraint (e2e)', () => {
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
    });
    await dataSource.initialize();
    await dataSource.query(
      `INSERT INTO public.usuario (id, nome, email, senha_hash)
       VALUES ($1, 'Budget User', 'budget@example.com', 'hash')`,
      ['00000000-0000-0000-0000-000000000001'],
    );
  });

  afterEach(async () => {
    await dataSource?.destroy();
  });

  it('accepts real months and rejects invalid month numbers', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO public.orcamento (id, usuario_id, mes_referencia, valor_planejado)
         VALUES ($1, $2, $3, $4)`,
        [
          '00000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-000000000001',
          '2026-12',
          1000,
        ],
      ),
    ).resolves.toBeDefined();

    await expect(
      dataSource.query(
        `INSERT INTO public.orcamento (id, usuario_id, mes_referencia, valor_planejado)
         VALUES ($1, $2, $3, $4)`,
        [
          '00000000-0000-0000-0000-000000000003',
          '00000000-0000-0000-0000-000000000001',
          '2026-13',
          1000,
        ],
      ),
    ).rejects.toThrow('chk_orcamento_mes_referencia');
  });
});
