import { Categoria } from '../../types/categoria';
import { Conta } from '../../types/conta';
import { DashboardResponse } from '../../types/dashboard';
import { Divida } from '../../types/divida';
import { PagoDivida } from '../../types/pago-divida';
import { RelatorioResponse } from '../../types/relatorio';
import { Transacao } from '../../types/transacao';
import { Transferencia } from '../../types/transferencia';

export const TEST_DATE = '2026-05-01';
export const TEST_TIMESTAMP = '2026-05-01T12:00:00.000Z';

export function makeConta(overrides: Partial<Conta> = {}): Conta {
  return {
    ativa: true,
    createdAt: TEST_TIMESTAMP,
    dataCorte: null,
    dataPagamento: null,
    id: 'conta1',
    limiteCredito: null,
    moeda: 'BRL',
    nome: 'Conta Corrente',
    saldoAtual: 1000,
    saldoInicial: 1000,
    tipo: 'banco',
    updatedAt: TEST_TIMESTAMP,
    usuarioId: 'user1',
    ...overrides,
  };
}

export function makeCategoria(overrides: Partial<Categoria> = {}): Categoria {
  return {
    ativa: true,
    cor: '#2F80ED',
    createdAt: TEST_TIMESTAMP,
    icone: 'tag',
    id: 'cat1',
    nome: 'Alimentacao',
    tipo: 'despesa',
    usuarioId: 'user1',
    ...overrides,
  };
}

export function makeTransacao(overrides: Partial<Transacao> = {}): Transacao {
  return {
    categoriaId: 'cat1',
    contaId: 'conta1',
    createdAt: TEST_TIMESTAMP,
    data: TEST_DATE,
    descricao: 'Compra mercado',
    ehAjuste: false,
    id: 'transacao1',
    tipo: 'despesa',
    updatedAt: TEST_TIMESTAMP,
    usuarioId: 'user1',
    valor: 50,
    ...overrides,
  };
}

export function makeTransferencia(
  overrides: Partial<Transferencia> = {},
): Transferencia {
  return {
    comissao: 0,
    contaDestinoId: 'conta2',
    contaOrigemId: 'conta1',
    createdAt: TEST_TIMESTAMP,
    data: TEST_DATE,
    descricao: 'Transferencia entre contas',
    id: 'transferencia1',
    moeda: 'BRL',
    updatedAt: TEST_TIMESTAMP,
    usuarioId: 'user1',
    valor: 200,
    ...overrides,
  };
}

export function makeDivida(overrides: Partial<Divida> = {}): Divida {
  return {
    ativa: true,
    contaId: 'conta1',
    createdAt: TEST_TIMESTAMP,
    cuotaMensual: 500,
    fechaInicio: TEST_DATE,
    fechaVencimiento: '2026-12-01',
    id: 'divida1',
    montoTotal: 5000,
    nome: 'Emprestimo banco',
    periodicidade: 'mensal',
    proximoVencimiento: '2026-06-01',
    tasaInteres: null,
    usuarioId: 'user1',
    ...overrides,
  };
}

export function makePagoDivida(overrides: Partial<PagoDivida> = {}): PagoDivida {
  return {
    contaId: 'conta1',
    data: TEST_DATE,
    descricao: 'Pagamento da divida',
    dividaId: 'divida1',
    id: 'pago1',
    transacaoId: 'transacao1',
    usuarioId: 'user1',
    valor: 500,
    ...overrides,
  };
}

export function makeDashboard(
  overrides: Partial<DashboardResponse> = {},
): DashboardResponse {
  return {
    contas: [],
    despesasMes: 3000,
    economiaMes: 2000,
    gastosPorCategoria: [],
    mesReferencia: '2026-05',
    receitasMes: 5000,
    saldoTotal: 7000,
    totalContas: 0,
    transacoesRecentes: [],
    ...overrides,
  };
}

export function makeRelatorio(
  overrides: Partial<RelatorioResponse> = {},
): RelatorioResponse {
  return {
    despesasPorCategoria: [],
    periodo: 'intervalo',
    periodoReferencia: '2026-05',
    resumo: {
      economia: 2000,
      totalDespesas: 3000,
      totalReceitas: 5000,
      totalTransacoes: 8,
    },
    transacoes: [],
    ...overrides,
  };
}
