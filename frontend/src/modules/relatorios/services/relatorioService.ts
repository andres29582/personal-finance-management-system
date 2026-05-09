import { GetRelatorioParams, RelatorioResponse } from '../types/relatorio';
import { api } from '../../../shared/services/api';

export async function getRelatorio(
  params: GetRelatorioParams,
): Promise<RelatorioResponse> {
  const response = await api.get<RelatorioResponse>('/relatorios', { params });
  return response.data;
}
