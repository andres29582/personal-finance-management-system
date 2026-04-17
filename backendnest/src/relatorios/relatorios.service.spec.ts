import { Repository } from 'typeorm';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Conta } from '../contas/entities/conta.entity';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { RelatoriosService } from './relatorios.service';
import { PeriodoRelatorio } from './enums/periodo-relatorio.enum';

describe('RelatoriosService', () => {
  let service: RelatoriosService;
  let transacoesRepository: jest.Mocked<Pick<Repository<Transacao>, 'find'>>;
  let categoriasRepository: jest.Mocked<Pick<Repository<Categoria>, 'find'>>;
  let contasRepository: jest.Mocked<Pick<Repository<Conta>, 'find'>>;

  beforeEach(() => {
    transacoesRepository = {
      find: jest.fn(),
    };
    categoriasRepository = {
      find: jest.fn(),
    };
    contasRepository = {
      find: jest.fn(),
    };

    service = new RelatoriosService(
      transacoesRepository as unknown as Repository<Transacao>,
      categoriasRepository as unknown as Repository<Categoria>,
      contasRepository as unknown as Repository<Conta>,
    );
  });

  it('builds a filtered monthly report from transactions only', async () => {
    transacoesRepository.find.mockResolvedValue([
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
    contasRepository.find.mockResolvedValue([
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
});
