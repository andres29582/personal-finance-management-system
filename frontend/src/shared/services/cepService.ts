import { onlyDigits } from '../../../utils/br-input';
import { api } from './api';
import { CepLookupResponse } from '../types/cep';

export async function lookupCep(cep: string): Promise<CepLookupResponse> {
  const response = await api.get<CepLookupResponse>(`/cep/${onlyDigits(cep)}`);
  return response.data;
}
