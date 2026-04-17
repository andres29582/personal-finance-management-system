import { Conta, CreateContaRequestDto, UpdateContaRequestDto } from '../types/conta';
import { api } from './api';

export async function listContas(): Promise<Conta[]> {
  const response = await api.get<Conta[]>('/contas');
  return response.data;
}

export async function getContaById(id: string): Promise<Conta> {
  const response = await api.get<Conta>(`/contas/${id}`);
  return response.data;
}

export async function createConta(data: CreateContaRequestDto): Promise<Conta> {
  const response = await api.post<Conta>('/contas', data);
  return response.data;
}

export async function updateConta(id: string, data: UpdateContaRequestDto): Promise<Conta> {
  const response = await api.patch<Conta>(`/contas/${id}`, data);
  return response.data;
}

export async function deactivateConta(id: string): Promise<void> {
  await api.patch(`/contas/${id}/desativar`);
}
