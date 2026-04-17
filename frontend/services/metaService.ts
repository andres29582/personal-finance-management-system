import { CreateMetaRequestDto, Meta, UpdateMetaRequestDto } from '../types/meta';
import { api } from './api';

export async function listMetas(): Promise<Meta[]> {
  const response = await api.get<Meta[]>('/metas');
  return response.data;
}

export async function getMetaById(id: string): Promise<Meta> {
  const response = await api.get<Meta>(`/metas/${id}`);
  return response.data;
}

export async function createMeta(data: CreateMetaRequestDto): Promise<Meta> {
  const response = await api.post<Meta>('/metas', data);
  return response.data;
}

export async function updateMeta(
  id: string,
  data: UpdateMetaRequestDto,
): Promise<Meta> {
  const response = await api.patch<Meta>(`/metas/${id}`, data);
  return response.data;
}

export async function deactivateMeta(id: string): Promise<void> {
  await api.patch(`/metas/${id}/desativar`);
}
