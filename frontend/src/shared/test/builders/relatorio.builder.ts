import { RelatorioResponse } from '../../../../types/relatorio';

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
