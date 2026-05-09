import {
  CreateOrcamentoRequestDto,
  Orcamento,
  UpdateOrcamentoRequestDto,
} from '../types/orcamento';
import { api } from '../../../shared/services/api';

export async function listOrcamentos(ano?: string): Promise<Orcamento[]> {
  const response = await api.get<Orcamento[]>('/orcamentos', {
    params: ano ? { ano } : undefined,
  });
  return response.data;
}

export async function getOrcamentoById(id: string): Promise<Orcamento> {
  const response = await api.get<Orcamento>(`/orcamentos/${id}`);
  return response.data;
}

export async function createOrcamento(
  data: CreateOrcamentoRequestDto,
): Promise<Orcamento> {
  const response = await api.post<Orcamento>('/orcamentos', data);
  return response.data;
}

export async function updateOrcamento(
  id: string,
  data: UpdateOrcamentoRequestDto,
): Promise<Orcamento> {
  const response = await api.patch<Orcamento>(`/orcamentos/${id}`, data);
  return response.data;
}
