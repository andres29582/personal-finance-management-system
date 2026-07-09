import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TipoCategoria } from '../src/categorias/enums/tipo-categoria.enum';
import { TipoConta } from '../src/contas/enums/tipo-conta.enum';
import { TipoTransacao } from '../src/transacoes/enums/tipo-transacao.enum';
import { createE2eApp } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { registerAndLoginTestUser, withAuth } from './helpers/auth.e2e-helper';
import { E2E_DATE_VALUES } from './helpers/date.helper';
import { expectApiSuccess, expectMoney } from './helpers/expectations.helper';
import { expectSaldo } from './helpers/financial-assertions.helper';
import {
  createCategoria,
  createConta,
  createDivida,
  createPagoDivida,
  createTransferencia,
  listContas,
} from './helpers/financial-scenario.helper';
import { Identifiable } from './helpers/http.helper';

type DebtPaymentResponse = Identifiable & {
  transacaoId: string;
};

type TransacaoResponse = Identifiable & {
  contaId: string;
  categoriaId: string;
  tipo: TipoTransacao;
  valor: number | string;
};

jest.setTimeout(60000);

describe('Financial consistency regressions (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);

    app = await createE2eApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reverts transfer balance effects after soft delete', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'financial.transfer.delete.e2e@example.com',
      nome: 'Financial Transfer Delete E2E',
    });
    const origem = await createConta(app, session, {
      nome: 'Origem transferencia delete',
      saldoInicial: 1000,
      tipo: TipoConta.BANCO,
    });
    const destino = await createConta(app, session, {
      nome: 'Destino transferencia delete',
      saldoInicial: 100,
      tipo: TipoConta.DINHEIRO,
    });

    const transferencia = await createTransferencia(app, session, {
      comissao: 12,
      contaDestinoId: destino.id,
      contaOrigemId: origem.id,
      data: E2E_DATE_VALUES.transfer,
      descricao: 'Transferencia para soft delete',
      valor: 250,
    });

    let contas = await listContas(app, session);
    expectSaldo(contas, origem.id, 738);
    expectSaldo(contas, destino.id, 350);

    await withAuth(
      request(app.getHttpServer()).delete(`/transferencias/${transferencia.id}`),
      session,
    ).expect(200);
    await withAuth(
      request(app.getHttpServer()).get(`/transferencias/${transferencia.id}`),
      session,
    ).expect(404);

    contas = await listContas(app, session);
    expectSaldo(contas, origem.id, 1000);
    expectSaldo(contas, destino.id, 100);
  });

  it('reverts debt payment balance effects and hides its transaction after soft delete', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '39053344705',
      email: 'financial.debt-payment.delete.e2e@example.com',
      nome: 'Financial Debt Payment Delete E2E',
    });
    const categoriaPagamento = await createCategoria(app, session, {
      nome: 'Pagamento divida delete',
      tipo: TipoCategoria.DESPESA,
    });
    const conta = await createConta(app, session, {
      nome: 'Conta pagamento delete',
      saldoInicial: 1000,
      tipo: TipoConta.BANCO,
    });
    const divida = await createDivida(app, session, {
      contaId: conta.id,
      fechaInicio: E2E_DATE_VALUES.debtStart,
      fechaVencimiento: E2E_DATE_VALUES.debtDue,
      montoTotal: 800,
      nome: 'Divida pagamento delete',
      proximoVencimiento: E2E_DATE_VALUES.debtDue,
    });

    const pagamento = await createPagoDivida(app, session, {
      categoriaId: categoriaPagamento.id,
      contaId: conta.id,
      data: E2E_DATE_VALUES.debtPayment,
      descricao: 'Pagamento para soft delete',
      dividaId: divida.id,
      valor: 175,
    });

    expect(pagamento.transacaoId).toEqual(expect.any(String));

    let contas = await listContas(app, session);
    expectSaldo(contas, conta.id, 825);

    const transacaoResponse = await withAuth(
      request(app.getHttpServer()).get(
        `/transacoes/${pagamento.transacaoId}`,
      ),
      session,
    ).expect(200);
    const transacao = expectApiSuccess<TransacaoResponse>(transacaoResponse);

    expect(transacao).toEqual(
      expect.objectContaining({
        categoriaId: categoriaPagamento.id,
        contaId: conta.id,
        id: pagamento.transacaoId,
        tipo: TipoTransacao.DESPESA,
      }),
    );
    expectMoney(transacao.valor, 175);

    await withAuth(
      request(app.getHttpServer()).delete(`/pagos-divida/${pagamento.id}`),
      session,
    ).expect(200);
    await withAuth(
      request(app.getHttpServer()).get(`/pagos-divida/${pagamento.id}`),
      session,
    ).expect(404);
    await withAuth(
      request(app.getHttpServer()).get(
        `/transacoes/${pagamento.transacaoId}`,
      ),
      session,
    ).expect(404);

    contas = await listContas(app, session);
    expectSaldo(contas, conta.id, 1000);
  });
});
