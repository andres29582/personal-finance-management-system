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
    schemaVersion: 2,
    deficitPrevisto: false,
    indicadores: {
      historicoMeses: 3,
      saldoInicialMes: 500,
      mediaReceitas3Meses: 1000,
      mediaDespesas3Meses: 800,
      tendenciaReceitas3Meses: 50,
      tendenciaDespesas3Meses: -20,
      taxaDeficit3Meses: 0.3333,
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
