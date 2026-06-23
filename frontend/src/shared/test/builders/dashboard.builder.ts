import { DashboardResponse } from '../../../modules/dashboard/types/dashboard';

export function makeDashboard(
  overrides: Partial<DashboardResponse> = {},
): DashboardResponse {
  return {
    comparativoMensal: {
      despesas: {
        anterior: 2500,
        atual: 3000,
        diferenca: 500,
        percentual: 20,
      },
      mesAnterior: '2026-04',
      mesAtual: '2026-05',
      receitas: {
        anterior: 4500,
        atual: 5000,
        diferenca: 500,
        percentual: 11.11,
      },
    },
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
