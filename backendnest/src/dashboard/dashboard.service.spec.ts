import { Categoria } from '../categorias/entities/categoria.entity';
import { ContasService } from '../contas/contas.service';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './repositories/dashboard.repository';

describe('DashboardService', () => {
  let service: DashboardService;
  let contasService: jest.Mocked<Pick<ContasService, 'findAll'>>;
  let dashboardRepository: jest.Mocked<
    Pick<
      DashboardRepository,
      | 'findCategoriesByUser'
      | 'findRecentTransactions'
      | 'findTransactionsByPeriod'
    >
  >;

  beforeEach(() => {
    contasService = {
      findAll: jest.fn(),
    };
    dashboardRepository = {
      findCategoriesByUser: jest.fn(),
      findRecentTransactions: jest.fn(),
      findTransactionsByPeriod: jest.fn(),
    };

    service = new DashboardService(
      contasService as unknown as ContasService,
      dashboardRepository as unknown as DashboardRepository,
    );
  });

  it('aggregates balances, monthly totals and expenses by category', async () => {
    contasService.findAll.mockResolvedValue([
      {
        id: 'conta-1',
        moeda: 'BRL',
        nome: 'Carteira',
        saldoAtual: 1500,
        tipo: 'carteira',
      },
      {
        id: 'conta-2',
        moeda: 'BRL',
        nome: 'Banco',
        saldoAtual: 2500,
        tipo: 'banco',
      },
    ] as never);
    dashboardRepository.findTransactionsByPeriod.mockResolvedValue([
      {
        categoriaId: 'categoria-1',
        contaId: 'conta-2',
        createdAt: new Date('2026-04-02T10:00:00Z'),
        data: '2026-04-02',
        descricao: 'Salario',
        id: 'transacao-1',
        tipo: TipoTransacao.RECEITA,
        valor: 3000,
      },
      {
        categoriaId: 'categoria-2',
        contaId: 'conta-1',
        createdAt: new Date('2026-04-03T10:00:00Z'),
        data: '2026-04-03',
        descricao: 'Mercado',
        id: 'transacao-2',
        tipo: TipoTransacao.DESPESA,
        valor: 500,
      },
    ] as Transacao[]);
    dashboardRepository.findRecentTransactions.mockResolvedValue([
      {
        categoriaId: 'categoria-2',
        contaId: 'conta-1',
        createdAt: new Date('2026-04-03T10:00:00Z'),
        data: '2026-04-03',
        descricao: 'Mercado',
        id: 'transacao-2',
        tipo: TipoTransacao.DESPESA,
        valor: 500,
      },
    ] as Transacao[]);
    dashboardRepository.findCategoriesByUser.mockResolvedValue([
      {
        id: 'categoria-1',
        nome: 'Salario',
      },
      {
        id: 'categoria-2',
        nome: 'Alimentacao',
      },
    ] as Categoria[]);

    const result = await service.getDashboard('user-1', { mes: '2026-04' });

    expect(result.saldoTotal).toBe(4000);
    expect(result.receitasMes).toBe(3000);
    expect(result.despesasMes).toBe(500);
    expect(result.economiaMes).toBe(2500);
    expect(result.gastosPorCategoria).toEqual([
      {
        categoriaId: 'categoria-2',
        categoriaNome: 'Alimentacao',
        percentual: 100,
        total: 500,
      },
    ]);
    expect(result.transacoesRecentes[0]).toMatchObject({
      categoriaNome: 'Alimentacao',
      contaNome: 'Carteira',
      id: 'transacao-2',
    });
  });

  it('does not include soft-deleted transactions in dashboard totals or recent transactions', async () => {
    const periodTransactions = [
      {
        categoriaId: 'categoria-1',
        contaId: 'conta-1',
        data: '2026-04-01',
        excluidoEm: null,
        id: 'receita-ativa',
        tipo: TipoTransacao.RECEITA,
        valor: 3000,
      },
      {
        categoriaId: 'categoria-2',
        contaId: 'conta-1',
        data: '2026-04-05',
        excluidoEm: null,
        id: 'despesa-ativa',
        tipo: TipoTransacao.DESPESA,
        valor: 500,
      },
      {
        categoriaId: 'categoria-2',
        contaId: 'conta-1',
        data: '2026-04-06',
        excluidoEm: new Date('2026-04-07T10:00:00Z'),
        id: 'despesa-excluida',
        tipo: TipoTransacao.DESPESA,
        valor: 900,
      },
    ] as Transacao[];
    const recentTransactions = [
      periodTransactions[1],
      periodTransactions[2],
    ] as Transacao[];

    contasService.findAll.mockResolvedValue([
      {
        id: 'conta-1',
        moeda: 'BRL',
        nome: 'Banco',
        saldoAtual: 2500,
        tipo: 'banco',
      },
    ] as never);
    dashboardRepository.findTransactionsByPeriod.mockResolvedValue(
      periodTransactions.filter(
        (transaction) => transaction.excluidoEm === null,
      ),
    );
    dashboardRepository.findRecentTransactions.mockResolvedValue(
      recentTransactions.filter(
        (transaction) => transaction.excluidoEm === null,
      ),
    );
    dashboardRepository.findCategoriesByUser.mockResolvedValue([
      {
        id: 'categoria-1',
        nome: 'Salario',
      },
      {
        id: 'categoria-2',
        nome: 'Alimentacao',
      },
    ] as Categoria[]);

    const result = await service.getDashboard('user-1', { mes: '2026-04' });

    expect(dashboardRepository.findTransactionsByPeriod).toHaveBeenCalledWith(
      'user-1',
      '2026-04-01',
      '2026-04-30',
    );
    expect(dashboardRepository.findRecentTransactions).toHaveBeenCalledWith(
      'user-1',
      5,
    );
    expect(result.receitasMes).toBe(3000);
    expect(result.despesasMes).toBe(500);
    expect(result.economiaMes).toBe(2500);
    expect(
      result.transacoesRecentes.map((transaction) => transaction.id),
    ).toEqual(['despesa-ativa']);
  });
});
