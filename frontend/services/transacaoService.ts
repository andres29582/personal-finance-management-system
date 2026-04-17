import {
  CreateTransacaoRequestDto,
  FindTransacoesParams,
  Transacao,
  UpdateTransacaoRequestDto,
} from '../types/transacao';
import { api } from './api';

export async function listTransacoes(
  params?: FindTransacoesParams,
): Promise<Transacao[]> {
  const response = await api.get<Transacao[]>('/transacoes', { params });
  return response.data;
}

export async function getTransacaoById(id: string): Promise<Transacao> {
  const response = await api.get<Transacao>(`/transacoes/${id}`);
  return response.data;
}

export async function createTransacao(
  data: CreateTransacaoRequestDto,
): Promise<Transacao> {
  const response = await api.post<Transacao>('/transacoes', data);
  return response.data;
}

export async function updateTransacao(
  id: string,
  data: UpdateTransacaoRequestDto,
): Promise<Transacao> {
  const response = await api.patch<Transacao>(`/transacoes/${id}`, data);
  return response.data;
}

export async function removeTransacao(id: string): Promise<void> {
  await api.delete(`/transacoes/${id}`);
}
