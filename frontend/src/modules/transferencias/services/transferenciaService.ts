import {
  CreateTransferenciaRequestDto,
  Transferencia,
  UpdateTransferenciaRequestDto,
} from '../types/transferencia';
import { api } from '../../../shared/services/api';

export async function listTransferencias(): Promise<Transferencia[]> {
  const response = await api.get<Transferencia[]>('/transferencias');
  return response.data;
}

export async function getTransferenciaById(id: string): Promise<Transferencia> {
  const response = await api.get<Transferencia>(`/transferencias/${id}`);
  return response.data;
}

export async function createTransferencia(
  data: CreateTransferenciaRequestDto,
): Promise<Transferencia> {
  const response = await api.post<Transferencia>('/transferencias', data);
  return response.data;
}

export async function updateTransferencia(
  id: string,
  data: UpdateTransferenciaRequestDto,
): Promise<Transferencia> {
  const response = await api.patch<Transferencia>(`/transferencias/${id}`, data);
  return response.data;
}

export async function removeTransferencia(id: string): Promise<void> {
  await api.delete(`/transferencias/${id}`);
}
