import { CreatePagoDividaRequestDto, PagoDivida } from '../types/pago-divida';
import { api } from './api';

export async function listPagosByDivida(dividaId: string): Promise<PagoDivida[]> {
  const response = await api.get<PagoDivida[]>(`/pagos-divida/divida/${dividaId}`);
  return response.data;
}

export async function getPagoDividaById(id: string): Promise<PagoDivida> {
  const response = await api.get<PagoDivida>(`/pagos-divida/${id}`);
  return response.data;
}

export async function createPagoDivida(
  data: CreatePagoDividaRequestDto,
): Promise<PagoDivida> {
  const response = await api.post<PagoDivida>('/pagos-divida', data);
  return response.data;
}

export async function removePagoDivida(id: string): Promise<void> {
  await api.delete(`/pagos-divida/${id}`);
}
