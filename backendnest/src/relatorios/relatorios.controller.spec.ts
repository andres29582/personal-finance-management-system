import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { PeriodoRelatorio } from './enums/periodo-relatorio.enum';
import { RelatoriosController } from './relatorios.controller';
import { RelatoriosService } from './relatorios.service';

describe('RelatoriosController', () => {
  let controller: RelatoriosController;
  let relatoriosService: jest.Mocked<Pick<RelatoriosService, 'getRelatorio'>>;

  const request = {
    user: {
      id: 'user-1',
      email: 'ana@example.com',
      nome: 'Ana',
      sid: 'session-1',
    },
  } as never;

  beforeEach(() => {
    relatoriosService = {
      getRelatorio: jest.fn(),
    };

    controller = new RelatoriosController(
      relatoriosService as unknown as RelatoriosService,
    );
  });

  it('delegates report loading using authenticated user id and query filters', async () => {
    const query = {
      periodo: PeriodoRelatorio.MENSAL,
      mes: '2026-05',
      tipo: TipoTransacao.DESPESA,
      contaId: '11111111-1111-4111-8111-111111111111',
    };
    relatoriosService.getRelatorio.mockResolvedValue({
      resumo: {
        totalDespesas: 700,
      },
      transacoes: [],
    } as never);

    const result = await controller.getRelatorio(request, query);

    expect(relatoriosService.getRelatorio).toHaveBeenCalledWith(
      'user-1',
      query,
    );
    expect(result).toEqual({
      resumo: {
        totalDespesas: 700,
      },
      transacoes: [],
    });
  });

  it('delegates interval reports preserving custom date range filters', async () => {
    const query = {
      periodo: PeriodoRelatorio.INTERVALO,
      dataInicio: '2026-05-01',
      dataFim: '2026-05-31',
    };
    relatoriosService.getRelatorio.mockResolvedValue({
      resumo: {
        totalTransacoes: 0,
      },
      transacoes: [],
    } as never);

    const result = await controller.getRelatorio(request, query);

    expect(relatoriosService.getRelatorio).toHaveBeenCalledWith(
      'user-1',
      query,
    );
    expect(result).toEqual({
      resumo: {
        totalTransacoes: 0,
      },
      transacoes: [],
    });
  });
});
