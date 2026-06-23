import { describe, expect, it } from '@jest/globals';
import {
  dashboardSidebarItems,
  mapBudgetOverview,
  mapCategoryBars,
  mapDashboardMetrics,
  mapGoalOverview,
  mapMonthlyComparison,
} from '../utils/dashboardMappers';

function normalizeCurrency(value: string) {
  return value.replace(/\u00a0/g, ' ');
}

describe('dashboardMappers', () => {
  it('maps financial metrics with labels and formatted currency', () => {
    const metrics = mapDashboardMetrics({
      despesasMes: 3000,
      economiaMes: 2000,
      receitasMes: 8000,
      saldoTotal: 5000,
    });

    expect(metrics).toMatchObject([
      { accent: 'cyan', label: 'Saldo total' },
      { accent: 'cyan', label: 'Receitas do mes' },
      { accent: 'magenta', label: 'Despesas do mes' },
      { accent: 'mixed', label: 'Economia' },
    ]);
    expect(metrics.map((metric) => normalizeCurrency(metric.value))).toEqual([
      'R$ 5.000,00',
      'R$ 8.000,00',
      'R$ 3.000,00',
      'R$ 2.000,00',
    ]);
  });

  it('maps category bars with proportional width and formatted totals', () => {
    const bars = mapCategoryBars([
      {
        categoriaId: '1',
        categoriaNome: 'Moradia',
        percentual: 70,
        total: 700,
      },
      {
        categoriaId: '2',
        categoriaNome: 'Transporte',
        percentual: 30,
        total: 350,
      },
    ]);

    expect(bars).toMatchObject([
      { categoriaId: '1', widthPercent: 100 },
      { categoriaId: '2', widthPercent: 50 },
    ]);
    expect(bars.map((bar) => normalizeCurrency(bar.totalFormatado))).toEqual([
      'R$ 700,00',
      'R$ 350,00',
    ]);
  });

  it('maps monthly comparison between current and previous month', () => {
    const comparison = mapMonthlyComparison({
      despesas: {
        anterior: 2500,
        atual: 3000,
        diferenca: 500,
        percentual: 20,
      },
      mesAnterior: '2026-04',
      mesAtual: '2026-05',
      receitas: {
        anterior: 6000,
        atual: 8000,
        diferenca: 2000,
        percentual: 33.33,
      },
    });

    expect(comparison).toMatchObject({
      mesAnterior: '2026-04',
      mesAtual: '2026-05',
      items: [
        { label: 'Receitas', status: 'up', variationLabel: '+33.33% vs mes anterior' },
        { label: 'Despesas', status: 'up', variationLabel: '+20.00% vs mes anterior' },
      ],
    });
    expect(
      comparison.items.map((item) => normalizeCurrency(item.currentFormatted)),
    ).toEqual(['R$ 8.000,00', 'R$ 3.000,00']);
    expect(
      comparison.items.map((item) =>
        normalizeCurrency(item.differenceFormatted),
      ),
    ).toEqual(['+R$ 2.000,00', '+R$ 500,00']);
  });

  it('keeps all dashboard navigation entries in the sidebar', () => {
    expect(dashboardSidebarItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Dashboard', route: '/dashboard' }),
        expect.objectContaining({ label: 'Contas', route: '/contas' }),
        expect.objectContaining({ label: 'Transacoes', route: '/transacoes' }),
        expect.objectContaining({ label: 'Senha', route: '/reset-password' }),
      ]),
    );
  });

  it('maps monthly budget overview', () => {
    const budget = mapBudgetOverview({
      createdAt: '2026-05-01',
      gastoAtual: 400,
      id: 'orc-1',
      mesReferencia: '2026-05',
      percentualUtilizado: 40,
      restante: 600,
      statusAlerta: 'normal',
      updatedAt: '2026-05-01',
      usuarioId: '1',
      valorPlanejado: 1000,
    });

    expect(budget).toMatchObject({
      percentualUtilizado: 40,
      statusAlerta: 'normal',
    });
    expect(normalizeCurrency(budget?.valorPlanejadoFormatado ?? '')).toBe(
      'R$ 1.000,00',
    );
    expect(normalizeCurrency(budget?.gastoAtualFormatado ?? '')).toBe(
      'R$ 400,00',
    );
    expect(normalizeCurrency(budget?.restanteFormatado ?? '')).toBe(
      'R$ 600,00',
    );
  });

  it('maps highlighted goal overview', () => {
    const goal = mapGoalOverview({
      ativa: true,
      contaId: null,
      createdAt: '2026-05-01',
      dividaId: null,
      fechaLimite: '2026-12-31',
      id: 'meta-1',
      montoActual: 250,
      montoObjetivo: 1000,
      nome: 'Viagem a Europa',
      tipo: 'economia',
      usuarioId: '1',
    });

    expect(goal).toMatchObject({
      nome: 'Viagem a Europa',
      percentual: 25,
    });
    expect(normalizeCurrency(goal?.montoActualFormatado ?? '')).toBe(
      'R$ 250,00',
    );
    expect(normalizeCurrency(goal?.montoObjetivoFormatado ?? '')).toBe(
      'R$ 1.000,00',
    );
    expect(normalizeCurrency(goal?.faltaFormatada ?? '')).toBe('R$ 750,00');
  });
});
