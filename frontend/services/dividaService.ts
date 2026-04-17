import { CreateDividaRequestDto, Divida, UpdateDividaRequestDto } from '../types/divida';
import { api } from './api';

export async function listDividas(): Promise<Divida[]> {
  const response = await api.get<Divida[]>('/dividas');
  return response.data;
}

export async function getDividaById(id: string): Promise<Divida> {
  const response = await api.get<Divida>(`/dividas/${id}`);
  return response.data;
}

export async function createDivida(data: CreateDividaRequestDto): Promise<Divida> {
  const response = await api.post<Divida>('/dividas', data);
  return response.data;
}

export async function updateDivida(
  id: string,
  data: UpdateDividaRequestDto,
): Promise<Divida> {
  const response = await api.patch<Divida>(`/dividas/${id}`, data);
  return response.data;
}

export async function deactivateDivida(id: string): Promise<void> {
  await api.patch(`/dividas/${id}/desativar`);
}
