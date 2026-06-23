import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TipoCategoria } from '../src/categorias/enums/tipo-categoria.enum';
import { TipoConta } from '../src/contas/enums/tipo-conta.enum';
import { PeriodoRelatorio } from '../src/relatorios/enums/periodo-relatorio.enum';
import { TipoTransacao } from '../src/transacoes/enums/tipo-transacao.enum';
import { createE2eApp } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import {
  makeLoginPayload,
  makeRegisterUserPayload,
} from './factories/auth.factory';
import { makeCategoriaPayload } from './factories/categoria.factory';
import { makeContaPayload } from './factories/conta.factory';
import { makeTransacaoPayload } from './factories/transacao.factory';
import { bearer, Identifiable, unwrapSuccess } from './helpers/http.helper';

type LoginResponse = {
  access_token: string;
};

type DashboardResponse = {
  despesasMes: number;
  economiaMes: number;
  gastosPorCategoria: Array<{
    categoriaId: string;
    categoriaNome: string;
    percentual: number;
    total: number;
  }>;
  mesReferencia: string;
  receitasMes: number;
  saldoTotal: number;
  totalContas: number;
  transacoesRecentes: Array<{
    id: string;
    contaNome: string;
    categoriaNome: string;
    tipo: TipoTransacao;
    valor: number;
  }>;
};

type RelatorioResponse = {
  despesasPorCategoria: Array<{
    categoriaId: string;
    categoriaNome: string;
    percentual: number;
    total: number;
  }>;
  periodo: PeriodoRelatorio;
  periodoReferencia: string;
  resumo: {
    economia: number;
    totalDespesas: number;
    totalReceitas: number;
    totalTransacoes: number;
  };
  transacoes: Array<{
    id: string;
    contaNome: string;
    categoriaNome: string;
    tipo: TipoTransacao;
    valor: number;
  }>;
};

jest.setTimeout(60000);

