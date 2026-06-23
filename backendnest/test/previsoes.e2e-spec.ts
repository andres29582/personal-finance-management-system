import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TipoCategoria } from '../src/categorias/enums/tipo-categoria.enum';
import { TipoConta } from '../src/contas/enums/tipo-conta.enum';
import { MlPredictClientService } from '../src/previsoes/services/ml-predict-client.service';
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
import { DataSource } from 'typeorm';

type LoginResponse = {
  access_token: string;
};

type PrevisaoDeficitResponse = {
  schemaVersion: 2;
  deficitPrevisto: boolean;
  indicadores: {
    historicoMeses: number;
    saldoInicialMes: number;
    mediaReceitas3Meses: number;
    mediaDespesas3Meses: number;
    tendenciaReceitas3Meses: number;
    tendenciaDespesas3Meses: number;
    taxaDeficit3Meses: number;
  };
  mensagem: string;
  mesReferencia: string;
  prediction: number;
  probability: number;
  risco: 'baixo' | 'moderado' | 'alto';
};

jest.setTimeout(60000);

describe('Previsoes (e2e)', () => {
  let app: INestApplication;
  let predictMock: jest.Mock;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);

    predictMock = jest.fn().mockResolvedValue({
      schema_version: 2,
      prediction: 1,
      probability: 0.73456,
    });

    app = await createE2eApp({
      overrideProviders: [
        {
          provide: MlPredictClientService,
          useValue: {
            predict: predictMock,
          },
        },
      ],
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('builds deficit features from PostgreSQL data and returns controlled ML prediction', async () => {
    const tokenA = await registerAndLogin({
      cpf: '52998224725',
      email: 'previsao.a.e2e@example.com',
      nome: 'Previsao Usuario A',
      senha: 'SenhaForte123',
    });
    const tokenB = await registerAndLogin({
      cpf: '39053344705',
      email: 'previsao.b.e2e@example.com',
      nome: 'Previsao Usuario B',
      senha: 'OutraSenha123',
    });

    const receitaCategoria = await createCategoria(
      tokenA,
      makeCategoriaPayload({
        nome: 'Receita Previsao E2E',
        tipo: TipoCategoria.RECEITA,
      }),
    );
    const despesaCategoria = await createCategoria(
      tokenA,
      makeCategoriaPayload({
        nome: 'Despesa Previsao E2E',
        tipo: TipoCategoria.DESPESA,
      }),
    );
    const contaA = await createConta(
      tokenA,
      makeContaPayload({
        nome: 'Conta Previsao A',
        tipo: TipoConta.BANCO,
        saldoInicial: 1000,
      }),
    );

    await createTransacao(
      tokenA,
      makeTransacaoPayload({
        contaId: contaA.id,
        categoriaId: receitaCategoria.id,
        data: '2026-03-10',
        descricao: 'Receita marco',
        tipo: TipoTransacao.RECEITA,
        valor: 1000,
      }),
    );
    await createTransacao(
      tokenA,
      makeTransacaoPayload({
        contaId: contaA.id,
        categoriaId: despesaCategoria.id,
        data: '2026-03-20',
        descricao: 'Despesa marco',
        tipo: TipoTransacao.DESPESA,
        valor: 1500,
      }),
    );
    await createTransacao(
      tokenA,
      makeTransacaoPayload({
        contaId: contaA.id,
        categoriaId: receitaCategoria.id,
        data: '2026-04-10',
        descricao: 'Receita anterior',
        tipo: TipoTransacao.RECEITA,
        valor: 500,
      }),
    );
    await createTransacao(
      tokenA,
      makeTransacaoPayload({
        contaId: contaA.id,
        categoriaId: despesaCategoria.id,
        data: '2026-04-20',
        descricao: 'Despesa anterior',
        tipo: TipoTransacao.DESPESA,
        valor: 100,
      }),
    );
    await createTransacao(
      tokenA,
      makeTransacaoPayload({
        contaId: contaA.id,
        categoriaId: receitaCategoria.id,
        data: '2026-05-01',
        descricao: 'Receita maio',
        tipo: TipoTransacao.RECEITA,
        valor: 3000,
      }),
    );
    await createTransacao(
      tokenA,
      makeTransacaoPayload({
        contaId: contaA.id,
        categoriaId: despesaCategoria.id,
        data: '2026-05-05',
        descricao: 'Despesa maio 1',
        tipo: TipoTransacao.DESPESA,
        valor: 800,
      }),
    );
    await createTransacao(
      tokenA,
      makeTransacaoPayload({
        contaId: contaA.id,
        categoriaId: despesaCategoria.id,
        data: '2026-05-10',
        descricao: 'Despesa maio 2',
        tipo: TipoTransacao.DESPESA,
        valor: 1200,
      }),
    );

    const receitaCategoriaB = await createCategoria(
      tokenB,
      makeCategoriaPayload({
        nome: 'Receita Previsao B',
        tipo: TipoCategoria.RECEITA,
      }),
    );
    const contaB = await createConta(
      tokenB,
      makeContaPayload({
        nome: 'Conta Previsao B',
        saldoInicial: 9999,
      }),
    );
    await createTransacao(
      tokenB,
      makeTransacaoPayload({
        contaId: contaB.id,
        categoriaId: receitaCategoriaB.id,
        data: '2026-05-01',
        descricao: 'Receita usuario B',
        tipo: TipoTransacao.RECEITA,
        valor: 9999,
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/previsoes/deficit')
      .query({ mes: '2026-05' })
      .set(bearer(tokenA))
      .expect(200);
    const previsao = unwrapSuccess<PrevisaoDeficitResponse>(response);

    expect(predictMock).toHaveBeenCalledWith({
      receita_lag_1: 500,
      despesa_lag_1: 100,
      media_receita_3m: 500,
      media_despesa_3m: 533.3333,
      tendencia_receita_3m: 250,
      tendencia_despesa_3m: 50,
      volatilidade_despesa_3m: 838.6497,
      media_transacoes_receita_3m: 0.6667,
      media_transacoes_despesa_3m: 0.6667,
      taxa_deficit_3m: 0.3333,
      saldo_inicial_mes: 900,
      mes_do_ano: 5,
    });
    expect(previsao).toEqual(
      expect.objectContaining({
        deficitPrevisto: true,
        mensagem: 'Existe risco alto de deficit para o mes selecionado.',
        mesReferencia: '2026-05',
        prediction: 1,
        probability: 0.7346,
        risco: 'alto',
        schemaVersion: 2,
      }),
    );
    expect(previsao.indicadores).toEqual({
      historicoMeses: 3,
      saldoInicialMes: 900,
      mediaReceitas3Meses: 500,
      mediaDespesas3Meses: 533.3333,
      tendenciaReceitas3Meses: 250,
      tendenciaDespesas3Meses: 50,
      taxaDeficit3Meses: 0.3333,
    });
  });

  it('rejects malformed month references before calling the ML client', async () => {
    const token = await registerAndLogin({
      cpf: '68199965000',
      email: 'previsao.invalid-month.e2e@example.com',
      nome: 'Previsao Mes Invalido',
      senha: 'SenhaForte123',
    });
    predictMock.mockClear();

    await request(app.getHttpServer())
      .get('/previsoes/deficit')
      .query({ mes: '05-2026' })
      .set(bearer(token))
      .expect(400);

    expect(predictMock).not.toHaveBeenCalled();
  });

  it('returns 422 without calling ML when history is insufficient', async () => {
    const token = await registerAndLogin(
      {
        cpf: '11144477735',
        email: 'previsao.new-user.e2e@example.com',
        nome: 'Previsao Usuario Novo',
        senha: 'SenhaForte123',
      },
      false,
    );
    predictMock.mockClear();

    const response = await request(app.getHttpServer())
      .get('/previsoes/deficit')
      .query({ mes: '2026-06' })
      .set(bearer(token))
      .expect(422);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        error: {
          code: 'PREVISAO_INSUFFICIENT_HISTORY',
          message:
            'Sao necessarios tres meses completos de historico para gerar a previsao.',
          details: { requiredMonths: 3, availableMonths: 0 },
        },
      }),
    );
    expect(predictMock).not.toHaveBeenCalled();
  });

  async function registerAndLogin(
    input: {
      cpf: string;
      email: string;
      nome: string;
      senha: string;
    },
    backdateRegistration = true,
  ): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(makeRegisterUserPayload(input))
      .expect(201);

    if (backdateRegistration) {
      await app
        .get(DataSource)
        .query('UPDATE usuario SET data_registro = $1 WHERE email = $2', [
          '2026-01-01T00:00:00.000Z',
          input.email,
        ]);
    }

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

    const account = unwrapSuccess<Identifiable>(response);
    await app
      .get(DataSource)
      .query('UPDATE conta SET created_at = $1 WHERE id = $2', [
        '2026-01-01T00:00:00.000Z',
        account.id,
      ]);
    return account;
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
