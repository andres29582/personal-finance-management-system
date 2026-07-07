import {
  AddParticipantePlanejamentoRequest,
  CreateGastoPlanejamentoRequest,
  CreatePlanejamentoRequest,
  GastoPlanejamento,
  ParticipantePlanejamento,
  Planejamento,
  PlanejamentoStatus,
} from '../types/planejamento';
import { api } from '../../../shared/services/api';

export async function listPlanejamentos(
  status?: PlanejamentoStatus,
): Promise<Planejamento[]> {
  const response = await api.get<Planejamento[]>('/planejamentos', {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function createPlanejamento(
  data: CreatePlanejamentoRequest,
): Promise<Planejamento> {
  const response = await api.post<Planejamento>('/planejamentos', data);
  return response.data;
}

export async function getPlanejamentoById(id: string): Promise<Planejamento> {
  const response = await api.get<Planejamento>(`/planejamentos/${id}`);
  return response.data;
}

export async function addParticipantePlanejamento(
  planejamentoId: string,
  data: AddParticipantePlanejamentoRequest,
): Promise<ParticipantePlanejamento> {
  const response = await api.post<ParticipantePlanejamento>(
    `/planejamentos/${planejamentoId}/participantes`,
    data,
  );
  return response.data;
}

export async function listGastosPlanejamento(
  planejamentoId: string,
): Promise<GastoPlanejamento[]> {
  const response = await api.get<GastoPlanejamento[]>(
    `/planejamentos/${planejamentoId}/gastos`,
  );
  return response.data;
}

export async function createGastoPlanejamento(
  planejamentoId: string,
  data: CreateGastoPlanejamentoRequest,
): Promise<GastoPlanejamento> {
  const response = await api.post<GastoPlanejamento>(
    `/planejamentos/${planejamentoId}/gastos`,
    data,
  );
  return response.data;
}

export async function getGastoPlanejamentoById(
  planejamentoId: string,
  gastoId: string,
): Promise<GastoPlanejamento> {
  const response = await api.get<GastoPlanejamento>(
    `/planejamentos/${planejamentoId}/gastos/${gastoId}`,
  );
  return response.data;
}
