import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: jest.Mocked<Pick<DashboardService, 'getDashboard'>>;

  const request = {
    user: {
      id: 'user-1',
      email: 'ana@example.com',
      nome: 'Ana',
      sid: 'session-1',
    },
  } as never;

  beforeEach(() => {
    dashboardService = {
      getDashboard: jest.fn(),
    };

    controller = new DashboardController(
      dashboardService as unknown as DashboardService,
    );
  });

  it('delegates dashboard loading using authenticated user id and query', async () => {
    const query = {
      mes: '2026-05',
    };
    dashboardService.getDashboard.mockResolvedValue({
      saldoTotal: 4000,
      receitasMes: 3000,
      despesasMes: 700,
    } as never);

    const result = await controller.getDashboard(request, query);

    expect(dashboardService.getDashboard).toHaveBeenCalledWith('user-1', query);
    expect(result).toEqual({
      saldoTotal: 4000,
      receitasMes: 3000,
      despesasMes: 700,
    });
  });

  it('delegates dashboard loading with an empty query object', async () => {
    dashboardService.getDashboard.mockResolvedValue({
      saldoTotal: 0,
    } as never);

    const result = await controller.getDashboard(request, {});

    expect(dashboardService.getDashboard).toHaveBeenCalledWith('user-1', {});
    expect(result).toEqual({ saldoTotal: 0 });
  });
});