describe('Dashboard and reports (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);

    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('aggregates monthly dashboard and report data from PostgreSQL', async () => {
    const tokenA = await registerAndLogin({
      cpf: '52998224725',
      email: 'dashboard.a.e2e@example.com',
      nome: 'Dashboard Usuario A',
      senha: 'SenhaForte123',
    });
    const tokenB = await registerAndLogin({
      cpf: '39053344705',
      email: 'dashboard.b.e2e@example.com',
      nome: 'Dashboard Usuario B',
      senha: 'OutraSenha123',
    });

    const receitaCategoria = await createCategoria(
      tokenA,
      makeCategoriaPayload({
        nome: 'Receita Dashboard E2E',
        tipo: TipoCategoria.RECEITA,
      }),
    );
    const despesaCategoria = await createCategoria(
      tokenA,
      makeCategoriaPayload({
        nome: 'Despesa Dashboard E2E',
        tipo: TipoCategoria.DESPESA,
      }),
    );
    const conta = await createConta(
      tokenA,
      makeContaPayload({
        nome: 'Conta Dashboard E2E',
        tipo: TipoConta.BANCO,
        saldoInicial: 1000,
      }),
    );

    const receita = await createTransacao(
      tokenA,
      makeTransacaoPayload({
        contaId: conta.id,
        categoriaId: receitaCategoria.id,
        data: '2026-05-01',
        descricao: 'Receita Maio',
        tipo: TipoTransacao.RECEITA,
        valor: 3000,
      }),
    );
    const despesa = await createTransacao(
      tokenA,
      makeTransacaoPayload({
        contaId: conta.id,
        categoriaId: despesaCategoria.id,
        data: '2026-05-02',
        descricao: 'Despesa Maio',
        tipo: TipoTransacao.DESPESA,
        valor: 700,
      }),
    );
    const despesaExcluida = await createTransacao(
      tokenA,
      makeTransacaoPayload({
        contaId: conta.id,
        categoriaId: despesaCategoria.id,
        data: '2026-05-03',
        descricao: 'Despesa Excluida',
        tipo: TipoTransacao.DESPESA,
        valor: 900,
      }),
    );
    await request(app.getHttpServer())
      .delete(`/transacoes/${despesaExcluida.id}`)
      .set(bearer(tokenA))
      .expect(200);

    await createConta(
      tokenB,
      makeContaPayload({
        nome: 'Conta Usuario B',
        saldoInicial: 999,
      }),
    );

    const dashboardResponse = await request(app.getHttpServer())
      .get('/dashboard')
      .query({ mes: '2026-05' })
      .set(bearer(tokenA))
      .expect(200);
    const dashboard = unwrapSuccess<DashboardResponse>(dashboardResponse);

    expect(dashboard).toEqual(
      expect.objectContaining({
        despesasMes: 700,
        economiaMes: 2300,
        mesReferencia: '2026-05',
        receitasMes: 3000,
        saldoTotal: 3300,
        totalContas: 1,
      }),
    );
    expect(dashboard.gastosPorCategoria).toEqual([
      {
        categoriaId: despesaCategoria.id,
        categoriaNome: 'Despesa Dashboard E2E',
        percentual: 100,
        total: 700,
      },
    ]);
    expect(dashboard.transacoesRecentes.map((item) => item.id)).toEqual(
      expect.arrayContaining([receita.id, despesa.id]),
    );
    expect(dashboard.transacoesRecentes.map((item) => item.id)).not.toContain(
      despesaExcluida.id,
    );

    const relatorioResponse = await request(app.getHttpServer())
      .get('/relatorios')
      .query({ mes: '2026-05', periodo: PeriodoRelatorio.MENSAL })
      .set(bearer(tokenA))
      .expect(200);
    const relatorio = unwrapSuccess<RelatorioResponse>(relatorioResponse);

    expect(relatorio.resumo).toEqual({
      economia: 2300,
      totalDespesas: 700,
      totalReceitas: 3000,
      totalTransacoes: 2,
    });
    expect(relatorio.periodo).toBe(PeriodoRelatorio.MENSAL);
    expect(relatorio.periodoReferencia).toBe('2026-05');
    expect(relatorio.transacoes.map((item) => item.id)).toEqual(
      expect.arrayContaining([receita.id, despesa.id]),
    );
    expect(relatorio.transacoes.map((item) => item.id)).not.toContain(
      despesaExcluida.id,
    );
    expect(relatorio.despesasPorCategoria).toEqual([
      {
        categoriaId: despesaCategoria.id,
        categoriaNome: 'Despesa Dashboard E2E',
        percentual: 100,
        total: 700,
      },
    ]);

    const filteredReportResponse = await request(app.getHttpServer())
      .get('/relatorios')
      .query({
        categoriaId: despesaCategoria.id,
        mes: '2026-05',
        periodo: PeriodoRelatorio.MENSAL,
        tipo: TipoTransacao.DESPESA,
      })
      .set(bearer(tokenA))
      .expect(200);
    const filteredReport =
      unwrapSuccess<RelatorioResponse>(filteredReportResponse);

    expect(filteredReport.resumo).toEqual({
      economia: -700,
      totalDespesas: 700,
      totalReceitas: 0,
      totalTransacoes: 1,
    });
    expect(filteredReport.transacoes).toHaveLength(1);
    expect(filteredReport.transacoes[0]).toEqual(
      expect.objectContaining({
        id: despesa.id,
        categoriaNome: 'Despesa Dashboard E2E',
        contaNome: 'Conta Dashboard E2E',
        tipo: TipoTransacao.DESPESA,
        valor: 700,
      }),
    );

    const dashboardUsuarioBResponse = await request(app.getHttpServer())
      .get('/dashboard')
      .query({ mes: '2026-05' })
      .set(bearer(tokenB))
      .expect(200);
    const dashboardUsuarioB = unwrapSuccess<DashboardResponse>(
      dashboardUsuarioBResponse,
    );

    expect(dashboardUsuarioB).toEqual(
      expect.objectContaining({
        despesasMes: 0,
        receitasMes: 0,
        saldoTotal: 999,
        totalContas: 1,
      }),
    );
    expect(dashboardUsuarioB.transacoesRecentes).toEqual([]);
  });

  async function registerAndLogin(input: {
    cpf: string;
    email: string;
    nome: string;
    senha: string;
  }): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(makeRegisterUserPayload(input))
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(
        makeLoginPayload({
          email: input.email,
          senha: input.senha,
        }),
      )
      .expect(200);

    return unwrapSuccess<LoginResponse>(loginResponse).access_token;
  }

  async function createCategoria(
    token: string,
    body: Record<string, unknown>,
  ): Promise<Identifiable> {
    const response = await request(app.getHttpServer())
      .post('/categorias')
      .set(bearer(token))
      .send(body)
      .expect(201);

    return unwrapSuccess<Identifiable>(response);
  }

  async function createConta(
    token: string,
    body: Record<string, unknown>,
  ): Promise<Identifiable> {
    const response = await request(app.getHttpServer())
      .post('/contas')
      .set(bearer(token))
      .send(body)
      .expect(201);

    return unwrapSuccess<Identifiable>(response);
  }

  async function createTransacao(
    token: string,
    body: Record<string, unknown>,
  ): Promise<Identifiable> {
    const response = await request(app.getHttpServer())
      .post('/transacoes')
      .set(bearer(token))
      .send(body)
      .expect(201);

    return unwrapSuccess<Identifiable>(response);
  }
});
