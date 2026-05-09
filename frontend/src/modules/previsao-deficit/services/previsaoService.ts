import { PrevisaoDeficitResponse } from "../types/previsao";
import { api } from "../../../shared/services/api";

export async function getPrevisaoDeficit(
  mes?: string,
): Promise<PrevisaoDeficitResponse> {
  const response = await api.get<PrevisaoDeficitResponse>(
    "/previsoes/deficit",
    {
      params: mes ? { mes } : undefined,
    },
  );

  return response.data;
}
