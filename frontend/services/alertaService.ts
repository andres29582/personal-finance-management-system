import {
  Alerta,
  CreateAlertaRequestDto,
  UpdateAlertaRequestDto,
} from '../types/alerta';
import { api } from './api';

export async function listAlertas(): Promise<Alerta[]> {
  const response = await api.get<Alerta[]>('/alertas');
  return response.data;
}

export async function getAlertaById(id: string): Promise<Alerta> {
  const response = await api.get<Alerta>(`/alertas/${id}`);
  return response.data;
}

export async function createAlerta(
  data: CreateAlertaRequestDto,
): Promise<Alerta> {
  const response = await api.post<Alerta>('/alertas', data);
  return response.data;
}

export async function updateAlerta(
  id: string,
  data: UpdateAlertaRequestDto,
): Promise<Alerta> {
  const response = await api.patch<Alerta>(`/alertas/${id}`, data);
  return response.data;
}

export async function deactivateAlerta(id: string): Promise<void> {
  await api.patch(`/alertas/${id}/desativar`);
}

export async function markAlertaAsNotified(id: string): Promise<void> {
  await api.patch(`/alertas/${id}/notificar`);
}
