import {
  AddParticipantePlanejamentoRequest,
  AcertoPlanejamento,
  CreateGastoPlanejamentoRequest,
  CreatePlanejamentoRequest,
  GastoPlanejamento,
  ParticipantePlanejamento,
  Planejamento,
  ResumoFinanceiroPlanejamento,
  PlanejamentoStatus,
  UpdateGastoPlanejamentoRequest,
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

export async function getResumoPlanejamento(
  id: string,
): Promise<ResumoFinanceiroPlanejamento> {
  const response = await api.get<ResumoFinanceiroPlanejamento>(
    `/planejamentos/${id}/resumo`,
  );
  return response.data;
}

export async function fecharPlanejamento(id: string): Promise<Planejamento> {
  const response = await api.patch<Planejamento>(
    `/planejamentos/${id}/fechar`,
  );
  return response.data;
}

export async function arquivarPlanejamento(
  id: string,
): Promise<Planejamento> {
  const response = await api.patch<Planejamento>(
    `/planejamentos/${id}/arquivar`,
  );
  return response.data;
}

export async function cancelarPlanejamento(
  id: string,
): Promise<Planejamento> {
  const response = await api.patch<Planejamento>(
    `/planejamentos/${id}/cancelar`,
  );
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

export async function removeParticipantePlanejamento(
  planejamentoId: string,
  participanteId: string,
): Promise<ParticipantePlanejamento> {
  const response = await api.delete<ParticipantePlanejamento>(
    `/planejamentos/${planejamentoId}/participantes/${participanteId}`,
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

export async function updateGastoPlanejamento(
  planejamentoId: string,
  gastoId: string,
  data: UpdateGastoPlanejamentoRequest,
): Promise<GastoPlanejamento> {
  const response = await api.patch<GastoPlanejamento>(
    `/planejamentos/${planejamentoId}/gastos/${gastoId}`,
    data,
  );
  return response.data;
}

export async function cancelGastoPlanejamento(
  planejamentoId: string,
  gastoId: string,
): Promise<GastoPlanejamento> {
  const response = await api.patch<GastoPlanejamento>(
    `/planejamentos/${planejamentoId}/gastos/${gastoId}/cancelar`,
  );
  return response.data;
}

export async function listAcertosPlanejamento(
  planejamentoId: string,
): Promise<AcertoPlanejamento[]> {
  const response = await api.get<AcertoPlanejamento[]>(
    `/planejamentos/${planejamentoId}/acertos`,
  );
  return response.data;
}

export async function syncAcertosPlanejamento(
  planejamentoId: string,
): Promise<AcertoPlanejamento[]> {
  const response = await api.post<AcertoPlanejamento[]>(
    `/planejamentos/${planejamentoId}/acertos/sincronizar`,
  );
  return response.data;
}

export async function payAcertoPlanejamento(
  planejamentoId: string,
  acertoId: string,
): Promise<AcertoPlanejamento> {
  const response = await api.patch<AcertoPlanejamento>(
    `/planejamentos/${planejamentoId}/acertos/${acertoId}/pagar`,
  );
  return response.data;
}

export async function cancelAcertoPlanejamento(
  planejamentoId: string,
  acertoId: string,
): Promise<AcertoPlanejamento> {
  const response = await api.patch<AcertoPlanejamento>(
    `/planejamentos/${planejamentoId}/acertos/${acertoId}/cancelar`,
  );
  return response.data;
}

export async function reopenAcertoPlanejamento(
  planejamentoId: string,
  acertoId: string,
): Promise<AcertoPlanejamento> {
  const response = await api.patch<AcertoPlanejamento>(
    `/planejamentos/${planejamentoId}/acertos/${acertoId}/reabrir`,
  );
  return response.data;
}
