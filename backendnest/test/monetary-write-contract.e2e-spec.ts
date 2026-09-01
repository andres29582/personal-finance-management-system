import request from 'supertest';
import { DataSource } from 'typeorm';
import { TipoCategoria } from '../src/categorias/enums/tipo-categoria.enum';
import { PagoDivida } from '../src/pagos-divida/entities/pago-divida.entity';
import { Transacao } from '../src/transacoes/entities/transacao.entity';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { makePagoDividaPayload } from './factories/pago-divida.factory';
import { registerAndLoginTestUser, withAuth } from './helpers/auth.e2e-helper';
import {
  createCategoria,
  createConta,
  createDivida,
  listContas,
} from './helpers/financial-scenario.helper';

jest.setTimeout(60000);

describe('Strict monetary write contract (e2e)', () => {
  let app: E2eApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);
    app = await createE2eApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects a debt payment above two decimals before financial writes', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '68199965000',
      email: 'monetary.write.contract.e2e@example.com',
      nome: 'Monetary Write Contract E2E',
    });
    const categoria = await createCategoria(app, session, {
      nome: 'Pagamento divida monetary contract',
      tipo: TipoCategoria.DESPESA,
    });
    const conta = await createConta(app, session, {
      nome: 'Conta monetary contract',
      saldoInicial: 1000,
    });
    const divida = await createDivida(app, session, {
      contaId: conta.id,
      nome: 'Divida monetary contract',
    });
    const saldoAntes = Number(
      (await listContas(app, session)).find((item) => item.id === conta.id)
        ?.saldoAtual,
    );
    const pagamentosAntes = await dataSource.getRepository(PagoDivida).count();
    const transacoesAntes = await dataSource.getRepository(Transacao).count();

    const response = await withAuth(
      request(app.getHttpServer()).post('/pagos-divida'),
      session,
    )
      .send(
        makePagoDividaPayload({
          categoriaId: categoria.id,
          contaId: conta.id,
          dividaId: divida.id,
          valor: 100.001,
        }),
      )
      .expect(400);

    expect(response.body).toEqual(
      expect.objectContaining({
        message: expect.arrayContaining([
          'valor deve ter no maximo 2 casas decimais.',
        ]) as string[],
        statusCode: 400,
      }),
    );
    await expect(dataSource.getRepository(PagoDivida).count()).resolves.toBe(
      pagamentosAntes,
    );
    await expect(dataSource.getRepository(Transacao).count()).resolves.toBe(
      transacoesAntes,
    );
    expect(
      Number(
        (await listContas(app, session)).find((item) => item.id === conta.id)
          ?.saldoAtual,
      ),
    ).toBe(saldoAntes);
  });
});
