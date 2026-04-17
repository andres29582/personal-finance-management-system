import { Repository } from 'typeorm';
import { Categoria } from '../categorias/entities/categoria.entity';
import { ContasService } from '../contas/contas.service';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let contasService: jest.Mocked<Pick<ContasService, 'findAll'>>;
  let transacoesRepository: jest.Mocked<Pick<Repository<Transacao>, 'find'>>;
  let categoriasRepository: jest.Mocked<Pick<Repository<Categoria>, 'find'>>;

  beforeEach(() => {
    contasService = {
      findAll: jest.fn(),
    };
    transacoesRepository = {
      find: jest.fn(),
    };
    categoriasRepository = {
      find: jest.fn(),
    };

    service = new DashboardService(
      contasService as unknown as ContasService,
      transacoesRepository as unknown as Repository<Transacao>,
      categoriasRepository as unknown as Repository<Categoria>,
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
    transacoesRepository.find
      .mockResolvedValueOnce([
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
      ] as Transacao[])
      .mockResolvedValueOnce([
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
    categoriasRepository.find.mockResolvedValue([
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
});
