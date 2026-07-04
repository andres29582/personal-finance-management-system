import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/authenticated-request';
import { ContasController } from '../contas/contas.controller';
import { ContasService } from '../contas/contas.service';
import { DashboardController } from '../dashboard/dashboard.controller';
import { DashboardService } from '../dashboard/dashboard.service';
import { DividasController } from '../dividas/dividas.controller';
import { DividasService } from '../dividas/dividas.service';
import { OrcamentosController } from '../orcamentos/orcamentos.controller';
import { OrcamentosService } from '../orcamentos/orcamentos.service';
import { PagosDividaController } from '../pagos-divida/pagos-divida.controller';
import { PagosDividaService } from '../pagos-divida/pagos-divida.service';
import { PlanejamentosController } from '../planejamentos/planejamentos.controller';
import { PlanejamentosService } from '../planejamentos/planejamentos.service';
import { RelatoriosController } from '../relatorios/relatorios.controller';
import { RelatoriosService } from '../relatorios/relatorios.service';
import { PeriodoRelatorio } from '../relatorios/enums/periodo-relatorio.enum';
import { TransacoesController } from '../transacoes/transacoes.controller';
import { TransacoesService } from '../transacoes/transacoes.service';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { TransferenciasController } from '../transferencias/transferencias.controller';
import { TransferenciasService } from '../transferencias/transferencias.service';

