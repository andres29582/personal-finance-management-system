import { TipoTransacao } from '../../transacoes/types/transacao';

export type PeriodoRelatorio = 'intervalo' | 'mensal' | 'trimestral';

export type RelatorioResumo = {
  economia: number;
  totalDespesas: number;
  totalReceitas: number;
  totalTransacoes: number;
};

export type RelatorioCategoria = {
  categoriaId: string;
  categoriaNome: string;
  percentual: number;
  total: number;
};

export type RelatorioTransacao = {
  categoriaId: string;
  categoriaNome: string;
  contaId: string;
  contaNome: string;
  data: string;
  descricao: string | null;
  id: string;
  tipo: TipoTransacao;
  valor: number;
};

export type RelatorioResponse = {
  despesasPorCategoria: RelatorioCategoria[];
  periodo: PeriodoRelatorio;
  periodoReferencia: string;
  resumo: RelatorioResumo;
  transacoes: RelatorioTransacao[];
};

export type GetRelatorioParams = {
  ano?: string;
  categoriaId?: string;
  contaId?: string;
  dataFim?: string;
  dataInicio?: string;
  mes?: string;
  periodo: PeriodoRelatorio;
  trimestre?: string;
  tipo?: TipoTransacao;
};
