import {
  Categoria,
  CreateCategoriaRequestDto,
  TipoCategoria,
  UpdateCategoriaRequestDto,
} from '../types/categoria';
import { api } from '../../../shared/services/api';

export async function listCategorias(tipo?: TipoCategoria): Promise<Categoria[]> {
  const response = await api.get<Categoria[]>('/categorias', {
    params: tipo ? { tipo } : undefined,
  });
  return response.data;
}

export async function getCategoriaById(id: string): Promise<Categoria> {
  const response = await api.get<Categoria>(`/categorias/${id}`);
  return response.data;
}

export async function createCategoria(
  data: CreateCategoriaRequestDto,
): Promise<Categoria> {
  const response = await api.post<Categoria>('/categorias', data);
  return response.data;
}

export async function updateCategoria(
  id: string,
  data: UpdateCategoriaRequestDto,
): Promise<Categoria> {
  const response = await api.patch<Categoria>(`/categorias/${id}`, data);
  return response.data;
}

export async function deactivateCategoria(id: string): Promise<void> {
  await api.patch(`/categorias/${id}/desativar`);
}
