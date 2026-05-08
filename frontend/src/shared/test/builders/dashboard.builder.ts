import { DashboardResponse } from '../../../../types/dashboard';

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
