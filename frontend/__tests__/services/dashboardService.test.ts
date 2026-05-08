import { api } from '../../services/api';
import { getDashboard } from '../../services/dashboardService';
import { DashboardResponse } from '../../types/dashboard';
import { makeDashboard } from '../utils/builders';

// Mock the API module
jest.mock('../../services/api');
const mockedApi = api as jest.Mocked<typeof api>;

describe('dashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('should return dashboard data without mes param', async () => {
      const mockDashboard: DashboardResponse = makeDashboard({
        saldoTotal: 5000,
        receitasMes: 8000,
        despesasMes: 3000,
      });

      mockedApi.get.mockResolvedValueOnce({
        data: mockDashboard,
      });

      const result = await getDashboard();

      expect(mockedApi.get).toHaveBeenCalledWith('/dashboard', {
        params: undefined,
      });
      expect(result).toEqual(mockDashboard);
    });

    it('should return dashboard data with mes param', async () => {
      const mes = '2023-10';
      const mockDashboard: DashboardResponse = makeDashboard({
        saldoTotal: 4500,
        receitasMes: 7500,
        despesasMes: 3000,
      });

      mockedApi.get.mockResolvedValueOnce({
        data: mockDashboard,
      });

      const result = await getDashboard(mes);

      expect(mockedApi.get).toHaveBeenCalledWith('/dashboard', {
        params: { mes },
      });
      expect(result).toEqual(mockDashboard);
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(getDashboard()).rejects.toThrow('API Error');
    });
  });
});
