import { CepLookupResponse } from '../types/cep';
import { onlyDigits } from '../utils/br-input';
import { api } from './api';

export async function lookupCep(cep: string): Promise<CepLookupResponse> {
  const response = await api.get<CepLookupResponse>(`/cep/${onlyDigits(cep)}`);
  return response.data;
}
