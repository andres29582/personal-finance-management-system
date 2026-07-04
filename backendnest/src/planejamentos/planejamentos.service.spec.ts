import {
  AppConflictException,
  ForbiddenResourceException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import {
  ParticipanteStatus,
  ParticipanteTipo,
  PlanejamentoStatus,
  PlanejamentoTipo,
} from './enums';
import { PlanejamentosRepository } from './planejamentos.repository';
import { PlanejamentosService } from './planejamentos.service';

describe('PlanejamentosService', () => {
  let service: PlanejamentosService;
  let repository: jest.Mocked<
    Pick<
      PlanejamentosRepository,
      | 'buscarAcessivelComParticipantes'
      | 'buscarParticipanteAtivoDuplicado'
      | 'buscarParticipanteAtivoPorUsuario'
      | 'listarAcessiveisPorUsuario'
      | 'salvarParticipante'
      | 'salvarPlanejamento'
    >
  >;

  beforeEach(() => {
    repository = {
      buscarAcessivelComParticipantes: jest.fn(),
      buscarParticipanteAtivoDuplicado: jest.fn(),
      buscarParticipanteAtivoPorUsuario: jest.fn(),
      listarAcessiveisPorUsuario: jest.fn(),
      salvarParticipante: jest.fn(),
      salvarPlanejamento: jest.fn(),
    };

    service = new PlanejamentosService(
      repository as unknown as PlanejamentosRepository,
    );
  });

  it('creates a planejamento using the authenticated user as owner', async () => {
    repository.salvarPlanejamento.mockResolvedValue({
      id: 'planejamento-1',
    } as never);
    repository.buscarParticipanteAtivoPorUsuario.mockResolvedValue(null);
    repository.salvarParticipante.mockResolvedValue({
      id: 'participante-owner',
    } as never);
    repository.buscarAcessivelComParticipantes.mockResolvedValue({
      id: 'planejamento-1',
      usuarioCriadorId: 'user-1',
    } as never);

    const result = await service.create(
      {
        id: 'user-1',
        email: 'ana@example.com',
        nome: 'Ana',
      },
      {
        nome: 'Viagem',
        tipo: PlanejamentoTipo.VIAGEM,
        usuarioCriadorId: 'user-2',
      } as never,
    );

    expect(repository.salvarPlanejamento).toHaveBeenCalledWith(
      expect.objectContaining({
        dataFim: null,
        dataInicio: null,
        deletedAt: null,
        descricao: null,
        nome: 'Viagem',
        status: PlanejamentoStatus.ABERTO,
        tipo: PlanejamentoTipo.VIAGEM,
        usuarioCriadorId: 'user-1',
      }),
    );
    expect(repository.salvarParticipante).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ana@example.com',
        nome: 'Ana',
        planejamentoId: 'planejamento-1',
        status: ParticipanteStatus.ATIVO,
        tipo: ParticipanteTipo.VINCULADO,
        usuarioId: 'user-1',
      }),
    );
    expect(result).toEqual({
      id: 'planejamento-1',
      usuarioCriadorId: 'user-1',
    });
  });

  it('does not duplicate the owner participant when it already exists', async () => {
    repository.salvarPlanejamento.mockResolvedValue({
      id: 'planejamento-1',
    } as never);
    repository.buscarParticipanteAtivoPorUsuario.mockResolvedValue({
      id: 'participante-owner',
    } as never);
    repository.buscarAcessivelComParticipantes.mockResolvedValue({
      id: 'planejamento-1',
      usuarioCriadorId: 'user-1',
    } as never);

    await service.create(
      {
        id: 'user-1',
        email: 'ana@example.com',
        nome: 'Ana',
      },
      {
        nome: 'Viagem',
        tipo: PlanejamentoTipo.VIAGEM,
      },
    );

    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });

  it('rejects creation when dataFim is before dataInicio', async () => {
    await expect(
      service.create(
        {
          id: 'user-1',
          email: 'ana@example.com',
          nome: 'Ana',
        },
        {
          dataFim: '2026-06-30',
          dataInicio: '2026-07-01',
          nome: 'Viagem',
          tipo: PlanejamentoTipo.VIAGEM,
        },
      ),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(repository.salvarPlanejamento).not.toHaveBeenCalled();
  });

  it('lists only planejamentos accessible by the authenticated user', async () => {
    const query = { status: PlanejamentoStatus.ABERTO };
    repository.listarAcessiveisPorUsuario.mockResolvedValue([
      { id: 'planejamento-1' },
    ] as never);

    const result = await service.findAll('user-1', query);

    expect(repository.listarAcessiveisPorUsuario).toHaveBeenCalledWith(
      'user-1',
      query,
    );
    expect(result).toEqual([{ id: 'planejamento-1' }]);
  });

  it('returns a planejamento when the user is owner or participant', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue({
      id: 'planejamento-1',
    } as never);

    const result = await service.findOne('planejamento-1', 'user-1');

    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
    expect(result).toEqual({ id: 'planejamento-1' });
  });

  it('throws not found when the planejamento is not accessible', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(null);

    const promise = service.findOne('planejamento-1', 'user-1');

    await expect(promise).rejects.toBeInstanceOf(ResourceNotFoundException);
    await expect(promise).rejects.toMatchObject({
      code: 'PLANEJAMENTO_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('adds a manual participant after confirming planejamento access', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue({
      id: 'planejamento-1',
      usuarioCriadorId: 'user-1',
    } as never);
    repository.buscarParticipanteAtivoDuplicado.mockResolvedValue(null);
    repository.salvarParticipante.mockResolvedValue({
      id: 'participante-1',
    } as never);

    const result = await service.addParticipante('planejamento-1', 'user-1', {
      nome: 'Bruno',
      email: 'bruno@example.com',
    });

    expect(repository.salvarParticipante).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'bruno@example.com',
        nome: 'Bruno',
        planejamentoId: 'planejamento-1',
        status: ParticipanteStatus.ATIVO,
        tipo: ParticipanteTipo.MANUAL,
        usuarioId: null,
      }),
    );
    expect(result).toEqual({ id: 'participante-1' });
  });

  it('adds a linked participant when usuarioId is provided', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue({
      id: 'planejamento-1',
      usuarioCriadorId: 'user-1',
    } as never);
    repository.buscarParticipanteAtivoDuplicado.mockResolvedValue(null);
    repository.salvarParticipante.mockResolvedValue({
      id: 'participante-1',
    } as never);

    await service.addParticipante('planejamento-1', 'user-1', {
      nome: 'Carla',
      usuarioId: 'user-2',
    });

    expect(repository.salvarParticipante).toHaveBeenCalledWith(
      expect.objectContaining({
        email: null,
        nome: 'Carla',
        tipo: ParticipanteTipo.VINCULADO,
        usuarioId: 'user-2',
      }),
    );
  });

  it('rejects participant creation when authenticated user is not owner', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue({
      id: 'planejamento-1',
      usuarioCriadorId: 'owner-1',
    } as never);

    await expect(
      service.addParticipante('planejamento-1', 'user-1', {
        nome: 'Bruno',
      }),
    ).rejects.toBeInstanceOf(ForbiddenResourceException);

    expect(repository.buscarParticipanteAtivoDuplicado).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });

  it('rejects duplicated active participants', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue({
      id: 'planejamento-1',
      usuarioCriadorId: 'user-1',
    } as never);
    repository.buscarParticipanteAtivoDuplicado.mockResolvedValue({
      id: 'participante-1',
    } as never);

    await expect(
      service.addParticipante('planejamento-1', 'user-1', {
        nome: 'Bruno',
        usuarioId: 'user-2',
      }),
    ).rejects.toBeInstanceOf(AppConflictException);

    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });
});
