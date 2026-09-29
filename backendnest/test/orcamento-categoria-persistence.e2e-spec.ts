import { DataSource } from 'typeorm';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';

jest.setTimeout(60000);

describe('Orcamento category persistence (e2e)', () => {
  let dataSource: DataSource;

  const usuarioId = '00000000-0000-0000-0000-000000000001';
  const categoriaId = '00000000-0000-0000-0000-000000000002';
  const orcamentoId = '00000000-0000-0000-0000-000000000003';

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
       VALUES ($1, 'Budget User', 'budget-category@example.com', 'hash')`,
      [usuarioId],
    );
    await dataSource.query(
      `INSERT INTO public.categoria (id, usuario_id, nome, tipo)
       VALUES ($1, $2, 'Food', 'DESPESA')`,
      [categoriaId, usuarioId],
    );
    await dataSource.query(
      `INSERT INTO public.orcamento (id, usuario_id, mes_referencia, valor_planejado)
       VALUES ($1, $2, '2026-12', 1000)`,
      [orcamentoId, usuarioId],
    );
  });

  afterEach(async () => {
    await dataSource?.destroy();
  });

  it('enforces parent references, one allocation per category, and positive planned amounts', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO public.orcamento_categoria (orcamento_id, categoria_id, valor_planejado)
         VALUES ($1, $2, $3)`,
        [orcamentoId, categoriaId, 300],
      ),
    ).resolves.toBeDefined();

    await expect(
      dataSource.query(`DELETE FROM public.categoria WHERE id = $1`, [
        categoriaId,
      ]),
    ).rejects.toThrow('fk_orcamento_categoria_categoria');

    await expect(
      dataSource.query(
        `INSERT INTO public.orcamento_categoria (orcamento_id, categoria_id, valor_planejado)
         VALUES ($1, $2, $3)`,
        [orcamentoId, categoriaId, 200],
      ),
    ).rejects.toThrow('uq_orcamento_categoria');

    await expect(
      dataSource.query(
        `INSERT INTO public.orcamento_categoria (orcamento_id, categoria_id, valor_planejado)
         VALUES ($1, $2, $3)`,
        ['00000000-0000-0000-0000-000000000004', categoriaId, 200],
      ),
    ).rejects.toThrow('fk_orcamento_categoria_orcamento');

    await expect(
      dataSource.query(
        `INSERT INTO public.orcamento_categoria (orcamento_id, categoria_id, valor_planejado)
         VALUES ($1, $2, $3)`,
        [orcamentoId, '00000000-0000-0000-0000-000000000005', 200],
      ),
    ).rejects.toThrow('fk_orcamento_categoria_categoria');

    const otherCategoryId = '00000000-0000-0000-0000-000000000006';
    await dataSource.query(
      `INSERT INTO public.categoria (id, usuario_id, nome, tipo)
       VALUES ($1, $2, 'Transport', 'DESPESA')`,
      [otherCategoryId, usuarioId],
    );
    await expect(
      dataSource.query(
        `INSERT INTO public.orcamento_categoria (orcamento_id, categoria_id, valor_planejado)
         VALUES ($1, $2, $3)`,
        [orcamentoId, otherCategoryId, 0],
      ),
    ).rejects.toThrow('chk_orcamento_categoria_valor_planejado');

    await dataSource.query(`DELETE FROM public.orcamento WHERE id = $1`, [
      orcamentoId,
    ]);
    await expect(
      dataSource.query(
        `SELECT 1 FROM public.orcamento_categoria WHERE orcamento_id = $1`,
        [orcamentoId],
      ),
    ).resolves.toEqual([]);
  });
});