describe('Financial controllers security', () => {
  const req = {
    user: {
      email: 'ana@example.com',
      id: 'user-1',
      nome: 'Ana',
      sid: 'session-1',
    },
  } as AuthenticatedRequest;

  it.each([
    ContasController,
    DashboardController,
    DividasController,
    OrcamentosController,
    PagosDividaController,
    PlanejamentosController,
    RelatoriosController,
    TransacoesController,
    TransferenciasController,
  ])('%p is protected by JwtAuthGuard', (controllerClass) => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, controllerClass) ??
      []) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
  });

  it('uses authenticated user id for account endpoints', async () => {
    const service = {
      findOne: jest.fn().mockResolvedValue({ id: 'conta-1' }),
      update: jest.fn().mockResolvedValue({ id: 'conta-1' }),
    };
    const controller = new ContasController(
      service as unknown as ContasService,
    );

    await controller.findOne('conta-1', req);
    await controller.update('conta-1', req, { nome: 'Banco' });

    expect(service.findOne).toHaveBeenCalledWith('conta-1', 'user-1');
    expect(service.update).toHaveBeenCalledWith('conta-1', 'user-1', {
      nome: 'Banco',
    });
  });

  it('uses authenticated user id for transaction endpoints even if payload includes another user id', async () => {
    const service = {
      create: jest.fn().mockResolvedValue({ id: 'transacao-1' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new TransacoesController(
      service as unknown as TransacoesService,
    );
    const dto = {
      categoriaId: 'categoria-1',
      contaId: 'conta-1',
      data: '2026-04-01',
      tipo: TipoTransacao.DESPESA,
      usuarioId: 'user-2',
      valor: 100,
    } as never;

    await controller.create(req, dto);
    await controller.remove('transacao-1', req);

    expect(service.create).toHaveBeenCalledWith('user-1', dto);
    expect(service.remove).toHaveBeenCalledWith('transacao-1', 'user-1');
  });

  it('uses authenticated user id for transfer endpoints', async () => {
    const service = {
      create: jest.fn().mockResolvedValue({ id: 'transferencia-1' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new TransferenciasController(
      service as unknown as TransferenciasService,
    );
    const dto = {
      contaDestinoId: 'conta-2',
      contaOrigemId: 'conta-1',
      data: '2026-04-01',
      usuarioId: 'user-2',
      valor: 100,
    } as never;

    await controller.create(req, dto);
    await controller.remove('transferencia-1', req);

    expect(service.create).toHaveBeenCalledWith('user-1', dto);
    expect(service.remove).toHaveBeenCalledWith('transferencia-1', 'user-1');
  });

  it('uses authenticated user id for debt and debt payment endpoints', async () => {
    const dividasService = {
      findOne: jest.fn().mockResolvedValue({ id: 'divida-1' }),
    };
    const pagosService = {
      findAllByDivida: jest.fn().mockResolvedValue([]),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const dividasController = new DividasController(
      dividasService as unknown as DividasService,
    );
    const pagosController = new PagosDividaController(
      pagosService as unknown as PagosDividaService,
    );

    await dividasController.findOne('divida-1', req);
    await pagosController.findAllByDivida('divida-1', req);
    await pagosController.remove('pago-1', req);

    expect(dividasService.findOne).toHaveBeenCalledWith('divida-1', 'user-1');
    expect(pagosService.findAllByDivida).toHaveBeenCalledWith(
      'divida-1',
      'user-1',
    );
    expect(pagosService.remove).toHaveBeenCalledWith('pago-1', 'user-1');
  });

  it('uses authenticated user id for dashboard, report and budget endpoints', async () => {
    const dashboardService = {
      getDashboard: jest.fn().mockResolvedValue({}),
    };
    const relatoriosService = {
      getRelatorio: jest.fn().mockResolvedValue({}),
    };
    const orcamentosService = {
      findAll: jest.fn().mockResolvedValue([]),
    };
    const dashboardController = new DashboardController(
      dashboardService as unknown as DashboardService,
    );
    const relatoriosController = new RelatoriosController(
      relatoriosService as unknown as RelatoriosService,
    );
    const orcamentosController = new OrcamentosController(
      orcamentosService as unknown as OrcamentosService,
    );
    const dashboardQuery = { mes: '2026-04' };
    const reportQuery = {
      mes: '2026-04',
      periodo: PeriodoRelatorio.MENSAL,
    };
    const budgetQuery = { ano: '2026' };

    await dashboardController.getDashboard(req, dashboardQuery);
    await relatoriosController.getRelatorio(req, reportQuery);
    await orcamentosController.findAll(req, budgetQuery);

    expect(dashboardService.getDashboard).toHaveBeenCalledWith(
      'user-1',
      dashboardQuery,
    );
    expect(relatoriosService.getRelatorio).toHaveBeenCalledWith(
      'user-1',
      reportQuery,
    );
    expect(orcamentosService.findAll).toHaveBeenCalledWith(
      'user-1',
      budgetQuery,
    );
  });

  it('uses authenticated user id for shared planning endpoints', async () => {
    const service = {
      addParticipante: jest.fn().mockResolvedValue({ id: 'participante-1' }),
      create: jest.fn().mockResolvedValue({ id: 'planejamento-1' }),
      createGasto: jest.fn().mockResolvedValue({ id: 'gasto-1' }),
      findAcertos: jest.fn().mockResolvedValue([]),
      findGasto: jest.fn().mockResolvedValue({ id: 'gasto-1' }),
      findGastos: jest.fn().mockResolvedValue([{ id: 'gasto-1' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'planejamento-1' }),
    };
    const controller = new PlanejamentosController(
      service as unknown as PlanejamentosService,
    );
    const dto = {
      nome: 'Viagem',
      tipo: 'VIAGEM',
      usuarioCriadorId: 'user-2',
    } as never;

    await controller.create(req, dto);
    await controller.findOne({ id: 'planejamento-1' }, req);
    await controller.addParticipante({ id: 'planejamento-1' }, req, {
      nome: 'Bruno',
    });
    await controller.createGasto({ planejamentoId: 'planejamento-1' }, req, {
      descricao: 'Mercado',
    } as never);
    await controller.findGastos({ planejamentoId: 'planejamento-1' }, req);
    await controller.findGasto(
      { gastoId: 'gasto-1', planejamentoId: 'planejamento-1' },
      req,
    );
    await controller.findAcertos({ planejamentoId: 'planejamento-1' }, req);

    expect(service.create).toHaveBeenCalledWith(req.user, dto);
    expect(service.findOne).toHaveBeenCalledWith('planejamento-1', 'user-1');
    expect(service.addParticipante).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
      { nome: 'Bruno' },
    );
    expect(service.createGasto).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
      { descricao: 'Mercado' },
    );
    expect(service.findGastos).toHaveBeenCalledWith('planejamento-1', 'user-1');
    expect(service.findGasto).toHaveBeenCalledWith(
      'planejamento-1',
      'gasto-1',
      'user-1',
    );
    expect(service.findAcertos).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
  });
});
