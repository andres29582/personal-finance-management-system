export type RiscoDeficit = "baixo" | "moderado" | "alto";

export type DeficitFeatures = {
  receita_mes: number;
  despesa_mes: number;
  saldo_inicial_mes: number;
  num_transacoes_despesa: number;
  num_transacoes_receita: number;
  volatilidade_despesa: number;
};

export type PrevisaoDeficitResponse = {
  deficitPrevisto: boolean;
  features: DeficitFeatures;
  mensagem: string;
  mesReferencia: string;
  prediction: number;
  probability: number;
  risco: RiscoDeficit;
};
