import { Categoria } from '../categorias/entities/categoria.entity';
import { Conta } from '../contas/entities/conta.entity';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { RelatoriosService } from './relatorios.service';
import { PeriodoRelatorio } from './enums/periodo-relatorio.enum';
import { RelatorioRepository } from './repositories/relatorio.repository';

describe('RelatoriosService', () => {
  let service: RelatoriosService;
  let repository: jest.Mocked<
    Pick<
      RelatorioRepository,
      'findAccountsByUser' | 'findCategoriesByUser' | 'findTransactionsByPeriod'
    >
  >;

  beforeEach(() => {
    repository = {
      findAccountsByUser: jest.fn(),
      findCategoriesByUser: jest.fn(),
      findTransactionsByPeriod: jest.fn(),
    };

    service = new RelatoriosService(
      repository as unknown as RelatorioRepository,
    );
  });

  it('builds a filtered monthly report from transactions only', async () => {
    repository.findTransactionsByPeriod.mockResolvedValue([
      {
        categoriaId: 'categoria-1',
        contaId: 'conta-1',
        createdAt: new Date('2026-04-01T10:00:00Z'),
        data: '2026-04-01',
        descricao: 'Salario',
        id: 'transacao-1',
        tipo: TipoTransacao.RECEITA,
        valor: 3000,
      },
      {
        categoriaId: 'categoria-2',
        contaId: 'conta-1',
        createdAt: new Date('2026-04-05T10:00:00Z'),
        data: '2026-04-05',
        descricao: 'Mercado',
        id: 'transacao-2',
        tipo: TipoTransacao.DESPESA,
        valor: 700,
      },
    ] as Transacao[]);
    repository.findCategoriesByUser.mockResolvedValue([
      {
        id: 'categoria-1',
        nome: 'Salario',
      },
      {
        id: 'categoria-2',
        nome: 'Alimentacao',
      },
    ] as Categoria[]);
    repository.findAccountsByUser.mockResolvedValue([
      {
        id: 'conta-1',
        nome: 'Banco',
      },
    ] as Conta[]);

    const result = await service.getRelatorio('user-1', {
      mes: '2026-04',
      periodo: PeriodoRelatorio.MENSAL,
      tipo: TipoTransacao.DESPESA,
    });

    expect(result.resumo.totalReceitas).toBe(0);
    expect(result.resumo.totalDespesas).toBe(700);
    expect(result.resumo.economia).toBe(-700);
    expect(result.resumo.totalTransacoes).toBe(1);
    expect(result.transacoes[0]).toMatchObject({
      categoriaNome: 'Alimentacao',
      contaNome: 'Banco',
      id: 'transacao-2',
    });
  });

  it('does not include soft-deleted transactions in report totals or rows', async () => {
    const transactions = [
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
        valor: 700,
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

    repository.findTransactionsByPeriod.mockResolvedValue(
      transactions.filter((transaction) => transaction.excluidoEm === null),
    );
    repository.findCategoriesByUser.mockResolvedValue([
      {
        id: 'categoria-1',
        nome: 'Salario',
      },
      {
        id: 'categoria-2',
        nome: 'Alimentacao',
      },
    ] as Categoria[]);
    repository.findAccountsByUser.mockResolvedValue([
      {
        id: 'conta-1',
        nome: 'Banco',
      },
    ] as Conta[]);

    const result = await service.getRelatorio('user-1', {
      mes: '2026-04',
      periodo: PeriodoRelatorio.MENSAL,
    });

    expect(repository.findTransactionsByPeriod).toHaveBeenCalledWith(
      'user-1',
      '2026-04-01',
      '2026-04-30',
    );
    expect(result.resumo.totalReceitas).toBe(3000);
    expect(result.resumo.totalDespesas).toBe(700);
    expect(result.resumo.totalTransacoes).toBe(2);
    expect(result.transacoes.map((transaction) => transaction.id)).toEqual([
      'receita-ativa',
      'despesa-ativa',
    ]);
  });
});
