import { buildRelatorioParams } from '../utils/relatorioFilters';

describe('buildRelatorioParams', () => {
  const baseInput = {
    ano: '2026',
    categoriaId: '',
    contaId: '',
    dataFim: '',
    dataInicio: '',
    mes: '2026-06',
    periodo: 'mensal' as const,
    tipo: '',
    trimestre: '2',
  };

  it('builds monthly params with optional filters only when selected', () => {
    expect(
      buildRelatorioParams({
        ...baseInput,
        categoriaId: 'categoria1',
        contaId: 'conta1',
        tipo: 'despesa',
      }),
    ).toEqual({
      categoriaId: 'categoria1',
      contaId: 'conta1',
      mes: '2026-06',
      periodo: 'mensal',
      tipo: 'despesa',
    });
  });

  it('builds quarterly params without leaking monthly fields', () => {
    expect(
      buildRelatorioParams({
        ...baseInput,
        periodo: 'trimestral',
      }),
    ).toEqual({
      ano: '2026',
      periodo: 'trimestral',
      trimestre: '2',
    });
  });

  it('builds interval params without empty optional filters', () => {
    expect(
      buildRelatorioParams({
        ...baseInput,
        dataFim: '2026-06-30',
        dataInicio: '2026-06-01',
        periodo: 'intervalo',
      }),
    ).toEqual({
      dataFim: '2026-06-30',
      dataInicio: '2026-06-01',
      periodo: 'intervalo',
    });
  });
});
