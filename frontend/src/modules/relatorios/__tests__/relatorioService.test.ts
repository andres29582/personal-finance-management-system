import { api } from '../../../shared/services/api';
import { makeRelatorio } from '../../../shared/test/builders';
import { getRelatorio } from '../services/relatorioService';
import { GetRelatorioParams, RelatorioResponse } from '../types/relatorio';

// Mock the API module
jest.mock('../../../shared/services/api');
const mockedApi = api as jest.Mocked<typeof api>;

describe('relatorioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRelatorio', () => {
    it('should return relatorio data with params', async () => {
      const params: GetRelatorioParams = {
        dataInicio: '2023-01-01',
        dataFim: '2023-12-31',
        periodo: 'intervalo',
        tipo: 'receita',
      };

      const mockRelatorio: RelatorioResponse = makeRelatorio({
        periodoReferencia: '2023-01-01:2023-12-31',
        resumo: {
          economia: 2000,
          totalDespesas: 8000,
          totalReceitas: 10000,
          totalTransacoes: 0,
        },
      });

      mockedApi.get.mockResolvedValueOnce({
        data: mockRelatorio,
      });

      const result = await getRelatorio(params);

      expect(mockedApi.get).toHaveBeenCalledWith('/relatorios', { params });
      expect(result).toEqual(mockRelatorio);
    });

    it('should throw error when API fails', async () => {
      const params: GetRelatorioParams = {
        dataInicio: '2023-01-01',
        dataFim: '2023-12-31',
        periodo: 'intervalo',
      };

      const error = new Error('API Error');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(getRelatorio(params)).rejects.toThrow('API Error');
    });
  });
});
