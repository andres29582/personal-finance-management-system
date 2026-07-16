import { AuthenticatedRequest } from '../common/authenticated-request';
import {
  GastoComportamento,
  PlanejamentoStatus,
  PlanejamentoTipo,
} from './enums';
import { PlanejamentosController } from './planejamentos.controller';
import { PlanejamentosService } from './planejamentos.service';

describe('PlanejamentosController', () => {
  let controller: PlanejamentosController;
  let planejamentosService: jest.Mocked<
    Pick<
      PlanejamentosService,
      | 'addParticipante'
      | 'atualizarGasto'
      | 'cancelarAcerto'
      | 'cancelarGasto'
      | 'create'
      | 'createGasto'
      | 'fechar'
      | 'findAcertos'
      | 'findAll'
      | 'findGasto'
      | 'findGastos'
      | 'findOne'
      | 'findResumo'
      | 'pagarAcerto'
      | 'reabrirAcerto'
      | 'removerParticipante'
      | 'sincronizarAcertos'
    >
  >;

  const request = {
    user: {
      id: 'user-1',
      email: 'ana@example.com',
      nome: 'Ana',
      sid: 'session-1',
    },
  } as AuthenticatedRequest;

  beforeEach(() => {
    planejamentosService = {
      addParticipante: jest.fn(),
      atualizarGasto: jest.fn(),
      cancelarAcerto: jest.fn(),
      cancelarGasto: jest.fn(),
      create: jest.fn(),
      createGasto: jest.fn(),
      fechar: jest.fn(),
      findAcertos: jest.fn(),
      findAll: jest.fn(),
      findGasto: jest.fn(),
      findGastos: jest.fn(),
      findOne: jest.fn(),
      findResumo: jest.fn(),
      pagarAcerto: jest.fn(),
      reabrirAcerto: jest.fn(),
      removerParticipante: jest.fn(),
      sincronizarAcertos: jest.fn(),
    };

    controller = new PlanejamentosController(
      planejamentosService as unknown as PlanejamentosService,
    );
  });

  it('delegates create using the authenticated user id', async () => {
    const dto = {
      nome: 'Casa compartilhada',
      tipo: PlanejamentoTipo.CASA,
      usuarioCriadorId: 'user-2',
    } as never;
    planejamentosService.create.mockResolvedValue({
      id: 'planejamento-1',
    } as never);

    const result = await controller.create(request, dto);

    expect(planejamentosService.create).toHaveBeenCalledWith(request.user, dto);
    expect(result).toEqual({ id: 'planejamento-1' });
  });

  it('delegates findAll using authenticated user id and query filters', async () => {
    const query = { status: PlanejamentoStatus.ABERTO };
    planejamentosService.findAll.mockResolvedValue([
      { id: 'planejamento-1' },
    ] as never);

    const result = await controller.findAll(request, query);

    expect(planejamentosService.findAll).toHaveBeenCalledWith('user-1', query);
    expect(result).toEqual([{ id: 'planejamento-1' }]);
  });

  it('delegates findOne using route id and authenticated user id', async () => {
    planejamentosService.findOne.mockResolvedValue({
      id: 'planejamento-1',
    } as never);

    const result = await controller.findOne({ id: 'planejamento-1' }, request);

    expect(planejamentosService.findOne).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
    expect(result).toEqual({ id: 'planejamento-1' });
  });

  it('delegates findResumo using route id and authenticated user id', async () => {
    planejamentosService.findResumo.mockResolvedValue({
      planejamentoId: 'planejamento-1',
      situacaoFinanceira: 'PENDENTE',
    } as never);

    const result = await controller.findResumo(
      { id: 'planejamento-1' },
      request,
    );

    expect(planejamentosService.findResumo).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
    expect(result).toEqual({
      planejamentoId: 'planejamento-1',
      situacaoFinanceira: 'PENDENTE',
    });
  });

  it('delegates fechar using route id and authenticated user id', async () => {
    const planejamentoFechado = {
      id: 'planejamento-1',
      status: PlanejamentoStatus.FECHADO,
    };
    planejamentosService.fechar.mockResolvedValue(planejamentoFechado as never);

    const result = await controller.fechar({ id: 'planejamento-1' }, request);

    expect(planejamentosService.fechar).toHaveBeenCalledTimes(1);
    expect(planejamentosService.fechar).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
    expect(result).toBe(planejamentoFechado);
  });

  it('delegates addParticipante using route id and authenticated user id', async () => {
    const dto = {
      nome: 'Bruno',
      email: 'bruno@example.com',
    };
    planejamentosService.addParticipante.mockResolvedValue({
      id: 'participante-1',
    } as never);

    const result = await controller.addParticipante(
      { id: 'planejamento-1' },
      request,
      dto,
    );

    expect(planejamentosService.addParticipante).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
      dto,
    );
    expect(result).toEqual({ id: 'participante-1' });
  });

  it('delegates removerParticipante using both route ids and authenticated user id', async () => {
    planejamentosService.removerParticipante.mockResolvedValue({
      id: 'participante-1',
      status: 'REMOVIDO',
    } as never);

    const result = await controller.removerParticipante(
      {
        planejamentoId: 'planejamento-1',
        participanteId: 'participante-1',
      },
      request,
    );

    expect(planejamentosService.removerParticipante).toHaveBeenCalledWith(
      'planejamento-1',
      'participante-1',
      'user-1',
    );
    expect(result).toEqual({
      id: 'participante-1',
      status: 'REMOVIDO',
    });
  });

  it('delegates createGasto using planejamento route id and authenticated user id', async () => {
    const dto = {
      comportamento: GastoComportamento.EVENTUAL,
      dataGasto: '2026-07-04',
      descricao: 'Mercado',
      pagoPorParticipanteId: 'participante-1',
      participantesIds: ['participante-1', 'participante-2'],
      valorCentavos: 10001,
    };
    planejamentosService.createGasto.mockResolvedValue({
      id: 'gasto-1',
    } as never);

    const result = await controller.createGasto(
      { planejamentoId: 'planejamento-1' },
      request,
      dto,
    );

    expect(planejamentosService.createGasto).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
      dto,
    );
    expect(result).toEqual({ id: 'gasto-1' });
  });

  it('delegates findGastos using planejamento route id and authenticated user id', async () => {
    planejamentosService.findGastos.mockResolvedValue([
      { id: 'gasto-1' },
    ] as never);

    const result = await controller.findGastos(
      { planejamentoId: 'planejamento-1' },
      request,
    );

    expect(planejamentosService.findGastos).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
    expect(result).toEqual([{ id: 'gasto-1' }]);
  });

  it('delegates findGasto using route ids and authenticated user id', async () => {
    planejamentosService.findGasto.mockResolvedValue({
      id: 'gasto-1',
    } as never);

    const result = await controller.findGasto(
      {
        gastoId: 'gasto-1',
        planejamentoId: 'planejamento-1',
      },
      request,
    );

    expect(planejamentosService.findGasto).toHaveBeenCalledWith(
      'planejamento-1',
      'gasto-1',
      'user-1',
    );
    expect(result).toEqual({ id: 'gasto-1' });
  });

  it('delegates atualizarGasto once using route ids, authenticated user id, and partial dto', async () => {
    const params = {
      gastoId: 'gasto-1',
      planejamentoId: 'planejamento-1',
    };
    const dto = {
      descricao: 'Mercado atualizado',
      valorCentavos: 15000,
    };
    const gastoAtualizado = {
      id: 'gasto-1',
      descricao: 'Mercado atualizado',
      valorCentavos: 15000,
    };
    planejamentosService.atualizarGasto.mockResolvedValue(
      gastoAtualizado as never,
    );

    const result = await controller.atualizarGasto(params, dto, request);

    expect(planejamentosService.atualizarGasto).toHaveBeenCalledTimes(1);
    expect(planejamentosService.atualizarGasto).toHaveBeenCalledWith(
      'planejamento-1',
      'gasto-1',
      'user-1',
      dto,
    );
    expect(planejamentosService.cancelarGasto).not.toHaveBeenCalled();
    expect(planejamentosService.create).not.toHaveBeenCalled();
    expect(planejamentosService.addParticipante).not.toHaveBeenCalled();
    expect(planejamentosService.createGasto).not.toHaveBeenCalled();
    expect(planejamentosService.sincronizarAcertos).not.toHaveBeenCalled();
    expect(planejamentosService.pagarAcerto).not.toHaveBeenCalled();
    expect(planejamentosService.cancelarAcerto).not.toHaveBeenCalled();
    expect(planejamentosService.reabrirAcerto).not.toHaveBeenCalled();
    expect(result).toBe(gastoAtualizado);
  });

  it('delegates cancelarGasto using route ids and authenticated user id', async () => {
    planejamentosService.cancelarGasto.mockResolvedValue({
      id: 'gasto-1',
      status: 'CANCELADO',
    } as never);

    const result = await controller.cancelarGasto(
      {
        gastoId: 'gasto-1',
        planejamentoId: 'planejamento-1',
      },
      request,
    );

    expect(planejamentosService.cancelarGasto).toHaveBeenCalledWith(
      'planejamento-1',
      'gasto-1',
      'user-1',
    );
    expect(result).toEqual({ id: 'gasto-1', status: 'CANCELADO' });
  });

  it('delegates findAcertos using planejamento route id and authenticated user id', async () => {
    planejamentosService.findAcertos.mockResolvedValue([
      {
        devedorParticipanteId: 'participante-2',
        recebedorParticipanteId: 'participante-1',
        valorCentavos: 5000,
      },
    ] as never);

    const result = await controller.findAcertos(
      { planejamentoId: 'planejamento-1' },
      request,
    );

    expect(planejamentosService.findAcertos).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
    expect(result).toEqual([
      {
        devedorParticipanteId: 'participante-2',
        recebedorParticipanteId: 'participante-1',
        valorCentavos: 5000,
      },
    ]);
  });

  it('delegates sincronizarAcertos using planejamento route id and authenticated user id', async () => {
    planejamentosService.sincronizarAcertos.mockResolvedValue([
      {
        id: 'acerto-1',
        status: 'PENDENTE',
      },
    ] as never);

    const result = await controller.sincronizarAcertos(
      { planejamentoId: 'planejamento-1' },
      request,
    );

    expect(planejamentosService.sincronizarAcertos).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
    expect(result).toEqual([
      {
        id: 'acerto-1',
        status: 'PENDENTE',
      },
    ]);
  });

  it('delegates persisted settlement management using route ids and authenticated user id', async () => {
    const params = {
      planejamentoId: 'planejamento-1',
      acertoId: 'acerto-1',
    };
    planejamentosService.pagarAcerto.mockResolvedValue({
      id: 'acerto-1',
      status: 'PAGO',
    } as never);
    planejamentosService.cancelarAcerto.mockResolvedValue({
      id: 'acerto-1',
      status: 'CANCELADO',
    } as never);
    planejamentosService.reabrirAcerto.mockResolvedValue({
      id: 'acerto-1',
      status: 'PENDENTE',
    } as never);

    await expect(controller.pagarAcerto(params, request)).resolves.toEqual({
      id: 'acerto-1',
      status: 'PAGO',
    });
    await expect(controller.cancelarAcerto(params, request)).resolves.toEqual({
      id: 'acerto-1',
      status: 'CANCELADO',
    });
    await expect(controller.reabrirAcerto(params, request)).resolves.toEqual({
      id: 'acerto-1',
      status: 'PENDENTE',
    });

    expect(planejamentosService.pagarAcerto).toHaveBeenCalledWith(
      'planejamento-1',
      'acerto-1',
      'user-1',
    );
    expect(planejamentosService.cancelarAcerto).toHaveBeenCalledWith(
      'planejamento-1',
      'acerto-1',
      'user-1',
    );
    expect(planejamentosService.reabrirAcerto).toHaveBeenCalledWith(
      'planejamento-1',
      'acerto-1',
      'user-1',
    );
  });
});
