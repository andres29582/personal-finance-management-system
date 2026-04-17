import { DashboardResponse } from '../types/dashboard';
import { api } from './api';

export async function getDashboard(
  mes?: string,
): Promise<DashboardResponse> {
  const response = await api.get<DashboardResponse>('/dashboard', {
    params: mes ? { mes } : undefined,
  });
  return response.data;
}
