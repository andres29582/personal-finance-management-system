import { AuthenticatedRequest } from '../common/authenticated-request';
import { PlanejamentoStatus, PlanejamentoTipo } from './enums';
import { PlanejamentosController } from './planejamentos.controller';
import { PlanejamentosService } from './planejamentos.service';

describe('PlanejamentosController', () => {
  let controller: PlanejamentosController;
  let planejamentosService: jest.Mocked<
    Pick<
      PlanejamentosService,
      'addParticipante' | 'create' | 'findAll' | 'findOne'
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
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
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
});
