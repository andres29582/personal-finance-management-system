import {
  GetRelatorioParams,
  PeriodoRelatorio,
} from '../types/relatorio';

type BuildRelatorioParamsInput = {
  ano: string;
  categoriaId: string;
  contaId: string;
  dataFim: string;
  dataInicio: string;
  mes: string;
  periodo: PeriodoRelatorio;
  tipo: string;
  trimestre: string;
};

export function buildRelatorioParams({
  ano,
  categoriaId,
  contaId,
  dataFim,
  dataInicio,
  mes,
  periodo,
  tipo,
  trimestre,
}: BuildRelatorioParamsInput): GetRelatorioParams {
  const params: GetRelatorioParams = { periodo };

  if (periodo === 'mensal') {
    params.mes = mes;
  }

  if (periodo === 'trimestral') {
    params.ano = ano;
    params.trimestre = trimestre;
  }

  if (periodo === 'intervalo') {
    params.dataInicio = dataInicio;
    params.dataFim = dataFim;
  }

  if (tipo) {
    params.tipo = tipo as GetRelatorioParams['tipo'];
  }

  if (contaId) {
    params.contaId = contaId;
  }

  if (categoriaId) {
    params.categoriaId = categoriaId;
  }

  return params;
}
