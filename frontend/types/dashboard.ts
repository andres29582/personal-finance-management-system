import { TipoConta } from './conta';
import { TipoTransacao } from './transacao';

export type DashboardContaResumo = {
  id: string;
  moeda: string;
  nome: string;
  saldoAtual: number;
  tipo: TipoConta;
};

export type DashboardGastoCategoria = {
  categoriaId: string;
  categoriaNome: string;
  percentual: number;
  total: number;
};

export type DashboardTransacaoRecente = {
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

export type DashboardResponse = {
  contas: DashboardContaResumo[];
  despesasMes: number;
  economiaMes: number;
  gastosPorCategoria: DashboardGastoCategoria[];
  mesReferencia: string;
  receitasMes: number;
  saldoTotal: number;
  totalContas: number;
  transacoesRecentes: DashboardTransacaoRecente[];
};
