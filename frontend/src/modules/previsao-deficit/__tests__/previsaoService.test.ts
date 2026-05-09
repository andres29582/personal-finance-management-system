import { getPrevisaoDeficit } from "../services/previsaoService";
import { PrevisaoDeficitResponse } from "../types/previsao";
import { api } from "../../../shared/services/api";

jest.mock("../../../shared/services/api", () => ({
  api: {
    get: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function makePrevisao(
  overrides: Partial<PrevisaoDeficitResponse> = {},
): PrevisaoDeficitResponse {
  return {
    deficitPrevisto: false,
    features: {
      despesa_mes: 800,
      num_transacoes_despesa: 10,
      num_transacoes_receita: 2,
      receita_mes: 1000,
      saldo_inicial_mes: 500,
      volatilidade_despesa: 0.1,
    },
    mensagem: "Sem deficit previsto.",
    mesReferencia: "2026-05",
    prediction: 0,
    probability: 0.2,
    risco: "baixo",
    ...overrides,
  };
}

describe("previsaoService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("busca previsao de deficit com mes", async () => {
    const previsao = makePrevisao();
    mockedApi.get.mockResolvedValueOnce({ data: previsao });

    const result = await getPrevisaoDeficit("2026-05");

    expect(mockedApi.get).toHaveBeenCalledWith("/previsoes/deficit", {
      params: { mes: "2026-05" },
    });
    expect(result).toEqual(previsao);
  });

  it("busca previsao de deficit sem mes", async () => {
    const previsao = makePrevisao({ mesReferencia: "2026-06" });
    mockedApi.get.mockResolvedValueOnce({ data: previsao });

    const result = await getPrevisaoDeficit();

    expect(mockedApi.get).toHaveBeenCalledWith("/previsoes/deficit", {
      params: undefined,
    });
    expect(result).toEqual(previsao);
  });
});
