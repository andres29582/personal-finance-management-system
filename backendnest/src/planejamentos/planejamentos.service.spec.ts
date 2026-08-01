import {
  ForbiddenResourceException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import { LogsService } from '../logs/logs.service';
import { EntityManager } from 'typeorm';
import {
  AcertoStatus,
  DivisaoStatus,
  GastoComportamento,
  GastoStatus,
  ParticipanteStatus,
  ParticipanteTipo,
  PlanejamentoStatus,
  PlanejamentoTipo,
} from './enums';
import * as crypto from 'crypto';
import { AcertoPlanejamento } from './entities/acerto-planejamento.entity';
import { PlanejamentosRepository } from './planejamentos.repository';
import { PlanejamentosService } from './planejamentos.service';

jest.mock('crypto', () => {
  const cryptoOriginal = jest.requireActual<typeof import('crypto')>('crypto');

  return {
    ...cryptoOriginal,
    randomUUID: jest.fn(cryptoOriginal.randomUUID),
  };
});

type PlanejamentosRepositoryMock = jest.Mocked<
  Pick<
    PlanejamentosRepository,
    | 'buscarAcessivelComParticipantes'
    | 'buscarAcertoPorIdEPlanejamento'
    | 'bloquearPlanejamentoParaAtualizacao'
    | 'buscarComGastosDivisoesAcertos'
    | 'buscarGastoPorIdEPlanejamento'
    | 'buscarParticipanteAtivoDuplicado'
    | 'buscarParticipanteAtivoPorUsuario'
    | 'buscarParticipantePorIdEPlanejamento'
    | 'executarEmTransacao'
    | 'listarAcessiveisPorUsuario'
    | 'listarAcertosPorPlanejamento'
    | 'listarGastosPorPlanejamento'
    | 'salvarAcerto'
    | 'salvarAcertos'
    | 'salvarDivisoes'
    | 'salvarGasto'
    | 'salvarParticipante'
    | 'salvarPlanejamento'
  >
>;

describe('PlanejamentosService', () => {
  let service: PlanejamentosService;
  let repository: PlanejamentosRepositoryMock;
  let repositoryTransacional: PlanejamentosRepositoryMock;
  let logsService: jest.Mocked<
    Pick<LogsService, 'logEntityEventTransactional'>
  >;
  let entityManager: EntityManager;

  beforeEach(() => {
    jest.mocked(crypto.randomUUID).mockClear();
    repository = {
      buscarAcessivelComParticipantes: jest.fn(),
      buscarAcertoPorIdEPlanejamento: jest.fn(),
      bloquearPlanejamentoParaAtualizacao: jest.fn(),
      buscarComGastosDivisoesAcertos: jest.fn(),
      buscarGastoPorIdEPlanejamento: jest.fn(),
      buscarParticipanteAtivoDuplicado: jest.fn(),
      buscarParticipanteAtivoPorUsuario: jest.fn(),
      buscarParticipantePorIdEPlanejamento: jest.fn(),
      executarEmTransacao: jest.fn(),
      listarAcessiveisPorUsuario: jest.fn(),
      listarAcertosPorPlanejamento: jest.fn(),
      listarGastosPorPlanejamento: jest.fn(),
      salvarAcerto: jest.fn(),
      salvarAcertos: jest.fn(),
      salvarDivisoes: jest.fn(),
      salvarGasto: jest.fn(),
      salvarParticipante: jest.fn(),
      salvarPlanejamento: jest.fn(),
    };
    repositoryTransacional = repository;
    entityManager = {} as EntityManager;
    logsService = {
      logEntityEventTransactional: jest.fn().mockResolvedValue({} as never),
    };
    repository.executarEmTransacao.mockImplementation((operacao) =>
      operacao(
        repositoryTransacional as unknown as PlanejamentosRepository,
        entityManager,
      ),
    );
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );

    service = new PlanejamentosService(
      repository as unknown as PlanejamentosRepository,
      logsService as unknown as LogsService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function expectAuditoriaTransicao(
    event: string,
    statusAnterior: PlanejamentoStatus,
    statusPosterior: PlanejamentoStatus,
  ): void {
    expect(logsService.logEntityEventTransactional).toHaveBeenCalledTimes(1);
    expect(logsService.logEntityEventTransactional).toHaveBeenCalledWith(
      {
        event,
        module: 'planejamentos',
        action: 'update',
        success: true,
        userId: 'user-1',
        entity: 'planejamento',
        entityId: 'planejamento-1',
        details: {
          statusAnterior,
          statusPosterior,
        },
        context: {
          statusCode: 200,
        },
      },
      entityManager,
    );
  }

  async function sincronizarAcertosConfigurados(
    planejamentoId: string,
    usuarioId: string,
  ): Promise<AcertoPlanejamento[]> {
    repository.salvarAcertos.mockImplementation((acertos) =>
      Promise.resolve(
        acertos.map((acerto) =>
          Object.assign(new AcertoPlanejamento(), acerto),
        ),
      ),
    );

    return service.sincronizarAcertos(planejamentoId, usuarioId);
  }

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
    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
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
    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
  });

  it('uses the email prefix for the owner participant when authenticated user has no name', async () => {
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

    await service.create(
      {
        id: 'user-1',
        email: 'ana@example.com',
        nome: undefined,
      },
      {
        nome: 'Viagem',
        tipo: PlanejamentoTipo.VIAGEM,
      },
    );

    expect(repository.salvarParticipante).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ana@example.com',
        nome: 'ana',
        planejamentoId: 'planejamento-1',
        usuarioId: 'user-1',
      }),
    );
  });

  it('uses a safe fallback for the owner participant when authenticated user has no name or email', async () => {
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

    await service.create(
      {
        id: 'user-1',
        email: undefined,
        nome: undefined,
      },
      {
        nome: 'Viagem',
        tipo: PlanejamentoTipo.VIAGEM,
      },
    );

    expect(repository.salvarParticipante).toHaveBeenCalledWith(
      expect.objectContaining({
        email: null,
        nome: 'Proprietario',
        planejamentoId: 'planejamento-1',
        status: ParticipanteStatus.ATIVO,
        tipo: ParticipanteTipo.VINCULADO,
        usuarioId: 'user-1',
      }),
    );
  });

  it.each([
    {
      actorDescription: 'the owner',
      usuarioId: 'user-1',
    },
    {
      actorDescription: 'an active linked participant',
      usuarioId: 'user-2',
    },
  ])(
    'creates the same shared expense for $actorDescription',
    async ({ usuarioId }) => {
      const planejamentoAntesDoLock = criarPlanejamentoComParticipantes({
        participantes: [],
      });
      const planejamentoDepoisDoLock = criarPlanejamentoComParticipantes();
      const gastoSalvo = {
        id: 'gasto-1',
      } as never;
      const acertoCriado = criarEntidadeAcertoPersistido();
      repositoryTransacional = {
        ...repository,
        buscarAcessivelComParticipantes: jest.fn(),
        bloquearPlanejamentoParaAtualizacao: jest.fn(),
        buscarComGastosDivisoesAcertos: jest.fn(),
        salvarAcertos: jest.fn(),
        salvarDivisoes: jest.fn(),
        salvarGasto: jest.fn(),
      };
      repositoryTransacional.buscarAcessivelComParticipantes
        .mockResolvedValueOnce(planejamentoAntesDoLock)
        .mockResolvedValueOnce(planejamentoDepoisDoLock);
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
        planejamentoDepoisDoLock,
      );
      repositoryTransacional.salvarGasto.mockResolvedValue(gastoSalvo);
      repositoryTransacional.salvarDivisoes.mockResolvedValue([] as never);
      repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValue(
        criarPlanejamentoComParticipantes({
          gastos: [
            criarGastoPersistido({
              divisoes: [
                criarDivisaoPersistida('participante-1', 5001),
                criarDivisaoPersistida('participante-2', 5000),
              ],
              valorCentavos: 10001,
            }),
          ],
        }),
      );
      repositoryTransacional.salvarAcertos.mockResolvedValue([acertoCriado]);
      repository.buscarGastoPorIdEPlanejamento.mockResolvedValue({
        id: 'gasto-1',
        divisoes: [
          {
            participanteId: 'participante-1',
            valorDevidoCentavos: 5001,
          },
          {
            participanteId: 'participante-2',
            valorDevidoCentavos: 5000,
          },
        ],
      } as never);

      const result = await service.createGasto('planejamento-1', usuarioId, {
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-04',
        descricao: 'Mercado',
        pagoPorParticipanteId: 'participante-1',
        participantesIds: ['participante-1', 'participante-2'],
        valorCentavos: 10001,
      });

      expect(repositoryTransacional.salvarGasto).toHaveBeenCalledWith(
        expect.objectContaining({
          comportamento: GastoComportamento.EVENTUAL,
          dataGasto: '2026-07-04',
          deletedAt: null,
          descricao: 'Mercado',
          pagoPorParticipanteId: 'participante-1',
          planejamentoId: 'planejamento-1',
          status: GastoStatus.ATIVO,
          valorCentavos: 10001,
        }),
      );
      expect(repositoryTransacional.salvarDivisoes).toHaveBeenCalledWith([
        expect.objectContaining({
          participanteId: 'participante-1',
          status: DivisaoStatus.ATIVA,
          valorDevidoCentavos: 5001,
        }),
        expect.objectContaining({
          participanteId: 'participante-2',
          status: DivisaoStatus.ATIVA,
          valorDevidoCentavos: 5000,
        }),
      ]);
      expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
      expect(
        repositoryTransacional.buscarAcessivelComParticipantes,
      ).toHaveBeenNthCalledWith(1, 'planejamento-1', usuarioId);
      expect(
        repositoryTransacional.bloquearPlanejamentoParaAtualizacao,
      ).toHaveBeenCalledWith('planejamento-1');
      expect(
        repositoryTransacional.buscarAcessivelComParticipantes,
      ).toHaveBeenNthCalledWith(2, 'planejamento-1', usuarioId);
      expect(
        repositoryTransacional.buscarComGastosDivisoesAcertos,
      ).toHaveBeenCalledWith('planejamento-1', usuarioId);
      expect(repositoryTransacional.salvarAcertos).toHaveBeenCalledWith([
        expect.objectContaining({
          deParticipanteId: 'participante-2',
          paraParticipanteId: 'participante-1',
          status: AcertoStatus.PENDENTE,
          valorCentavos: 5000,
        }),
      ]);
      expect(
        repositoryTransacional.buscarAcessivelComParticipantes.mock
          .invocationCallOrder[0],
      ).toBeLessThan(
        repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
          .invocationCallOrder[0],
      );
      expect(
        repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
          .invocationCallOrder[0],
      ).toBeLessThan(
        repositoryTransacional.buscarAcessivelComParticipantes.mock
          .invocationCallOrder[1],
      );
      expect(
        repositoryTransacional.buscarAcessivelComParticipantes.mock
          .invocationCallOrder[1],
      ).toBeLessThan(
        repositoryTransacional.salvarGasto.mock.invocationCallOrder[0],
      );
      expect(
        repositoryTransacional.salvarGasto.mock.invocationCallOrder[0],
      ).toBeLessThan(
        repositoryTransacional.salvarDivisoes.mock.invocationCallOrder[0],
      );
      expect(
        repositoryTransacional.salvarDivisoes.mock.invocationCallOrder[0],
      ).toBeLessThan(
        repositoryTransacional.buscarComGastosDivisoesAcertos.mock
          .invocationCallOrder[0],
      );
      expect(
        repositoryTransacional.buscarComGastosDivisoesAcertos.mock
          .invocationCallOrder[0],
      ).toBeLessThan(
        repositoryTransacional.salvarAcertos.mock.invocationCallOrder[0],
      );
      expect(
        repositoryTransacional.salvarAcertos.mock.invocationCallOrder[0],
      ).toBeLessThan(
        repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[0],
      );
      expect(
        repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[0],
      ).toBeLessThan(
        repository.buscarGastoPorIdEPlanejamento.mock.invocationCallOrder[0],
      );
      expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledTimes(
        1,
      );
      expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledWith(
        'planejamento-1',
        usuarioId,
      );
      expect(repository.buscarGastoPorIdEPlanejamento).toHaveBeenCalledWith(
        'gasto-1',
        'planejamento-1',
      );
      expect(
        repository.bloquearPlanejamentoParaAtualizacao,
      ).not.toHaveBeenCalled();
      expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
      expect(repository.salvarGasto).not.toHaveBeenCalled();
      expect(repository.salvarDivisoes).not.toHaveBeenCalled();
      expect(repository.salvarAcertos).not.toHaveBeenCalled();
      expect(result.id).toBe('gasto-1');
    },
  );

  it.each([
    {
      actorDescription: 'a non-linked user',
      usuarioId: 'user-3',
    },
    {
      actorDescription: 'a removed linked participant',
      usuarioId: 'user-2',
    },
  ])(
    'does not create an expense for $actorDescription',
    async ({ usuarioId }) => {
      repository.buscarAcessivelComParticipantes.mockResolvedValue(null);

      await expect(
        service.createGasto('planejamento-1', usuarioId, {
          comportamento: GastoComportamento.EVENTUAL,
          dataGasto: '2026-07-04',
          descricao: 'Mercado',
          pagoPorParticipanteId: 'participante-1',
          participantesIds: ['participante-1'],
          valorCentavos: 1000,
        }),
      ).rejects.toMatchObject({
        code: 'PLANEJAMENTO_NOT_FOUND',
        statusCode: 404,
      });

      expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledWith(
        'planejamento-1',
        usuarioId,
      );
      expect(
        repository.bloquearPlanejamentoParaAtualizacao,
      ).not.toHaveBeenCalled();
      expect(repository.salvarGasto).not.toHaveBeenCalled();
      expect(repository.salvarDivisoes).not.toHaveBeenCalled();
      expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
      expect(repository.salvarAcertos).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      descricao: 'duplicated split participants',
      participantesIds: ['participante-1', 'participante-1'],
      valorCentavos: 1000,
    },
    {
      descricao: 'invalid expense value',
      participantesIds: ['participante-1'],
      valorCentavos: 0,
    },
  ])(
    'preserves access error precedence for $descricao',
    async ({ participantesIds, valorCentavos }) => {
      repository.buscarAcessivelComParticipantes.mockResolvedValue(null);

      await expect(
        service.createGasto('planejamento-1', 'user-3', {
          comportamento: GastoComportamento.EVENTUAL,
          dataGasto: '2026-07-04',
          descricao: 'Mercado',
          pagoPorParticipanteId: 'participante-1',
          participantesIds,
          valorCentavos,
        }),
      ).rejects.toMatchObject({ code: 'PLANEJAMENTO_NOT_FOUND' });

      expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
      expect(
        repository.bloquearPlanejamentoParaAtualizacao,
      ).not.toHaveBeenCalled();
      expect(repository.salvarGasto).not.toHaveBeenCalled();
      expect(repository.salvarDivisoes).not.toHaveBeenCalled();
      expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
      expect(repository.salvarAcertos).not.toHaveBeenCalled();
    },
  );

  it('returns not found when the planejamento disappears while locking expense creation', async () => {
    repository.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(null);

    await expect(
      service.createGasto('planejamento-1', 'user-1', {
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-04',
        descricao: 'Mercado',
        pagoPorParticipanteId: 'participante-1',
        participantesIds: ['participante-1'],
        valorCentavos: 1000,
      }),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_NOT_FOUND' });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledTimes(1);
    expect(repository.salvarGasto).not.toHaveBeenCalled();
    expect(repository.salvarDivisoes).not.toHaveBeenCalled();
  });

  it('rejects shared expense when payer does not belong to planejamento', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );

    await expect(
      service.createGasto('planejamento-1', 'user-1', {
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-04',
        descricao: 'Mercado',
        pagoPorParticipanteId: 'participante-3',
        participantesIds: ['participante-1'],
        valorCentavos: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_PAGADOR_INVALIDO',
    });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledTimes(2);
    expect(
      repository.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[1],
    );
    expect(repository.salvarGasto).not.toHaveBeenCalled();
  });

  it('rejects shared expense when split participant does not belong to planejamento', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );

    await expect(
      service.createGasto('planejamento-1', 'user-1', {
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-04',
        descricao: 'Mercado',
        pagoPorParticipanteId: 'participante-1',
        participantesIds: ['participante-1', 'participante-3'],
        valorCentavos: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_DIVISAO_PARTICIPANTE_INVALIDO',
    });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledTimes(2);
    expect(
      repository.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[1],
    );
    expect(repository.salvarGasto).not.toHaveBeenCalled();
  });

  it('rejects a removed participant as payer or split in a new expense', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        participantes: [
          criarParticipantePersistido('participante-1'),
          {
            ...criarParticipantePersistido('participante-2'),
            status: ParticipanteStatus.REMOVIDO,
          },
        ],
      }),
    );
    const dtoBase = {
      comportamento: GastoComportamento.EVENTUAL,
      dataGasto: '2026-07-04',
      descricao: 'Mercado',
      valorCentavos: 1000,
    };

    await expect(
      service.createGasto('planejamento-1', 'user-1', {
        ...dtoBase,
        pagoPorParticipanteId: 'participante-2',
        participantesIds: ['participante-1'],
      }),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_PAGADOR_INVALIDO' });

    await expect(
      service.createGasto('planejamento-1', 'user-1', {
        ...dtoBase,
        pagoPorParticipanteId: 'participante-1',
        participantesIds: ['participante-1', 'participante-2'],
      }),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_DIVISAO_PARTICIPANTE_INVALIDO',
    });
    expect(repository.salvarGasto).not.toHaveBeenCalled();
  });

  it('rejects duplicated split participants using domain validation', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );

    await expect(
      service.createGasto('planejamento-1', 'user-1', {
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-04',
        descricao: 'Mercado',
        pagoPorParticipanteId: 'participante-1',
        participantesIds: ['participante-1', 'participante-1'],
        valorCentavos: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'PARTICIPANTE_DUPLICADO',
    });

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledTimes(2);
    expect(repository.salvarGasto).not.toHaveBeenCalled();
    expect(repository.salvarDivisoes).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('rejects empty split participants using domain validation', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );

    await expect(
      service.createGasto('planejamento-1', 'user-1', {
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-04',
        descricao: 'Mercado',
        pagoPorParticipanteId: 'participante-1',
        participantesIds: [],
        valorCentavos: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'PARTICIPANTES_OBRIGATORIOS',
    });

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledTimes(2);
    expect(repository.salvarGasto).not.toHaveBeenCalled();
    expect(repository.salvarDivisoes).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('rejects non-positive shared expense values using domain validation', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );

    await expect(
      service.createGasto('planejamento-1', 'user-1', {
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-04',
        descricao: 'Mercado',
        pagoPorParticipanteId: 'participante-1',
        participantesIds: ['participante-1'],
        valorCentavos: 0,
      }),
    ).rejects.toMatchObject({
      code: 'VALOR_CENTAVOS_DEVE_SER_POSITIVO',
    });

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledTimes(2);
    expect(repository.salvarGasto).not.toHaveBeenCalled();
    expect(repository.salvarDivisoes).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('propagates settlement reconciliation failures from expense creation', async () => {
    const erroReconciliacao = new Error('falha na reconciliacao do gasto');
    repository.salvarGasto.mockResolvedValue({ id: 'gasto-1' } as never);
    repository.salvarDivisoes.mockResolvedValue([] as never);
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        gastos: [criarGastoComPendencia()],
      }),
    );
    repository.salvarAcertos.mockRejectedValue(erroReconciliacao);

    await expect(
      service.createGasto('planejamento-1', 'user-1', {
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-04',
        descricao: 'Mercado',
        pagoPorParticipanteId: 'participante-1',
        participantesIds: ['participante-1', 'participante-2'],
        valorCentavos: 10000,
      }),
    ).rejects.toBe(erroReconciliacao);

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.salvarGasto).toHaveBeenCalledTimes(1);
    expect(repository.salvarDivisoes).toHaveBeenCalledTimes(1);
    expect(repository.salvarAcertos).toHaveBeenCalledTimes(1);
    expect(repository.salvarDivisoes.mock.invocationCallOrder[0]).toBeLessThan(
      repository.salvarAcertos.mock.invocationCallOrder[0],
    );
    expect(repository.buscarGastoPorIdEPlanejamento).not.toHaveBeenCalled();
  });

  it('lists shared expenses only after confirming planejamento access', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.listarGastosPorPlanejamento.mockResolvedValue([
      { id: 'gasto-1' },
    ] as never);

    const result = await service.findGastos('planejamento-1', 'user-1');

    expect(repository.listarGastosPorPlanejamento).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(result).toEqual([{ id: 'gasto-1' }]);
  });

  it('does not list shared expenses when user has no planejamento access', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(null);

    await expect(
      service.findGastos('planejamento-1', 'user-3'),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);

    expect(repository.listarGastosPorPlanejamento).not.toHaveBeenCalled();
  });

  it('returns one shared expense only after confirming planejamento access', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarGastoPorIdEPlanejamento.mockResolvedValue({
      id: 'gasto-1',
    } as never);

    const result = await service.findGasto(
      'planejamento-1',
      'gasto-1',
      'user-1',
    );

    expect(repository.buscarGastoPorIdEPlanejamento).toHaveBeenCalledWith(
      'gasto-1',
      'planejamento-1',
    );
    expect(result).toEqual({ id: 'gasto-1' });
  });

  it('throws not found when shared expense does not exist in the planejamento', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarGastoPorIdEPlanejamento.mockResolvedValue(null);

    await expect(
      service.findGasto('planejamento-1', 'gasto-1', 'user-1'),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it('updates only descriptive expense fields without touching financial state', async () => {
    const { gasto, gastoCompleto } = prepararAtualizacaoGasto();

    const result = await service.atualizarGasto(
      'planejamento-1',
      'gasto-1',
      'user-1',
      {
        descricao: 'Mercado atualizado',
        dataGasto: '2026-07-05',
        comportamento: GastoComportamento.VARIAVEL,
        categoria: 'Casa',
        observacao: 'Nova observacao',
        mesReferencia: '2026-08',
      },
    );

    expect(repositoryTransacional.salvarGasto).toHaveBeenCalledWith(
      expect.objectContaining({
        id: gasto.id,
        descricao: 'Mercado atualizado',
        dataGasto: '2026-07-05',
        comportamento: GastoComportamento.VARIAVEL,
        categoria: 'Casa',
        observacao: 'Nova observacao',
        mesReferencia: '2026-08',
        ultimaAlteracaoValorEm: gasto.ultimaAlteracaoValorEm,
      }),
    );
    const payload = repositoryTransacional.salvarGasto.mock.calls[0][0];
    expect(payload).not.toHaveProperty('pagoPorParticipante');
    expect(payload).not.toHaveProperty('divisoes');
    expect(payload).not.toHaveProperty('planejamento');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('updatedAt');
    expect(repositoryTransacional.salvarDivisoes).not.toHaveBeenCalled();
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).not.toHaveBeenCalled();
    expect(repositoryTransacional.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.buscarGastoPorIdEPlanejamento).toHaveBeenCalledWith(
      'gasto-1',
      'planejamento-1',
    );
    expect(result).toBe(gastoCompleto);
  });

  it('updates only the description when the historical payer is inactive', async () => {
    prepararAtualizacaoGasto({
      planejamentoOverrides: {
        participantes: [
          {
            ...criarParticipantePersistido('participante-1'),
            status: ParticipanteStatus.REMOVIDO,
          },
          criarParticipantePersistido('participante-2'),
          criarParticipantePersistido('participante-3'),
        ],
      },
    });

    await service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
      descricao: 'Mercado atualizado',
    });

    expect(repositoryTransacional.salvarGasto).toHaveBeenCalledWith(
      expect.objectContaining({
        descricao: 'Mercado atualizado',
        pagoPorParticipanteId: 'participante-1',
      }),
    );
    expect(repositoryTransacional.salvarDivisoes).not.toHaveBeenCalled();
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).not.toHaveBeenCalled();
    expect(repositoryTransacional.salvarAcertos).not.toHaveBeenCalled();
  });

  it('clears only the observation when a historical split participant is inactive', async () => {
    prepararAtualizacaoGasto({
      planejamentoOverrides: {
        participantes: [
          criarParticipantePersistido('participante-1'),
          {
            ...criarParticipantePersistido('participante-2'),
            status: ParticipanteStatus.REMOVIDO,
          },
          criarParticipantePersistido('participante-3'),
        ],
      },
    });

    await service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
      observacao: null,
    });

    expect(repositoryTransacional.salvarGasto).toHaveBeenCalledWith(
      expect.objectContaining({ observacao: null }),
    );
    expect(repositoryTransacional.salvarDivisoes).not.toHaveBeenCalled();
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).not.toHaveBeenCalled();
    expect(repositoryTransacional.salvarAcertos).not.toHaveBeenCalled();
  });

  it('clears nullable descriptive expense fields', async () => {
    prepararAtualizacaoGasto();

    await service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
      categoria: null,
      observacao: null,
      mesReferencia: null,
    });

    expect(repositoryTransacional.salvarGasto).toHaveBeenCalledWith(
      expect.objectContaining({
        categoria: null,
        observacao: null,
        mesReferencia: null,
      }),
    );
    expect(repositoryTransacional.salvarDivisoes).not.toHaveBeenCalled();
    expect(repositoryTransacional.salvarAcertos).not.toHaveBeenCalled();
  });

  it('updates value, recreates equal splits, reconciles settlements, and queries the root repository after commit', async () => {
    const { divisaoCancelada, gasto, gastoCompleto } =
      prepararAtualizacaoGasto();

    const result = await service.atualizarGasto(
      'planejamento-1',
      'gasto-1',
      'user-1',
      { valorCentavos: 10001 },
    );

    expect(repositoryTransacional.salvarGasto).toHaveBeenCalledWith(
      expect.objectContaining({
        id: gasto.id,
        valorCentavos: 10001,
        ultimaAlteracaoValorEm: expect.any(Date) as Date,
      }),
    );
    const divisoesSalvas =
      repositoryTransacional.salvarDivisoes.mock.calls[0][0];
    expect(divisoesSalvas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'divisao-ativa-1',
          status: DivisaoStatus.CANCELADA,
        }),
        expect.objectContaining({
          id: 'divisao-ativa-2',
          status: DivisaoStatus.CANCELADA,
        }),
        expect.objectContaining({
          gastoId: 'gasto-1',
          participanteId: 'participante-1',
          status: DivisaoStatus.ATIVA,
          valorDevidoCentavos: 5001,
        }),
        expect.objectContaining({
          gastoId: 'gasto-1',
          participanteId: 'participante-2',
          status: DivisaoStatus.ATIVA,
          valorDevidoCentavos: 5000,
        }),
      ]),
    );
    expect(divisoesSalvas).toHaveLength(4);
    expect(divisoesSalvas).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: divisaoCancelada.id }),
      ]),
    );
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).toHaveBeenCalledWith('planejamento-1', 'user-1');
    expect(repositoryTransacional.salvarAcertos).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'acerto-1',
        status: AcertoStatus.CANCELADO,
      }),
    ]);
    expect(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[1],
    );
    expect(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[1],
    ).toBeLessThan(
      repositoryTransacional.buscarGastoPorIdEPlanejamento.mock
        .invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.buscarGastoPorIdEPlanejamento.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.salvarGasto.mock.invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.salvarGasto.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.salvarDivisoes.mock.invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.salvarDivisoes.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.buscarComGastosDivisoesAcertos.mock
        .invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.salvarAcertos.mock.invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.salvarAcertos.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[0],
    );
    expect(
      repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarGastoPorIdEPlanejamento.mock.invocationCallOrder[0],
    );
    expect(result).toBe(gastoCompleto);
  });

  it('updates only the value while preserving inactive historical participants', async () => {
    prepararAtualizacaoGasto({
      planejamentoOverrides: {
        participantes: [
          {
            ...criarParticipantePersistido('participante-1'),
            status: ParticipanteStatus.REMOVIDO,
          },
          {
            ...criarParticipantePersistido('participante-2'),
            status: ParticipanteStatus.REMOVIDO,
          },
          criarParticipantePersistido('participante-3'),
        ],
      },
    });

    await service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
      valorCentavos: 12001,
    });

    expect(repositoryTransacional.salvarDivisoes).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'divisao-ativa-1',
          status: DivisaoStatus.CANCELADA,
        }),
        expect.objectContaining({
          id: 'divisao-ativa-2',
          status: DivisaoStatus.CANCELADA,
        }),
        expect.objectContaining({
          participanteId: 'participante-1',
          status: DivisaoStatus.ATIVA,
          valorDevidoCentavos: 6001,
        }),
        expect.objectContaining({
          participanteId: 'participante-2',
          status: DivisaoStatus.ATIVA,
          valorDevidoCentavos: 6000,
        }),
      ]),
    );
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).toHaveBeenCalledTimes(1);
    expect(repositoryTransacional.salvarAcertos).toHaveBeenCalledTimes(1);
  });

  it('reconciles a payer-only change without recreating splits or changing the value timestamp', async () => {
    const { gasto } = prepararAtualizacaoGasto({
      gastoOverrides: {
        pagoPorParticipanteId: 'pagador-antigo',
        pagoPorParticipante: { id: 'pagador-antigo' },
      },
      planejamentoOverrides: {
        participantes: [
          criarParticipantePersistido('participante-1'),
          criarParticipantePersistido('participante-2'),
          criarParticipantePersistido('pagador-antigo'),
          criarParticipantePersistido('pagador-novo'),
        ],
      },
    });

    await service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
      pagoPorParticipanteId: 'pagador-novo',
    });

    expect(repositoryTransacional.salvarGasto).toHaveBeenCalledWith(
      expect.objectContaining({
        id: gasto.id,
        pagoPorParticipanteId: 'pagador-novo',
        ultimaAlteracaoValorEm: gasto.ultimaAlteracaoValorEm,
      }),
    );
    const payload = repositoryTransacional.salvarGasto.mock.calls[0][0];
    expect(payload).not.toHaveProperty('pagoPorParticipante');
    expect(payload).not.toHaveProperty('divisoes');
    expect(payload).not.toHaveProperty('planejamento');
    expect(repositoryTransacional.salvarDivisoes).not.toHaveBeenCalled();
    expect(gasto.divisoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'divisao-ativa-1',
          status: DivisaoStatus.ATIVA,
          valorDevidoCentavos: 5000,
        }),
        expect.objectContaining({
          id: 'divisao-ativa-2',
          status: DivisaoStatus.ATIVA,
          valorDevidoCentavos: 5000,
        }),
      ]),
    );
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).toHaveBeenCalledTimes(1);
    expect(repositoryTransacional.salvarAcertos).toHaveBeenCalledTimes(1);
  });

  it('does not recreate or redistribute splits when payer changes with the same inverted participant set', async () => {
    const divisaoParticipanteA = {
      ...criarDivisaoPersistida('participante-1', 5001),
      id: 'divisao-ativa-a',
      gastoId: 'gasto-1',
    };
    const divisaoParticipanteB = {
      ...criarDivisaoPersistida('participante-2', 5000),
      id: 'divisao-ativa-b',
      gastoId: 'gasto-1',
    };
    prepararAtualizacaoGasto({
      gastoOverrides: {
        valorCentavos: 10001,
        divisoes: [divisaoParticipanteB, divisaoParticipanteA],
      },
    });

    await service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
      pagoPorParticipanteId: 'participante-2',
      participantesIds: ['participante-2', 'participante-1'],
    });

    expect(repositoryTransacional.salvarDivisoes).not.toHaveBeenCalled();
    expect(divisaoParticipanteA).toMatchObject({
      status: DivisaoStatus.ATIVA,
      valorDevidoCentavos: 5001,
    });
    expect(divisaoParticipanteB).toMatchObject({
      status: DivisaoStatus.ATIVA,
      valorDevidoCentavos: 5000,
    });
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).toHaveBeenCalledTimes(1);
    expect(repositoryTransacional.salvarAcertos).toHaveBeenCalledTimes(1);
  });

  it('uses canonical participant order when a value change recalculates inverted participant ids', async () => {
    const divisaoParticipanteA = {
      ...criarDivisaoPersistida('participante-1', 5001),
      id: 'divisao-ativa-a',
      gastoId: 'gasto-1',
    };
    const divisaoParticipanteB = {
      ...criarDivisaoPersistida('participante-2', 5000),
      id: 'divisao-ativa-b',
      gastoId: 'gasto-1',
    };
    prepararAtualizacaoGasto({
      gastoOverrides: {
        valorCentavos: 10001,
        divisoes: [divisaoParticipanteB, divisaoParticipanteA],
      },
    });

    await service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
      valorCentavos: 10003,
      participantesIds: ['participante-2', 'participante-1'],
    });

    const divisoesAtivas =
      repositoryTransacional.salvarDivisoes.mock.calls[0][0].filter(
        (divisao) => divisao.status === DivisaoStatus.ATIVA,
      );
    expect(
      divisoesAtivas.map((divisao) => ({
        participanteId: divisao.participanteId,
        valorDevidoCentavos: divisao.valorDevidoCentavos,
      })),
    ).toEqual([
      { participanteId: 'participante-1', valorDevidoCentavos: 5002 },
      { participanteId: 'participante-2', valorDevidoCentavos: 5001 },
    ]);
  });

  it('produces the same split values for financially equivalent participant orders', async () => {
    const capturarDivisoesAtivas = async (participantesIds: string[]) => {
      const divisaoParticipanteA = {
        ...criarDivisaoPersistida('participante-1', 5001),
        id: 'divisao-ativa-a',
        gastoId: 'gasto-1',
      };
      const divisaoParticipanteB = {
        ...criarDivisaoPersistida('participante-2', 5000),
        id: 'divisao-ativa-b',
        gastoId: 'gasto-1',
      };
      prepararAtualizacaoGasto({
        gastoOverrides: {
          valorCentavos: 10001,
          divisoes: [divisaoParticipanteB, divisaoParticipanteA],
        },
      });

      await service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        valorCentavos: 10003,
        participantesIds,
      });

      return repositoryTransacional.salvarDivisoes.mock.calls[0][0]
        .filter((divisao) => divisao.status === DivisaoStatus.ATIVA)
        .map((divisao) => ({
          participanteId: divisao.participanteId,
          valorDevidoCentavos: divisao.valorDevidoCentavos,
        }));
    };

    const divisoesOrdemCanonica = await capturarDivisoesAtivas([
      'participante-1',
      'participante-2',
    ]);
    const divisoesOrdemInvertida = await capturarDivisoesAtivas([
      'participante-2',
      'participante-1',
    ]);

    expect(divisoesOrdemCanonica).toEqual([
      { participanteId: 'participante-1', valorDevidoCentavos: 5002 },
      { participanteId: 'participante-2', valorDevidoCentavos: 5001 },
    ]);
    expect(divisoesOrdemInvertida).toEqual(divisoesOrdemCanonica);
  });

  it('accepts an active new participant and calculates new active splits', async () => {
    prepararAtualizacaoGasto();

    await service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
      participantesIds: ['participante-3', 'participante-1'],
    });

    expect(repositoryTransacional.salvarGasto).toHaveBeenCalledTimes(1);
    expect(repositoryTransacional.salvarDivisoes).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          participanteId: 'participante-3',
          status: DivisaoStatus.ATIVA,
          valorDevidoCentavos: 5000,
        }),
        expect.objectContaining({
          participanteId: 'participante-1',
          status: DivisaoStatus.ATIVA,
          valorDevidoCentavos: 5000,
        }),
      ]),
    );
    expect(repositoryTransacional.salvarAcertos).toHaveBeenCalledTimes(1);
  });

  it('is idempotent when informed values equal the persisted expense', async () => {
    const { gastoCompleto } = prepararAtualizacaoGasto({
      planejamentoOverrides: {
        participantes: [
          {
            ...criarParticipantePersistido('participante-1'),
            status: ParticipanteStatus.REMOVIDO,
          },
          {
            ...criarParticipantePersistido('participante-2'),
            status: ParticipanteStatus.REMOVIDO,
          },
          criarParticipantePersistido('participante-3'),
        ],
      },
    });

    const result = await service.atualizarGasto(
      'planejamento-1',
      'gasto-1',
      'user-1',
      {
        descricao: 'Mercado',
        valorCentavos: 10000,
        pagoPorParticipanteId: 'participante-1',
        categoria: 'Alimentacao',
      },
    );

    expect(repositoryTransacional.salvarGasto).not.toHaveBeenCalled();
    expect(repositoryTransacional.salvarDivisoes).not.toHaveBeenCalled();
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).not.toHaveBeenCalled();
    expect(repositoryTransacional.salvarAcertos).not.toHaveBeenCalled();
    expect(result).toBe(gastoCompleto);
  });

  it('keeps an inactive historical participant when the participant set changes', async () => {
    prepararAtualizacaoGasto({
      planejamentoOverrides: {
        participantes: [
          criarParticipantePersistido('participante-1'),
          {
            ...criarParticipantePersistido('participante-2'),
            status: ParticipanteStatus.REMOVIDO,
          },
          criarParticipantePersistido('participante-3'),
        ],
      },
    });

    await service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
      participantesIds: ['participante-2', 'participante-3'],
    });

    expect(repositoryTransacional.salvarDivisoes).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          participanteId: 'participante-2',
          status: DivisaoStatus.ATIVA,
        }),
        expect.objectContaining({
          participanteId: 'participante-3',
          status: DivisaoStatus.ATIVA,
        }),
      ]),
    );
    expect(repositoryTransacional.salvarAcertos).toHaveBeenCalledTimes(1);
  });

  it('ignores participant ordering when the active participant set is unchanged', async () => {
    prepararAtualizacaoGasto();

    await service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
      participantesIds: ['participante-2', 'participante-1'],
    });

    expect(repositoryTransacional.salvarGasto).not.toHaveBeenCalled();
    expect(repositoryTransacional.salvarDivisoes).not.toHaveBeenCalled();
    expect(repositoryTransacional.salvarAcertos).not.toHaveBeenCalled();
  });

  it('rejects duplicate participant ids even when their apparent set matches the current one', async () => {
    prepararAtualizacaoGasto();

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        participantesIds: [
          'participante-1',
          'participante-2',
          'participante-1',
        ],
      }),
    ).rejects.toMatchObject({ code: 'PARTICIPANTE_DUPLICADO' });

    expect(repositoryTransacional.salvarGasto).not.toHaveBeenCalled();
    expect(repositoryTransacional.salvarDivisoes).not.toHaveBeenCalled();
  });

  it('rejects an empty expense update before starting a transaction', async () => {
    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        descricao: undefined,
        categoria: undefined,
      }),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_GASTO_ATUALIZACAO_VAZIA',
      statusCode: 422,
      message: 'Informe ao menos um campo para atualizar o gasto.',
    });

    expect(repository.executarEmTransacao).not.toHaveBeenCalled();
  });

  it('rejects an inaccessible planejamento before acquiring the update lock', async () => {
    prepararAtualizacaoGasto();
    repositoryTransacional.buscarAcessivelComParticipantes.mockResolvedValueOnce(
      null,
    );

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        descricao: 'Atualizado',
      }),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_NOT_FOUND' });

    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
  });

  it('rejects an active linked participant before acquiring the update lock', async () => {
    prepararAtualizacaoGasto();

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-2', {
        descricao: 'Atualizado',
      }),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_OWNER_REQUIRED' });

    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
  });

  it('returns not found when the planejamento disappears while acquiring the update lock', async () => {
    prepararAtualizacaoGasto();
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      null,
    );

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        descricao: 'Atualizado',
      }),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_NOT_FOUND' });

    expect(
      repositoryTransacional.buscarAcessivelComParticipantes,
    ).toHaveBeenCalledTimes(1);
    expect(
      repositoryTransacional.buscarGastoPorIdEPlanejamento,
    ).not.toHaveBeenCalled();
  });

  it('revalidates ownership after acquiring the update lock', async () => {
    const { planejamento } = prepararAtualizacaoGasto();
    repositoryTransacional.buscarAcessivelComParticipantes
      .mockResolvedValueOnce(planejamento)
      .mockResolvedValueOnce({
        ...planejamento,
        usuarioCriadorId: 'owner-alterado',
      } as never);

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        descricao: 'Atualizado',
      }),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_OWNER_REQUIRED' });

    expect(
      repositoryTransacional.buscarGastoPorIdEPlanejamento,
    ).not.toHaveBeenCalled();
  });

  it('returns not found when the scoped expense lookup fails after the lock', async () => {
    prepararAtualizacaoGasto();
    repositoryTransacional.buscarGastoPorIdEPlanejamento.mockResolvedValue(
      null,
    );

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        descricao: 'Atualizado',
      }),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_GASTO_NOT_FOUND' });

    expect(
      repositoryTransacional.buscarGastoPorIdEPlanejamento,
    ).toHaveBeenCalledWith('gasto-1', 'planejamento-1');
    expect(repositoryTransacional.salvarGasto).not.toHaveBeenCalled();
  });

  it.each([GastoStatus.CANCELADO, GastoStatus.PENDENTE_REVISAO])(
    'rejects updating an expense with status %s',
    async (status) => {
      prepararAtualizacaoGasto({ gastoOverrides: { status } });

      await expect(
        service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
          descricao: 'Atualizado',
        }),
      ).rejects.toMatchObject({
        code: 'PLANEJAMENTO_GASTO_ATUALIZAR_STATUS_INVALIDO',
        statusCode: 422,
        details: { statusAtual: status },
      });

      expect(repositoryTransacional.salvarGasto).not.toHaveBeenCalled();
    },
  );

  it('rejects changing the payer to an inactive participant after the lock', async () => {
    prepararAtualizacaoGasto({
      planejamentoOverrides: {
        participantes: [
          criarParticipantePersistido('participante-1'),
          criarParticipantePersistido('participante-2'),
          {
            ...criarParticipantePersistido('participante-3'),
            status: ParticipanteStatus.REMOVIDO,
          },
        ],
      },
    });

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        pagoPorParticipanteId: 'participante-3',
      }),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_PAGADOR_INVALIDO' });

    expect(repositoryTransacional.salvarGasto).not.toHaveBeenCalled();
  });

  it('rejects introducing an inactive split participant after the lock', async () => {
    prepararAtualizacaoGasto({
      planejamentoOverrides: {
        participantes: [
          criarParticipantePersistido('participante-1'),
          criarParticipantePersistido('participante-2'),
          {
            ...criarParticipantePersistido('participante-3'),
            status: ParticipanteStatus.REMOVIDO,
          },
        ],
      },
    });

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        participantesIds: ['participante-1', 'participante-3'],
      }),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_DIVISAO_PARTICIPANTE_INVALIDO',
    });

    expect(repositoryTransacional.salvarGasto).not.toHaveBeenCalled();
  });

  it('rejects a financial update without informed participants or active splits', async () => {
    prepararAtualizacaoGasto({ gastoOverrides: { divisoes: [] } });

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        valorCentavos: 12000,
      }),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_GASTO_DIVISOES_ATIVAS_OBRIGATORIAS',
      statusCode: 422,
    });

    expect(repositoryTransacional.salvarGasto).not.toHaveBeenCalled();
    expect(repositoryTransacional.salvarDivisoes).not.toHaveBeenCalled();
  });

  it('propagates update lock failures without loading the expense', async () => {
    const erroLock = new Error('falha no lock da atualizacao');
    prepararAtualizacaoGasto();
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockRejectedValue(
      erroLock,
    );

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        descricao: 'Atualizado',
      }),
    ).rejects.toBe(erroLock);

    expect(
      repositoryTransacional.buscarGastoPorIdEPlanejamento,
    ).not.toHaveBeenCalled();
    expect(repository.buscarAcessivelComParticipantes).not.toHaveBeenCalled();
    expect(repository.buscarGastoPorIdEPlanejamento).not.toHaveBeenCalled();
  });

  it('propagates expense update persistence failures without querying after commit', async () => {
    const erroPersistencia = new Error('falha ao salvar gasto atualizado');
    prepararAtualizacaoGasto();
    repositoryTransacional.salvarGasto.mockRejectedValue(erroPersistencia);

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        valorCentavos: 12000,
      }),
    ).rejects.toBe(erroPersistencia);

    expect(repositoryTransacional.salvarDivisoes).not.toHaveBeenCalled();
    expect(repository.buscarAcessivelComParticipantes).not.toHaveBeenCalled();
    expect(repository.buscarGastoPorIdEPlanejamento).not.toHaveBeenCalled();
  });

  it('propagates split update failures before aggregate reload', async () => {
    const erroPersistencia = new Error('falha ao recriar divisoes');
    prepararAtualizacaoGasto();
    repositoryTransacional.salvarDivisoes.mockRejectedValue(erroPersistencia);

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        valorCentavos: 12000,
      }),
    ).rejects.toBe(erroPersistencia);

    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).not.toHaveBeenCalled();
    expect(repository.buscarAcessivelComParticipantes).not.toHaveBeenCalled();
    expect(repository.buscarGastoPorIdEPlanejamento).not.toHaveBeenCalled();
  });

  it('propagates financial aggregate reload failures before reconciliation', async () => {
    const erroRecarga = new Error('falha ao recarregar agregado');
    prepararAtualizacaoGasto();
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockRejectedValue(
      erroRecarga,
    );

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        valorCentavos: 12000,
      }),
    ).rejects.toBe(erroRecarga);

    expect(repositoryTransacional.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.buscarAcessivelComParticipantes).not.toHaveBeenCalled();
    expect(repository.buscarGastoPorIdEPlanejamento).not.toHaveBeenCalled();
  });

  it('propagates reconciliation failures and skips the post-commit expense query', async () => {
    const erroReconciliacao = new Error(
      'falha na reconciliacao da atualizacao',
    );
    prepararAtualizacaoGasto();
    repositoryTransacional.salvarAcertos.mockRejectedValue(erroReconciliacao);

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        valorCentavos: 12000,
      }),
    ).rejects.toBe(erroReconciliacao);

    expect(repositoryTransacional.salvarAcertos).toHaveBeenCalledTimes(1);
    expect(repository.buscarAcessivelComParticipantes).not.toHaveBeenCalled();
    expect(repository.buscarGastoPorIdEPlanejamento).not.toHaveBeenCalled();
  });

  it('cancels an active expense and only its active splits transactionally', async () => {
    const planejamentoDoProprietario = criarPlanejamentoComParticipantes();
    const divisaoAtiva = {
      ...criarDivisaoPersistida('participante-1', 5000),
      id: 'divisao-ativa',
      gastoId: 'gasto-1',
    };
    const divisaoCancelada = {
      ...criarDivisaoPersistida('participante-2', 5000),
      id: 'divisao-cancelada',
      gastoId: 'gasto-1',
      status: DivisaoStatus.CANCELADA,
    };
    const gastoAtivo = criarGastoPersistido({
      divisoes: [divisaoAtiva, divisaoCancelada],
      valorCentavos: 10000,
    });
    const gastoCancelado = {
      ...gastoAtivo,
      status: GastoStatus.CANCELADO,
    } as never;
    const acertoPendente = criarAcertoPersistido();
    repositoryTransacional = {
      ...repository,
      buscarAcessivelComParticipantes: jest.fn(),
      bloquearPlanejamentoParaAtualizacao: jest.fn(),
      buscarComGastosDivisoesAcertos: jest.fn(),
      buscarGastoPorIdEPlanejamento: jest.fn(),
      salvarAcertos: jest.fn(),
      salvarDivisoes: jest.fn(),
      salvarGasto: jest.fn(),
    };
    repositoryTransacional.buscarAcessivelComParticipantes.mockResolvedValue(
      planejamentoDoProprietario,
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      planejamentoDoProprietario,
    );
    repositoryTransacional.buscarGastoPorIdEPlanejamento.mockResolvedValue(
      gastoAtivo as never,
    );
    repositoryTransacional.salvarGasto.mockResolvedValue(gastoCancelado);
    repositoryTransacional.salvarDivisoes.mockResolvedValue([] as never);
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [acertoPendente],
        gastos: [gastoCancelado],
      }),
    );
    repositoryTransacional.salvarAcertos.mockResolvedValue([]);
    repository.buscarGastoPorIdEPlanejamento.mockResolvedValue({
      ...gastoCancelado,
      divisoes: [
        { ...divisaoAtiva, status: DivisaoStatus.CANCELADA },
        divisaoCancelada,
      ],
    } as never);

    const result = await service.cancelarGasto(
      'planejamento-1',
      'gasto-1',
      'user-1',
    );

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repositoryTransacional.salvarGasto).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'gasto-1',
        status: GastoStatus.CANCELADO,
      }),
    );
    expect(repositoryTransacional.salvarDivisoes).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'divisao-ativa',
        status: DivisaoStatus.CANCELADA,
      }),
    ]);
    expect(repositoryTransacional.salvarDivisoes).not.toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'divisao-cancelada' }),
      ]),
    );
    expect(repositoryTransacional.salvarAcertos).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'acerto-1',
        status: AcertoStatus.CANCELADO,
      }),
    ]);
    expect(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[1],
    );
    expect(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[1],
    ).toBeLessThan(
      repositoryTransacional.buscarGastoPorIdEPlanejamento.mock
        .invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.salvarGasto.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.salvarDivisoes.mock.invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.salvarDivisoes.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.buscarComGastosDivisoesAcertos.mock
        .invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.salvarAcertos.mock.invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.salvarAcertos.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[0],
    );
    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledTimes(1);
    expect(repository.buscarGastoPorIdEPlanejamento).toHaveBeenCalledWith(
      'gasto-1',
      'planejamento-1',
    );
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarGasto).not.toHaveBeenCalled();
    expect(repository.salvarDivisoes).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ status: GastoStatus.CANCELADO }),
    );
  });

  it('cancels an active expense with only canceled splits without saving splits', async () => {
    const planejamentoDoProprietario = criarPlanejamentoComParticipantes();
    const divisaoCancelada = {
      ...criarDivisaoPersistida('participante-1', 1000),
      gastoId: 'gasto-1',
      status: DivisaoStatus.CANCELADA,
    };
    const gastoAtivo = criarGastoPersistido({
      divisoes: [divisaoCancelada],
      valorCentavos: 1000,
    });
    const gastoCancelado = {
      ...gastoAtivo,
      status: GastoStatus.CANCELADO,
    } as never;
    const acertoPendente = criarAcertoPersistido();
    repositoryTransacional = {
      ...repository,
      buscarAcessivelComParticipantes: jest.fn(),
      bloquearPlanejamentoParaAtualizacao: jest.fn(),
      buscarComGastosDivisoesAcertos: jest.fn(),
      buscarGastoPorIdEPlanejamento: jest.fn(),
      salvarAcertos: jest.fn(),
      salvarDivisoes: jest.fn(),
      salvarGasto: jest.fn(),
    };
    repositoryTransacional.buscarAcessivelComParticipantes.mockResolvedValue(
      planejamentoDoProprietario,
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      planejamentoDoProprietario,
    );
    repositoryTransacional.buscarGastoPorIdEPlanejamento.mockResolvedValue(
      gastoAtivo as never,
    );
    repositoryTransacional.salvarGasto.mockResolvedValue(gastoCancelado);
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [acertoPendente],
        gastos: [gastoCancelado],
      }),
    );
    repositoryTransacional.salvarAcertos.mockResolvedValue([]);
    repository.buscarGastoPorIdEPlanejamento.mockResolvedValue(gastoCancelado);

    const result = await service.cancelarGasto(
      'planejamento-1',
      'gasto-1',
      'user-1',
    );

    expect(repositoryTransacional.salvarGasto).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'gasto-1',
        status: GastoStatus.CANCELADO,
      }),
    );
    expect(repositoryTransacional.salvarDivisoes).not.toHaveBeenCalled();
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).toHaveBeenCalledWith('planejamento-1', 'user-1');
    expect(repositoryTransacional.salvarAcertos).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'acerto-1',
        status: AcertoStatus.CANCELADO,
      }),
    ]);
    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledTimes(1);
    expect(repository.buscarGastoPorIdEPlanejamento).toHaveBeenCalledWith(
      'gasto-1',
      'planejamento-1',
    );
    expect(
      repositoryTransacional.salvarAcertos.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[0],
    );
    expect(result).toBe(gastoCancelado);
    expect(result.status).toBe(GastoStatus.CANCELADO);
  });

  it('propagates settlement reconciliation failures from expense cancellation', async () => {
    const erroReconciliacao = new Error(
      'falha na reconciliacao do cancelamento',
    );
    const gasto = criarGastoPersistido({
      divisoes: [criarDivisaoPersistida('participante-1', 1000)],
    });
    repositoryTransacional = {
      ...repository,
      buscarAcessivelComParticipantes: jest.fn(),
      bloquearPlanejamentoParaAtualizacao: jest.fn(),
      buscarComGastosDivisoesAcertos: jest.fn(),
      buscarGastoPorIdEPlanejamento: jest.fn(),
      salvarAcertos: jest.fn(),
      salvarDivisoes: jest.fn(),
      salvarGasto: jest.fn(),
    };
    repositoryTransacional.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repositoryTransacional.buscarGastoPorIdEPlanejamento.mockResolvedValue(
      gasto as never,
    );
    repositoryTransacional.salvarGasto.mockResolvedValue({
      ...gasto,
      status: GastoStatus.CANCELADO,
    } as never);
    repositoryTransacional.salvarDivisoes.mockResolvedValue([] as never);
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [criarAcertoPersistido()],
        gastos: [],
      }),
    );
    repositoryTransacional.salvarAcertos.mockRejectedValue(erroReconciliacao);

    await expect(
      service.cancelarGasto('planejamento-1', 'gasto-1', 'user-1'),
    ).rejects.toBe(erroReconciliacao);

    expect(repositoryTransacional.salvarGasto).toHaveBeenCalledTimes(1);
    expect(repositoryTransacional.salvarDivisoes).toHaveBeenCalledTimes(1);
    expect(repositoryTransacional.salvarAcertos).toHaveBeenCalledTimes(1);
    expect(
      repositoryTransacional.salvarDivisoes.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.salvarAcertos.mock.invocationCallOrder[0],
    );
    expect(repository.buscarAcessivelComParticipantes).not.toHaveBeenCalled();
    expect(repository.buscarGastoPorIdEPlanejamento).not.toHaveBeenCalled();
  });

  it('rejects expense cancellation without access before acquiring the lock', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(null);

    await expect(
      service.cancelarGasto('planejamento-1', 'gasto-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_NOT_FOUND',
      statusCode: 404,
    });

    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.buscarGastoPorIdEPlanejamento).not.toHaveBeenCalled();
    expect(repository.salvarGasto).not.toHaveBeenCalled();
    expect(repository.salvarDivisoes).not.toHaveBeenCalled();
  });

  it('rejects expense cancellation by an active linked participant before acquiring the lock', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );

    await expect(
      service.cancelarGasto('planejamento-1', 'gasto-1', 'user-2'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_OWNER_REQUIRED',
      statusCode: 403,
    });

    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.buscarGastoPorIdEPlanejamento).not.toHaveBeenCalled();
    expect(repository.salvarGasto).not.toHaveBeenCalled();
  });

  it('returns not found when planejamento disappears while locking expense cancellation', async () => {
    repository.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(null);

    await expect(
      service.cancelarGasto('planejamento-1', 'gasto-1', 'user-1'),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_NOT_FOUND' });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledTimes(1);
    expect(repository.buscarGastoPorIdEPlanejamento).not.toHaveBeenCalled();
    expect(repository.salvarGasto).not.toHaveBeenCalled();
  });

  it('revalidates planejamento ownership after locking expense cancellation', async () => {
    repository.buscarAcessivelComParticipantes
      .mockResolvedValueOnce(criarPlanejamentoComParticipantes())
      .mockResolvedValueOnce(
        criarPlanejamentoComParticipantes({
          usuarioCriadorId: 'owner-alterado',
        }),
      );

    await expect(
      service.cancelarGasto('planejamento-1', 'gasto-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_OWNER_REQUIRED',
      statusCode: 403,
    });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledTimes(2);
    expect(
      repository.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[1],
    );
    expect(repository.buscarGastoPorIdEPlanejamento).not.toHaveBeenCalled();
    expect(repository.salvarGasto).not.toHaveBeenCalled();
  });

  it('returns not found when the scoped expense lookup returns null after acquiring the lock', async () => {
    repository.buscarGastoPorIdEPlanejamento.mockResolvedValue(null);

    await expect(
      service.cancelarGasto('planejamento-1', 'gasto-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_GASTO_NOT_FOUND',
      statusCode: 404,
    });

    expect(repository.buscarGastoPorIdEPlanejamento).toHaveBeenCalledWith(
      'gasto-1',
      'planejamento-1',
    );
    expect(
      repository.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarGastoPorIdEPlanejamento.mock.invocationCallOrder[0],
    );
    expect(repository.salvarGasto).not.toHaveBeenCalled();
    expect(repository.salvarDivisoes).not.toHaveBeenCalled();
  });

  it.each([GastoStatus.CANCELADO, GastoStatus.PENDENTE_REVISAO])(
    'rejects cancellation of an expense with status %s',
    async (status) => {
      repository.buscarGastoPorIdEPlanejamento.mockResolvedValue(
        criarGastoPersistido({ status }) as never,
      );

      await expect(
        service.cancelarGasto('planejamento-1', 'gasto-1', 'user-1'),
      ).rejects.toMatchObject({
        code: 'PLANEJAMENTO_GASTO_CANCELAR_STATUS_INVALIDO',
        statusCode: 422,
      });

      expect(repository.salvarGasto).not.toHaveBeenCalled();
      expect(repository.salvarDivisoes).not.toHaveBeenCalled();
      expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
      expect(repository.salvarAcertos).not.toHaveBeenCalled();
    },
  );

  it('propagates expense cancellation lock failures without loading the expense', async () => {
    const erroLock = new Error('falha ao adquirir lock');
    repository.bloquearPlanejamentoParaAtualizacao.mockRejectedValue(erroLock);

    await expect(
      service.cancelarGasto('planejamento-1', 'gasto-1', 'user-1'),
    ).rejects.toBe(erroLock);

    expect(repository.buscarGastoPorIdEPlanejamento).not.toHaveBeenCalled();
    expect(repository.salvarGasto).not.toHaveBeenCalled();
    expect(repository.salvarDivisoes).not.toHaveBeenCalled();
  });

  it('propagates expense persistence failures before saving divisions', async () => {
    const erroPersistencia = new Error('falha ao salvar gasto cancelado');
    repository.buscarGastoPorIdEPlanejamento.mockResolvedValue(
      criarGastoPersistido({
        divisoes: [criarDivisaoPersistida('participante-1', 1000)],
      }) as never,
    );
    repository.salvarGasto.mockRejectedValue(erroPersistencia);

    await expect(
      service.cancelarGasto('planejamento-1', 'gasto-1', 'user-1'),
    ).rejects.toBe(erroPersistencia);

    expect(repository.salvarDivisoes).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('propagates split persistence failures before settlement reconciliation', async () => {
    const erroPersistencia = new Error('falha ao salvar divisoes canceladas');
    const gasto = criarGastoPersistido({
      divisoes: [criarDivisaoPersistida('participante-1', 1000)],
    });
    repository.buscarGastoPorIdEPlanejamento.mockResolvedValue(gasto as never);
    repository.salvarGasto.mockResolvedValue({
      ...gasto,
      status: GastoStatus.CANCELADO,
    } as never);
    repository.salvarDivisoes.mockRejectedValue(erroPersistencia);

    await expect(
      service.cancelarGasto('planejamento-1', 'gasto-1', 'user-1'),
    ).rejects.toBe(erroPersistencia);

    expect(repository.salvarGasto).toHaveBeenCalledTimes(1);
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('returns an empty settlement list when planejamento has no expenses', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        gastos: [],
      }),
    );

    const result = await sincronizarAcertosConfigurados(
      'planejamento-1',
      'user-1',
    );

    expect(repository.buscarComGastosDivisoesAcertos).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
    expect(result).toEqual([]);
  });

  it('lists persisted settlements with ids and every status after validating access', async () => {
    const acertos = [
      criarEntidadeAcertoPersistido({
        id: 'acerto-pendente',
        status: AcertoStatus.PENDENTE,
      }),
      criarEntidadeAcertoPersistido({
        id: 'acerto-pago',
        status: AcertoStatus.PAGO,
      }),
      criarEntidadeAcertoPersistido({
        id: 'acerto-cancelado',
        status: AcertoStatus.CANCELADO,
      }),
      criarEntidadeAcertoPersistido({
        id: 'acerto-confirmado',
        status: AcertoStatus.CONFIRMADO,
      }),
    ];
    repository.listarAcertosPorPlanejamento.mockResolvedValue(acertos);

    const result = await service.findAcertos('planejamento-1', 'user-1');

    expect(result).toEqual(
      acertos.map((acerto) => ({
        id: acerto.id,
        dataPagamento: acerto.dataPagamento,
        deParticipante: {
          id: acerto.deParticipante.id,
          nome: acerto.deParticipante.nome,
        },
        deParticipanteId: acerto.deParticipanteId,
        observacao: acerto.observacao,
        paraParticipante: {
          id: acerto.paraParticipante.id,
          nome: acerto.paraParticipante.nome,
        },
        paraParticipanteId: acerto.paraParticipanteId,
        status: acerto.status,
        valorCentavos: acerto.valorCentavos,
      })),
    );
    for (const acerto of result) {
      for (const participante of [
        acerto.deParticipante,
        acerto.paraParticipante,
      ]) {
        expect(participante).toEqual({
          id: expect.any(String) as string,
          nome: expect.any(String) as string,
        });
        expect(participante).not.toHaveProperty('usuarioId');
        expect(participante).not.toHaveProperty('email');
        expect(participante).not.toHaveProperty('planejamentoId');
        expect(participante).not.toHaveProperty('createdAt');
        expect(participante).not.toHaveProperty('updatedAt');
      }
    }

    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
    expect(repository.listarAcertosPorPlanejamento).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.executarEmTransacao).not.toHaveBeenCalled();
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcerto).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('does not list persisted settlements when the planejamento is inaccessible', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(null);

    await expect(
      service.findAcertos('planejamento-1', 'user-sem-acesso'),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_NOT_FOUND' });

    expect(repository.listarAcertosPorPlanejamento).not.toHaveBeenCalled();
    expect(repository.executarEmTransacao).not.toHaveBeenCalled();
  });

  it('returns the complete ABERTO and PENDENTE financial summary', async () => {
    const participante1 = criarParticipanteParaResumo('participante-1', 'Ana');
    const participante2 = criarParticipanteParaResumo(
      'participante-2',
      'Bruno',
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.ABERTO,
        participantes: [participante1, participante2],
        gastos: [criarGastoComPendencia()],
      }),
    );

    const result = await service.findResumo('planejamento-1', 'user-1');

    expect(result).toEqual({
      planejamentoId: 'planejamento-1',
      statusOperacional: PlanejamentoStatus.ABERTO,
      situacaoFinanceira: 'PENDENTE',
      totalGastosAtivosCentavos: 10000,
      obrigacaoResidualCentavos: 5000,
      participantes: [
        {
          participante: {
            id: 'participante-1',
            nome: 'Ana',
            tipo: ParticipanteTipo.VINCULADO,
            status: ParticipanteStatus.ATIVO,
          },
          totalPagoCentavos: 10000,
          totalDevidoCentavos: 5000,
          totalPagoEmAcertosCentavos: 0,
          totalRecebidoEmAcertosCentavos: 0,
          saldoBrutoCentavos: 5000,
          saldoAbertoCentavos: 5000,
          statusFinanceiro: 'RECEBEDOR',
        },
        {
          participante: {
            id: 'participante-2',
            nome: 'Bruno',
            tipo: ParticipanteTipo.MANUAL,
            status: ParticipanteStatus.ATIVO,
          },
          totalPagoCentavos: 0,
          totalDevidoCentavos: 5000,
          totalPagoEmAcertosCentavos: 0,
          totalRecebidoEmAcertosCentavos: 0,
          saldoBrutoCentavos: -5000,
          saldoAbertoCentavos: -5000,
          statusFinanceiro: 'DEVEDOR',
        },
      ],
    });
    expect(result.participantes[0].participante).not.toHaveProperty(
      'usuarioId',
    );
    expect(result.participantes[0].participante).not.toHaveProperty('email');
  });

  it('returns the complete FECHADO and PENDENTE financial summary without changing operational status', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
        participantes: [
          criarParticipanteParaResumo('participante-1', 'Ana'),
          criarParticipanteParaResumo('participante-2', 'Bruno'),
        ],
        gastos: [criarGastoComPendencia()],
      }),
    );

    await expect(
      service.findResumo('planejamento-1', 'user-1'),
    ).resolves.toEqual({
      planejamentoId: 'planejamento-1',
      statusOperacional: PlanejamentoStatus.FECHADO,
      situacaoFinanceira: 'PENDENTE',
      totalGastosAtivosCentavos: 10000,
      obrigacaoResidualCentavos: 5000,
      participantes: [
        {
          participante: {
            id: 'participante-1',
            nome: 'Ana',
            tipo: ParticipanteTipo.VINCULADO,
            status: ParticipanteStatus.ATIVO,
          },
          totalPagoCentavos: 10000,
          totalDevidoCentavos: 5000,
          totalPagoEmAcertosCentavos: 0,
          totalRecebidoEmAcertosCentavos: 0,
          saldoBrutoCentavos: 5000,
          saldoAbertoCentavos: 5000,
          statusFinanceiro: 'RECEBEDOR',
        },
        {
          participante: {
            id: 'participante-2',
            nome: 'Bruno',
            tipo: ParticipanteTipo.MANUAL,
            status: ParticipanteStatus.ATIVO,
          },
          totalPagoCentavos: 0,
          totalDevidoCentavos: 5000,
          totalPagoEmAcertosCentavos: 0,
          totalRecebidoEmAcertosCentavos: 0,
          saldoBrutoCentavos: -5000,
          saldoAbertoCentavos: -5000,
          statusFinanceiro: 'DEVEDOR',
        },
      ],
    });
  });

  it('returns FECHADO and QUITADO after a paid settlement', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
        participantes: [
          criarParticipanteParaResumo('participante-1', 'Ana'),
          criarParticipanteParaResumo('participante-2', 'Bruno'),
        ],
        gastos: [criarGastoComPendencia()],
        acertos: [criarAcertoPersistido({ status: AcertoStatus.PAGO })],
      }),
    );

    const result = await service.findResumo('planejamento-1', 'user-1');

    expect(result).toEqual({
      planejamentoId: 'planejamento-1',
      statusOperacional: PlanejamentoStatus.FECHADO,
      situacaoFinanceira: 'QUITADO',
      totalGastosAtivosCentavos: 10000,
      obrigacaoResidualCentavos: 0,
      participantes: [
        {
          participante: {
            id: 'participante-1',
            nome: 'Ana',
            tipo: ParticipanteTipo.VINCULADO,
            status: ParticipanteStatus.ATIVO,
          },
          totalPagoCentavos: 10000,
          totalDevidoCentavos: 5000,
          totalPagoEmAcertosCentavos: 0,
          totalRecebidoEmAcertosCentavos: 5000,
          saldoBrutoCentavos: 5000,
          saldoAbertoCentavos: 0,
          statusFinanceiro: 'QUITADO',
        },
        {
          participante: {
            id: 'participante-2',
            nome: 'Bruno',
            tipo: ParticipanteTipo.MANUAL,
            status: ParticipanteStatus.ATIVO,
          },
          totalPagoCentavos: 0,
          totalDevidoCentavos: 5000,
          totalPagoEmAcertosCentavos: 5000,
          totalRecebidoEmAcertosCentavos: 0,
          saldoBrutoCentavos: -5000,
          saldoAbertoCentavos: 0,
          statusFinanceiro: 'QUITADO',
        },
      ],
    });
  });

  it('keeps a removed but financially relevant participant in the summary', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        participantes: [
          criarParticipanteParaResumo('participante-1', 'Ana'),
          criarParticipanteParaResumo('participante-2', 'Bruno', {
            status: ParticipanteStatus.REMOVIDO,
          }),
        ],
        gastos: [criarGastoComPendencia()],
      }),
    );

    const result = await service.findResumo('planejamento-1', 'user-1');

    expect(result.participantes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participante: expect.objectContaining({
            id: 'participante-2',
            status: ParticipanteStatus.REMOVIDO,
          }) as object,
          saldoAbertoCentavos: -5000,
        }),
      ]),
    );
  });

  it('excludes a removed participant without financial relevance', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        participantes: [
          criarParticipanteParaResumo('participante-1', 'Ana'),
          criarParticipanteParaResumo('participante-2', 'Bruno'),
          criarParticipanteParaResumo('participante-3', 'Carla', {
            status: ParticipanteStatus.REMOVIDO,
          }),
        ],
        gastos: [criarGastoComPendencia()],
      }),
    );

    const result = await service.findResumo('planejamento-1', 'user-1');

    expect(result.participantes.map((item) => item.participante.id)).toEqual([
      'participante-1',
      'participante-2',
    ]);
  });

  it('ignores canceled, pending-review and soft-deleted expenses in the summary', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        participantes: [
          criarParticipanteParaResumo('participante-1', 'Ana'),
          criarParticipanteParaResumo('participante-2', 'Bruno'),
        ],
        gastos: [
          criarGastoPersistido({ status: GastoStatus.CANCELADO }),
          criarGastoPersistido({
            id: 'gasto-2',
            status: GastoStatus.PENDENTE_REVISAO,
          }),
          criarGastoPersistido({
            id: 'gasto-3',
            deletedAt: new Date('2026-07-15T12:00:00.000Z'),
          }),
        ],
      }),
    );

    await expect(
      service.findResumo('planejamento-1', 'user-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        situacaoFinanceira: 'QUITADO',
        totalGastosAtivosCentavos: 0,
        obrigacaoResidualCentavos: 0,
      }),
    );
  });

  it('reduces the residual balance only with paid or confirmed settlements', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        participantes: [
          criarParticipanteParaResumo('participante-1', 'Ana'),
          criarParticipanteParaResumo('participante-2', 'Bruno'),
        ],
        gastos: [criarGastoComPendencia()],
        acertos: [
          criarAcertoPersistido({
            id: 'acerto-pago',
            status: AcertoStatus.PAGO,
            valorCentavos: 1000,
          }),
          criarAcertoPersistido({
            id: 'acerto-confirmado',
            status: AcertoStatus.CONFIRMADO,
            valorCentavos: 1000,
          }),
          criarAcertoPersistido({
            id: 'acerto-cancelado',
            status: AcertoStatus.CANCELADO,
            valorCentavos: 1000,
          }),
          criarAcertoPersistido({
            id: 'acerto-pendente',
            status: AcertoStatus.PENDENTE,
            valorCentavos: 1000,
          }),
        ],
      }),
    );

    const result = await service.findResumo('planejamento-1', 'user-1');

    expect(result.obrigacaoResidualCentavos).toBe(3000);
    expect(result.situacaoFinanceira).toBe('PENDENTE');
  });

  it('keeps PLANEJAMENTO_NOT_FOUND access isolation in the summary', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(null);

    await expect(
      service.findResumo('planejamento-1', 'user-sem-acesso'),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_NOT_FOUND' });
  });

  it('reads the financial summary without transaction, lock, reconciliation or persistence', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        participantes: [
          criarParticipanteParaResumo('participante-1', 'Ana'),
          criarParticipanteParaResumo('participante-2', 'Bruno'),
        ],
        gastos: [criarGastoComPendencia()],
      }),
    );

    await service.findResumo('planejamento-1', 'user-1');

    expect(repository.buscarComGastosDivisoesAcertos).toHaveBeenCalledTimes(1);
    expect(repository.executarEmTransacao).not.toHaveBeenCalled();
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.salvarPlanejamento).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
    expect(repository.salvarGasto).not.toHaveBeenCalled();
    expect(repository.salvarDivisoes).not.toHaveBeenCalled();
    expect(repository.salvarAcerto).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('calculates suggested settlements for the owner using persisted expenses', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 10000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 5000),
              criarDivisaoPersistida('participante-2', 5000),
            ],
          }),
        ],
      }),
    );

    const result = await sincronizarAcertosConfigurados(
      'planejamento-1',
      'user-1',
    );

    expect(result).toEqual([
      expect.objectContaining({
        deParticipanteId: 'participante-2',
        paraParticipanteId: 'participante-1',
        status: AcertoStatus.PENDENTE,
        valorCentavos: 5000,
      }),
    ]);
    expect(result[0].valorCentavos).toBeGreaterThan(0);
  });

  it('calculates suggested settlements for active participants', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 10000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 5000),
              criarDivisaoPersistida('participante-2', 5000),
            ],
          }),
        ],
      }),
    );

    const result = await sincronizarAcertosConfigurados(
      'planejamento-1',
      'user-2',
    );

    expect(repository.buscarComGastosDivisoesAcertos).toHaveBeenCalledWith(
      'planejamento-1',
      'user-2',
    );
    expect(result).toHaveLength(1);
  });

  it('keeps a removed payer of an active expense in settlement calculation', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        participantes: [
          {
            ...criarParticipantePersistido('participante-1'),
            status: ParticipanteStatus.REMOVIDO,
          },
          criarParticipantePersistido('participante-2'),
        ],
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 10000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 5000),
              criarDivisaoPersistida('participante-2', 5000),
            ],
          }),
        ],
      }),
    );

    await expect(
      sincronizarAcertosConfigurados('planejamento-1', 'user-2'),
    ).resolves.toEqual([
      expect.objectContaining({
        deParticipanteId: 'participante-2',
        paraParticipanteId: 'participante-1',
        valorCentavos: 5000,
      }),
    ]);
  });

  it('keeps a removed participant of an active split in settlement calculation', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        participantes: [
          criarParticipantePersistido('participante-1'),
          {
            ...criarParticipantePersistido('participante-2'),
            status: ParticipanteStatus.REMOVIDO,
          },
        ],
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 10000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 5000),
              criarDivisaoPersistida('participante-2', 5000),
            ],
          }),
        ],
      }),
    );

    await expect(
      sincronizarAcertosConfigurados('planejamento-1', 'user-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        deParticipanteId: 'participante-2',
        paraParticipanteId: 'participante-1',
        valorCentavos: 5000,
      }),
    ]);
  });

  it.each([AcertoStatus.PAGO, AcertoStatus.CONFIRMADO])(
    'keeps removed participants referenced by a %s settlement in calculation',
    async (status) => {
      repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
        criarPlanejamentoComParticipantes({
          participantes: [
            criarParticipantePersistido('participante-1'),
            {
              ...criarParticipantePersistido('participante-2'),
              status: ParticipanteStatus.REMOVIDO,
            },
          ],
          acertos: [criarAcertoPersistido({ status })],
        }),
      );

      await expect(
        sincronizarAcertosConfigurados('planejamento-1', 'user-1'),
      ).resolves.toEqual([
        expect.objectContaining({
          deParticipanteId: 'participante-1',
          paraParticipanteId: 'participante-2',
          valorCentavos: 5000,
        }),
      ]);
    },
  );

  it('does not keep a removed participant referenced only by canceled expenses or splits', async () => {
    const participanteRemovido = {
      ...criarParticipantePersistido('participante-3'),
      status: ParticipanteStatus.REMOVIDO,
    };
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        participantes: [
          criarParticipantePersistido('participante-1'),
          criarParticipantePersistido('participante-2'),
          participanteRemovido,
        ],
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: participanteRemovido.id,
            status: GastoStatus.CANCELADO,
            divisoes: [criarDivisaoPersistida(participanteRemovido.id, 1000)],
          }),
          criarGastoPersistido({
            id: 'gasto-2',
            divisoes: [
              criarDivisaoPersistida('participante-1', 1000),
              {
                ...criarDivisaoPersistida(participanteRemovido.id, 1000),
                status: DivisaoStatus.CANCELADA,
              },
            ],
          }),
        ],
      }),
    );

    await expect(
      sincronizarAcertosConfigurados('planejamento-1', 'user-1'),
    ).resolves.toEqual([]);
  });

  it('does not keep a removed participant referenced only by a soft-deleted active expense', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        participantes: [
          criarParticipantePersistido('participante-1'),
          {
            ...criarParticipantePersistido('participante-2'),
            status: ParticipanteStatus.REMOVIDO,
          },
        ],
        gastos: [
          criarGastoPersistido({
            deletedAt: new Date('2026-07-14T12:00:00.000Z'),
            pagoPorParticipanteId: 'participante-2',
            status: GastoStatus.ATIVO,
            divisoes: [criarDivisaoPersistida('participante-2', 1000)],
          }),
        ],
      }),
    );

    await expect(
      sincronizarAcertosConfigurados('planejamento-1', 'user-1'),
    ).resolves.toEqual([]);
  });

  it.each([AcertoStatus.CANCELADO, AcertoStatus.PENDENTE])(
    'does not keep a removed participant referenced only by a %s settlement',
    async (status) => {
      repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
        criarPlanejamentoComParticipantes({
          participantes: [
            criarParticipantePersistido('participante-1'),
            {
              ...criarParticipantePersistido('participante-2'),
              status: ParticipanteStatus.REMOVIDO,
            },
          ],
          acertos: [criarAcertoPersistido({ status })],
        }),
      );

      await expect(
        sincronizarAcertosConfigurados('planejamento-1', 'user-1'),
      ).resolves.toEqual([]);
    },
  );

  it('deduplicates financially relevant participant ids deterministically', async () => {
    const participanteDuplicado = criarParticipantePersistido('participante-1');
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        participantes: [
          participanteDuplicado,
          { ...participanteDuplicado },
          criarParticipantePersistido('participante-2'),
        ],
        gastos: [criarGastoComPendencia()],
      }),
    );

    await expect(
      sincronizarAcertosConfigurados('planejamento-1', 'user-1'),
    ).resolves.toHaveLength(1);
  });

  it('does not calculate settlements when user has no planejamento access', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(null);

    await expect(
      sincronizarAcertosConfigurados('planejamento-1', 'user-3'),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it('consolidates multiple expenses into minimal settlements', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        participantes: [
          criarParticipantePersistido('participante-1'),
          criarParticipantePersistido('participante-2'),
          criarParticipantePersistido('participante-3'),
        ],
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 12000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 4000),
              criarDivisaoPersistida('participante-2', 4000),
              criarDivisaoPersistida('participante-3', 4000),
            ],
          }),
          criarGastoPersistido({
            id: 'gasto-2',
            pagoPorParticipanteId: 'participante-2',
            valorCentavos: 3000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 1000),
              criarDivisaoPersistida('participante-2', 1000),
              criarDivisaoPersistida('participante-3', 1000),
            ],
          }),
        ],
      }),
    );

    const result = await sincronizarAcertosConfigurados(
      'planejamento-1',
      'user-1',
    );

    expect(result).toEqual([
      expect.objectContaining({
        deParticipanteId: 'participante-2',
        paraParticipanteId: 'participante-1',
        valorCentavos: 2000,
      }),
      expect.objectContaining({
        deParticipanteId: 'participante-3',
        paraParticipanteId: 'participante-1',
        valorCentavos: 5000,
      }),
    ]);
    expect(result.every((acerto) => acerto.valorCentavos > 0)).toBe(true);
  });

  it('does not suggest settlements for balanced participants', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 1000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 500),
              criarDivisaoPersistida('participante-2', 500),
            ],
          }),
          criarGastoPersistido({
            id: 'gasto-2',
            pagoPorParticipanteId: 'participante-2',
            valorCentavos: 1000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 500),
              criarDivisaoPersistida('participante-2', 500),
            ],
          }),
        ],
      }),
    );

    await expect(
      sincronizarAcertosConfigurados('planejamento-1', 'user-1'),
    ).resolves.toEqual([]);
  });

  it('keeps settlement calculation scoped to the requested planejamento aggregate', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        gastos: [
          criarGastoPersistido({
            planejamentoId: 'planejamento-1',
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 1000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 500),
              criarDivisaoPersistida('participante-2', 500),
            ],
          }),
        ],
      }),
    );

    await sincronizarAcertosConfigurados('planejamento-1', 'user-1');

    expect(repository.buscarComGastosDivisoesAcertos).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
  });

  it('synchronizes pending settlement suggestions transactionally', async () => {
    const estadoAntesDoLock = criarPlanejamentoComParticipantes({
      gastos: [],
    });
    const estadoDepoisDoLock = criarPlanejamentoComParticipantes({
      gastos: [criarGastoComPendencia()],
    });
    const acertoCriado = criarEntidadeAcertoPersistido({
      deParticipanteId: 'participante-2',
      paraParticipanteId: 'participante-1',
      valorCentavos: 5000,
    });
    const randomUUIDMock = jest.mocked(crypto.randomUUID);
    repositoryTransacional = {
      ...repository,
      buscarAcessivelComParticipantes: jest.fn(),
      bloquearPlanejamentoParaAtualizacao: jest.fn(),
      buscarComGastosDivisoesAcertos: jest.fn(),
      salvarAcertos: jest.fn(),
    };
    repositoryTransacional.buscarAcessivelComParticipantes.mockResolvedValue(
      estadoAntesDoLock,
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      estadoAntesDoLock,
    );
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValue(
      estadoDepoisDoLock,
    );
    repositoryTransacional.salvarAcertos.mockResolvedValue([acertoCriado]);

    const result = await service.sincronizarAcertos('planejamento-1', 'user-1');

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(
      repositoryTransacional.buscarAcessivelComParticipantes,
    ).toHaveBeenCalledWith('planejamento-1', 'user-1');
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao,
    ).toHaveBeenCalledWith('planejamento-1');
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).toHaveBeenCalledWith('planejamento-1', 'user-1');
    expect(repositoryTransacional.salvarAcertos).toHaveBeenCalledWith([
      expect.objectContaining({
        dataPagamento: null,
        deParticipanteId: 'participante-2',
        observacao: null,
        paraParticipanteId: 'participante-1',
        planejamentoId: 'planejamento-1',
        status: AcertoStatus.PENDENTE,
        valorCentavos: 5000,
      }),
    ]);
    expect(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.buscarComGastosDivisoesAcertos.mock
        .invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.salvarAcertos.mock.invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(randomUUIDMock.mock.invocationCallOrder[0]);
    expect(repository.buscarAcessivelComParticipantes).not.toHaveBeenCalled();
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(result).toEqual([acertoCriado]);
  });

  it('keeps settlement synchronization available and idempotent when a closed planejamento already has the pending suggestion', async () => {
    const acertoPendente = criarAcertoPersistido({
      deParticipanteId: 'participante-2',
      paraParticipanteId: 'participante-1',
      valorCentavos: 5000,
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
      }),
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
        acertos: [acertoPendente],
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 10000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 5000),
              criarDivisaoPersistida('participante-2', 5000),
            ],
          }),
        ],
      }),
    );

    const result = await service.sincronizarAcertos('planejamento-1', 'user-1');

    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(result).toEqual([acertoPendente]);
  });

  it('cancels a pending settlement when no current suggestion remains', async () => {
    const acertoPendente = criarAcertoPersistido({
      dataPagamento: new Date('2026-07-01T00:00:00.000Z'),
      observacao: 'Historico preservado',
    });
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({ acertos: [acertoPendente] }),
    );

    const result = await service.sincronizarAcertos('planejamento-1', 'user-1');

    expect(repository.salvarAcertos).toHaveBeenCalledTimes(1);
    expect(repository.salvarAcertos).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'acerto-1',
        dataPagamento: null,
        observacao: 'Historico preservado',
        status: AcertoStatus.CANCELADO,
      }),
    ]);
    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('cancels the old pending value and creates the newly calculated value', async () => {
    const acertoAntigo = criarAcertoPersistido({ valorCentavos: 4000 });
    const acertoNovo = criarEntidadeAcertoPersistido({
      id: 'acerto-novo',
      valorCentavos: 5000,
    });
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [acertoAntigo],
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 10000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 5000),
              criarDivisaoPersistida('participante-2', 5000),
            ],
          }),
        ],
      }),
    );
    repository.salvarAcertos.mockResolvedValue([acertoNovo]);

    const result = await service.sincronizarAcertos('planejamento-1', 'user-1');

    expect(repository.salvarAcertos).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        id: 'acerto-1',
        status: AcertoStatus.CANCELADO,
        valorCentavos: 4000,
      }),
    ]);
    expect(repository.salvarAcertos).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({
        status: AcertoStatus.PENDENTE,
        valorCentavos: 5000,
      }),
    ]);
    expect(repository.salvarAcertos.mock.invocationCallOrder[0]).toBeLessThan(
      repository.salvarAcertos.mock.invocationCallOrder[1],
    );
    expect(result).toEqual([acertoNovo]);
  });

  it('preserves a valid pending settlement, then cancels an obsolete one before creating and returning a new one', async () => {
    const acertoPendente = criarAcertoPersistido({
      id: 'acerto-pendente',
      deParticipanteId: 'participante-2',
      paraParticipanteId: 'participante-1',
      valorCentavos: 5000,
      status: AcertoStatus.PENDENTE,
    });
    const acertoObsoleto = criarAcertoPersistido({
      id: 'acerto-obsoleto',
      valorCentavos: 1000,
    });
    const acertoNovo = criarEntidadeAcertoPersistido({
      id: 'acerto-novo',
      deParticipanteId: 'participante-4',
      paraParticipanteId: 'participante-3',
      valorCentavos: 3000,
    });
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        participantes: [
          criarParticipantePersistido('participante-1'),
          criarParticipantePersistido('participante-2'),
          criarParticipantePersistido('participante-3'),
          criarParticipantePersistido('participante-4'),
        ],
        acertos: [acertoPendente, acertoObsoleto],
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 10000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 5000),
              criarDivisaoPersistida('participante-2', 5000),
            ],
          }),
          criarGastoPersistido({
            id: 'gasto-2',
            pagoPorParticipanteId: 'participante-3',
            valorCentavos: 6000,
            divisoes: [
              criarDivisaoPersistida('participante-3', 3000),
              criarDivisaoPersistida('participante-4', 3000),
            ],
          }),
        ],
      }),
    );
    repository.salvarAcertos.mockResolvedValue([acertoNovo]);

    const result = await service.sincronizarAcertos('planejamento-1', 'user-1');

    expect(repository.salvarAcertos).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        id: 'acerto-obsoleto',
        status: AcertoStatus.CANCELADO,
      }),
    ]);
    expect(repository.salvarAcertos).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({
        deParticipanteId: 'participante-4',
        paraParticipanteId: 'participante-3',
        status: AcertoStatus.PENDENTE,
        valorCentavos: 3000,
      }),
    ]);
    expect(result).toEqual([acertoPendente, acertoNovo]);
    expect(result).not.toContain(acertoObsoleto);
  });

  it('does not duplicate pending settlements while preserving existing records', async () => {
    const acertoPendente = criarAcertoPersistido({
      id: 'acerto-pendente',
      deParticipanteId: 'participante-2',
      paraParticipanteId: 'participante-1',
      valorCentavos: 5000,
      status: AcertoStatus.PENDENTE,
    });
    const acertoPago = criarAcertoPersistido({
      id: 'acerto-pago',
      deParticipanteId: 'participante-1',
      paraParticipanteId: 'participante-2',
      valorCentavos: 1000,
      status: AcertoStatus.PAGO,
    });
    const acertoConfirmado = criarAcertoPersistido({
      id: 'acerto-confirmado',
      deParticipanteId: 'participante-1',
      paraParticipanteId: 'participante-2',
      valorCentavos: 1000,
      status: AcertoStatus.CONFIRMADO,
    });
    const acertoCancelado = criarAcertoPersistido({
      id: 'acerto-cancelado',
      deParticipanteId: 'participante-1',
      paraParticipanteId: 'participante-2',
      valorCentavos: 1000,
      status: AcertoStatus.CANCELADO,
    });
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [acertoPendente, acertoCancelado],
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 10000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 5000),
              criarDivisaoPersistida('participante-2', 5000),
            ],
          }),
        ],
      }),
    );

    const result = await service.sincronizarAcertos('planejamento-1', 'user-1');

    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(result).toEqual([acertoPendente]);
    expect(acertoPago.status).toBe(AcertoStatus.PAGO);
    expect(acertoConfirmado.status).toBe(AcertoStatus.CONFIRMADO);
    expect(acertoCancelado.status).toBe(AcertoStatus.CANCELADO);
  });

  it('preserves paid, confirmed, and previously canceled settlements without changes', async () => {
    const acertoPago = criarAcertoPersistido({
      id: 'acerto-pago',
      valorCentavos: 1000,
      status: AcertoStatus.PAGO,
    });
    const acertoConfirmado = criarAcertoPersistido({
      id: 'acerto-confirmado',
      deParticipanteId: 'participante-1',
      paraParticipanteId: 'participante-2',
      valorCentavos: 1000,
      status: AcertoStatus.CONFIRMADO,
    });
    const acertoCancelado = criarAcertoPersistido({
      id: 'acerto-cancelado',
      deParticipanteId: 'participante-1',
      paraParticipanteId: 'participante-2',
      valorCentavos: 1000,
      status: AcertoStatus.CANCELADO,
    });
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [acertoPago, acertoConfirmado, acertoCancelado],
      }),
    );

    const result = await service.sincronizarAcertos('planejamento-1', 'user-1');

    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
    expect(acertoPago.status).toBe(AcertoStatus.PAGO);
    expect(acertoConfirmado.status).toBe(AcertoStatus.CONFIRMADO);
    expect(acertoCancelado.status).toBe(AcertoStatus.CANCELADO);
  });

  it('does not create new pending settlements when paid or confirmed settlements already liquidated the balance', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [
          criarAcertoPersistido({
            status: AcertoStatus.PAGO,
          }),
        ],
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 10000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 5000),
              criarDivisaoPersistida('participante-2', 5000),
            ],
          }),
        ],
      }),
    );

    await expect(
      service.sincronizarAcertos('planejamento-1', 'user-1'),
    ).resolves.toEqual([]);
    expect(repository.salvarAcertos).not.toHaveBeenCalled();

    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [
          criarAcertoPersistido({
            status: AcertoStatus.CONFIRMADO,
          }),
        ],
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 10000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 5000),
              criarDivisaoPersistida('participante-2', 5000),
            ],
          }),
        ],
      }),
    );

    await expect(
      service.sincronizarAcertos('planejamento-1', 'user-1'),
    ).resolves.toEqual([]);
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('does not synchronize settlements when user has no planejamento access', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(null);

    await expect(
      service.sincronizarAcertos('planejamento-1', 'user-3'),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);

    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
  });

  it('returns not found when the planejamento disappears before the lock', async () => {
    repository.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(null);

    await expect(
      service.sincronizarAcertos('planejamento-1', 'user-1'),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_NOT_FOUND' });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('propagates failures while acquiring the planejamento lock', async () => {
    const erroLock = new Error('falha ao adquirir lock');
    repository.bloquearPlanejamentoParaAtualizacao.mockRejectedValue(erroLock);

    await expect(
      service.sincronizarAcertos('planejamento-1', 'user-1'),
    ).rejects.toBe(erroLock);

    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('propagates failures while reloading the aggregate after the lock', async () => {
    const erroRecarregamento = new Error('falha no recarregamento');
    repository.buscarComGastosDivisoesAcertos.mockRejectedValue(
      erroRecarregamento,
    );

    await expect(
      service.sincronizarAcertos('planejamento-1', 'user-1'),
    ).rejects.toBe(erroRecarregamento);

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('propagates reconciliation persistence failures from the transaction', async () => {
    const erroPersistencia = new Error('falha na persistencia');
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        gastos: [criarGastoComPendencia()],
      }),
    );
    repository.salvarAcertos.mockRejectedValue(erroPersistencia);

    await expect(
      service.sincronizarAcertos('planejamento-1', 'user-1'),
    ).rejects.toBe(erroPersistencia);

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.salvarAcertos).toHaveBeenCalledTimes(1);
  });

  it('rejects settlement synchronization when calculated participants are not active in planejamento', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        participantes: [criarParticipantePersistido('participante-1')],
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 10000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 5000),
              criarDivisaoPersistida('participante-2', 5000),
            ],
          }),
        ],
      }),
    );

    await expect(
      service.sincronizarAcertos('planejamento-1', 'user-1'),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('rejects adding a participant to a closed planejamento after locking it', async () => {
    prepararPlanejamentoFechadoAposLock();

    await expect(
      service.addParticipante('planejamento-1', 'user-1', {
        nome: 'Novo participante',
      }),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_MUTACAO_ESTRUTURAL_STATUS_INVALIDO',
      details: { statusAtual: PlanejamentoStatus.FECHADO },
      statusCode: 422,
    });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarParticipanteAtivoDuplicado).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('rejects removing a participant from a closed planejamento after locking it', async () => {
    prepararPlanejamentoFechadoAposLock();

    await expect(
      service.removerParticipante('planejamento-1', 'participante-2', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_MUTACAO_ESTRUTURAL_STATUS_INVALIDO',
      details: { statusAtual: PlanejamentoStatus.FECHADO },
      statusCode: 422,
    });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(
      repository.buscarParticipantePorIdEPlanejamento,
    ).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('rejects creating an expense in a closed planejamento after locking it', async () => {
    prepararPlanejamentoFechadoAposLock();

    await expect(
      service.createGasto('planejamento-1', 'user-1', {
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-15',
        descricao: 'Gasto bloqueado',
        pagoPorParticipanteId: 'participante-1',
        participantesIds: ['participante-1', 'participante-2'],
        valorCentavos: 10000,
      }),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_MUTACAO_ESTRUTURAL_STATUS_INVALIDO',
      details: { statusAtual: PlanejamentoStatus.FECHADO },
      statusCode: 422,
    });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.salvarGasto).not.toHaveBeenCalled();
    expect(repository.salvarDivisoes).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('rejects updating an expense in a closed planejamento after locking it', async () => {
    prepararPlanejamentoFechadoAposLock();

    await expect(
      service.atualizarGasto('planejamento-1', 'gasto-1', 'user-1', {
        descricao: 'Atualizacao bloqueada',
      }),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_MUTACAO_ESTRUTURAL_STATUS_INVALIDO',
      details: { statusAtual: PlanejamentoStatus.FECHADO },
      statusCode: 422,
    });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarGastoPorIdEPlanejamento).not.toHaveBeenCalled();
    expect(repository.salvarGasto).not.toHaveBeenCalled();
    expect(repository.salvarDivisoes).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('rejects canceling an expense in a closed planejamento after locking it', async () => {
    prepararPlanejamentoFechadoAposLock();

    await expect(
      service.cancelarGasto('planejamento-1', 'gasto-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_MUTACAO_ESTRUTURAL_STATUS_INVALIDO',
      details: { statusAtual: PlanejamentoStatus.FECHADO },
      statusCode: 422,
    });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarGastoPorIdEPlanejamento).not.toHaveBeenCalled();
    expect(repository.salvarGasto).not.toHaveBeenCalled();
    expect(repository.salvarDivisoes).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('closes an open planejamento after locking and reconciling settlements in one transaction', async () => {
    const planejamentoAberto = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.ABERTO,
    });
    const planejamentoFechado = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.FECHADO,
    });
    const acertoCriado = criarEntidadeAcertoPersistido();
    repository.buscarAcessivelComParticipantes
      .mockResolvedValueOnce(planejamentoAberto)
      .mockResolvedValueOnce(planejamentoFechado);
    repository.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      planejamentoAberto,
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.ABERTO,
        gastos: [criarGastoComPendencia()],
      }),
    );
    repository.salvarAcertos.mockResolvedValue([acertoCriado]);
    repository.salvarPlanejamento.mockResolvedValue(planejamentoFechado);

    const result = await service.fechar('planejamento-1', 'user-1');

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarComGastosDivisoesAcertos).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
    expect(repository.salvarAcertos).toHaveBeenCalledWith([
      expect.objectContaining({
        deParticipanteId: 'participante-2',
        paraParticipanteId: 'participante-1',
        status: AcertoStatus.PENDENTE,
        valorCentavos: 5000,
      }),
    ]);
    expect(repository.salvarPlanejamento).toHaveBeenCalledWith({
      id: 'planejamento-1',
      status: PlanejamentoStatus.FECHADO,
    });
    expectAuditoriaTransicao(
      'PLANEJAMENTO_FECHADO',
      PlanejamentoStatus.ABERTO,
      PlanejamentoStatus.FECHADO,
    );
    expect(
      repository.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarComGastosDivisoesAcertos.mock.invocationCallOrder[0],
    );
    expect(repository.salvarAcertos.mock.invocationCallOrder[0]).toBeLessThan(
      repository.salvarPlanejamento.mock.invocationCallOrder[0],
    );
    expect(
      repository.salvarPlanejamento.mock.invocationCallOrder[0],
    ).toBeLessThan(
      logsService.logEntityEventTransactional.mock.invocationCallOrder[0],
    );
    expect(result).toBe(planejamentoFechado);
  });

  it('preserves an equivalent pending settlement while closing', async () => {
    const planejamentoAberto = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.ABERTO,
    });
    const planejamentoFechado = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.FECHADO,
    });
    const acertoPendente = criarAcertoPersistido();
    repository.buscarAcessivelComParticipantes
      .mockResolvedValueOnce(planejamentoAberto)
      .mockResolvedValueOnce(planejamentoFechado);
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.ABERTO,
        acertos: [acertoPendente],
        gastos: [criarGastoComPendencia()],
      }),
    );
    repository.salvarPlanejamento.mockResolvedValue(planejamentoFechado);

    await expect(service.fechar('planejamento-1', 'user-1')).resolves.toBe(
      planejamentoFechado,
    );

    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(acertoPendente).toMatchObject({
      id: 'acerto-1',
      status: AcertoStatus.PENDENTE,
      valorCentavos: 5000,
    });
    expect(repository.salvarPlanejamento).toHaveBeenCalledWith({
      id: 'planejamento-1',
      status: PlanejamentoStatus.FECHADO,
    });
  });

  it('revalidates planejamento ownership after acquiring the closing lock', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.ABERTO,
      }),
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.ABERTO,
        usuarioCriadorId: 'user-2',
      }),
    );

    await expect(
      service.fechar('planejamento-1', 'user-1'),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_OWNER_REQUIRED' });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarComGastosDivisoesAcertos).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.salvarPlanejamento).not.toHaveBeenCalled();
    expect(logsService.logEntityEventTransactional).not.toHaveBeenCalled();
  });

  it.each([
    PlanejamentoStatus.FECHADO,
    PlanejamentoStatus.ARQUIVADO,
    PlanejamentoStatus.CANCELADO,
  ])('rejects closing a planejamento with status %s', async (status) => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({ status }),
    );

    await expect(
      service.fechar('planejamento-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_FECHAR_STATUS_INVALIDO',
      details: { statusAtual: status },
      statusCode: 422,
    });

    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.salvarPlanejamento).not.toHaveBeenCalled();
    expect(logsService.logEntityEventTransactional).not.toHaveBeenCalled();
  });

  it('rejects closing when an active pending-review expense exists', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.ABERTO,
        gastos: [
          criarGastoPersistido({ status: GastoStatus.PENDENTE_REVISAO }),
        ],
      }),
    );

    await expect(
      service.fechar('planejamento-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_FECHAR_GASTO_PENDENTE_REVISAO',
      statusCode: 422,
    });

    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.salvarPlanejamento).not.toHaveBeenCalled();
    expect(logsService.logEntityEventTransactional).not.toHaveBeenCalled();
  });

  it('archives a closed and financially settled planejamento in the required transactional order', async () => {
    const planejamentoFechado = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.FECHADO,
      acertos: [criarAcertoPersistido({ status: AcertoStatus.PAGO })],
      gastos: [criarGastoComPendencia()],
    });
    const planejamentoArquivado = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.ARQUIVADO,
    });
    repository.buscarAcessivelComParticipantes
      .mockResolvedValueOnce(planejamentoFechado)
      .mockResolvedValueOnce(planejamentoArquivado);
    repository.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      planejamentoFechado,
    );
    repository.buscarComGastosDivisoesAcertos
      .mockResolvedValueOnce(planejamentoFechado)
      .mockResolvedValueOnce(planejamentoFechado);
    repository.salvarPlanejamento.mockResolvedValue(planejamentoArquivado);

    const result = await service.arquivar('planejamento-1', 'user-1');

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.buscarComGastosDivisoesAcertos).toHaveBeenCalledTimes(2);
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.salvarPlanejamento).toHaveBeenCalledWith({
      id: 'planejamento-1',
      status: PlanejamentoStatus.ARQUIVADO,
    });
    expectAuditoriaTransicao(
      'PLANEJAMENTO_ARQUIVADO',
      PlanejamentoStatus.FECHADO,
      PlanejamentoStatus.ARQUIVADO,
    );
    expect(
      repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repository.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    );
    expect(
      repository.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarComGastosDivisoesAcertos.mock.invocationCallOrder[0],
    );
    expect(
      repository.buscarComGastosDivisoesAcertos.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarComGastosDivisoesAcertos.mock.invocationCallOrder[1],
    );
    expect(
      repository.buscarComGastosDivisoesAcertos.mock.invocationCallOrder[1],
    ).toBeLessThan(repository.salvarPlanejamento.mock.invocationCallOrder[0]);
    expect(
      repository.salvarPlanejamento.mock.invocationCallOrder[0],
    ).toBeLessThan(
      logsService.logEntityEventTransactional.mock.invocationCallOrder[0],
    );
    expect(repository.salvarPlanejamento).toHaveBeenCalledTimes(1);
    expect(result).toBe(planejamentoArquivado);
  });

  it.each([
    PlanejamentoStatus.ABERTO,
    PlanejamentoStatus.ARQUIVADO,
    PlanejamentoStatus.CANCELADO,
  ])('rejects archiving a planejamento with status %s', async (status) => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes({ status }),
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({ status }),
    );

    await expect(
      service.arquivar('planejamento-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_ARQUIVAR_STATUS_INVALIDO',
      details: { statusAtual: status },
      statusCode: 422,
    });

    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.salvarPlanejamento).not.toHaveBeenCalled();
    expect(logsService.logEntityEventTransactional).not.toHaveBeenCalled();
  });

  it('rejects a closed planejamento with residual financial obligation after reconciliation', async () => {
    const planejamentoPendente = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.FECHADO,
      gastos: [criarGastoComPendencia()],
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      planejamentoPendente,
    );
    repository.buscarComGastosDivisoesAcertos
      .mockResolvedValueOnce(planejamentoPendente)
      .mockResolvedValueOnce(planejamentoPendente);
    repository.salvarAcertos.mockResolvedValue([
      criarEntidadeAcertoPersistido(),
    ]);

    await expect(
      service.arquivar('planejamento-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_ARQUIVAR_PENDENCIA_FINANCEIRA',
      details: {
        situacaoFinanceira: 'PENDENTE',
        obrigacaoResidualCentavos: 5000,
      },
      statusCode: 422,
    });

    expect(repository.salvarAcertos).toHaveBeenCalledTimes(1);
    expect(repository.buscarComGastosDivisoesAcertos).toHaveBeenCalledTimes(2);
    expect(repository.salvarPlanejamento).not.toHaveBeenCalled();
    expect(logsService.logEntityEventTransactional).not.toHaveBeenCalled();
  });

  it('validates access and ownership before acquiring the archiving lock', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValueOnce(null);

    await expect(
      service.arquivar('planejamento-1', 'user-sem-acesso'),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_NOT_FOUND' });
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();

    jest.clearAllMocks();
    repository.executarEmTransacao.mockImplementation((operacao) =>
      operacao(repository as unknown as PlanejamentosRepository, entityManager),
    );
    repository.buscarAcessivelComParticipantes.mockResolvedValueOnce(
      criarPlanejamentoComParticipantes({ usuarioCriadorId: 'user-2' }),
    );

    await expect(
      service.arquivar('planejamento-1', 'user-1'),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_OWNER_REQUIRED' });
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(logsService.logEntityEventTransactional).not.toHaveBeenCalled();
  });

  it('revalidates ownership on the complete aggregate reloaded after the archiving lock', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes({ status: PlanejamentoStatus.FECHADO }),
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
        usuarioCriadorId: 'user-2',
      }),
    );

    await expect(
      service.arquivar('planejamento-1', 'user-1'),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_OWNER_REQUIRED' });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarComGastosDivisoesAcertos).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.salvarPlanejamento).not.toHaveBeenCalled();
    expect(logsService.logEntityEventTransactional).not.toHaveBeenCalled();
  });

  it('propagates reconciliation failures so the archiving transaction can roll back', async () => {
    const erroReconciliacao = new Error('falha na reconciliacao');
    const planejamentoPendente = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.FECHADO,
      gastos: [criarGastoComPendencia()],
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      planejamentoPendente,
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      planejamentoPendente,
    );
    repository.salvarAcertos.mockRejectedValue(erroReconciliacao);

    await expect(service.arquivar('planejamento-1', 'user-1')).rejects.toBe(
      erroReconciliacao,
    );

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.salvarPlanejamento).not.toHaveBeenCalled();
  });

  it('propagates status persistence failures from the archiving transaction', async () => {
    const erroPersistencia = new Error('falha ao arquivar');
    const planejamentoQuitado = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.FECHADO,
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      planejamentoQuitado,
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      planejamentoQuitado,
    );
    repository.salvarPlanejamento.mockRejectedValue(erroPersistencia);

    await expect(service.arquivar('planejamento-1', 'user-1')).rejects.toBe(
      erroPersistencia,
    );

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.salvarPlanejamento).toHaveBeenCalledWith({
      id: 'planejamento-1',
      status: PlanejamentoStatus.ARQUIVADO,
    });
  });

  it('cancels an open and financially settled planejamento after reconciliation in the required transactional order', async () => {
    const acertoPago = criarAcertoPersistido({
      id: 'acerto-pago',
      status: AcertoStatus.PAGO,
    });
    const acertoObsoleto = criarAcertoPersistido({
      id: 'acerto-obsoleto',
      status: AcertoStatus.PENDENTE,
    });
    const planejamentoAberto = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.ABERTO,
      acertos: [acertoPago, acertoObsoleto],
      gastos: [criarGastoComPendencia()],
    });
    const planejamentoReconciliado = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.ABERTO,
      acertos: [
        acertoPago,
        { ...acertoObsoleto, status: AcertoStatus.CANCELADO },
      ],
      gastos: [criarGastoComPendencia()],
    });
    const planejamentoCancelado = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.CANCELADO,
    });
    repository.buscarAcessivelComParticipantes
      .mockResolvedValueOnce(planejamentoAberto)
      .mockResolvedValueOnce(planejamentoCancelado);
    repository.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      planejamentoAberto,
    );
    repository.buscarComGastosDivisoesAcertos
      .mockResolvedValueOnce(planejamentoAberto)
      .mockResolvedValueOnce(planejamentoReconciliado);
    repository.salvarAcertos.mockResolvedValue([]);
    repository.salvarPlanejamento.mockResolvedValue(planejamentoCancelado);

    const result = await service.cancelar('planejamento-1', 'user-1');

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.buscarComGastosDivisoesAcertos).toHaveBeenCalledTimes(2);
    expect(repository.salvarAcertos).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'acerto-obsoleto',
        status: AcertoStatus.CANCELADO,
      }),
    ]);
    expect(repository.salvarPlanejamento).toHaveBeenCalledWith({
      id: 'planejamento-1',
      status: PlanejamentoStatus.CANCELADO,
    });
    expectAuditoriaTransicao(
      'PLANEJAMENTO_CANCELADO',
      PlanejamentoStatus.ABERTO,
      PlanejamentoStatus.CANCELADO,
    );
    expect(
      repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repository.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    );
    expect(
      repository.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarComGastosDivisoesAcertos.mock.invocationCallOrder[0],
    );
    expect(repository.salvarAcertos.mock.invocationCallOrder[0]).toBeLessThan(
      repository.buscarComGastosDivisoesAcertos.mock.invocationCallOrder[1],
    );
    expect(
      repository.buscarComGastosDivisoesAcertos.mock.invocationCallOrder[1],
    ).toBeLessThan(repository.salvarPlanejamento.mock.invocationCallOrder[0]);
    expect(
      repository.salvarPlanejamento.mock.invocationCallOrder[0],
    ).toBeLessThan(
      logsService.logEntityEventTransactional.mock.invocationCallOrder[0],
    );
    expect(repository.salvarGasto).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
    expect(repository.salvarAcerto).not.toHaveBeenCalled();
    expect(result).toBe(planejamentoCancelado);
  });

  it('cancels an empty open planejamento', async () => {
    const planejamentoAberto = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.ABERTO,
    });
    const planejamentoCancelado = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.CANCELADO,
    });
    repository.buscarAcessivelComParticipantes
      .mockResolvedValueOnce(planejamentoAberto)
      .mockResolvedValueOnce(planejamentoCancelado);
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      planejamentoAberto,
    );
    repository.salvarPlanejamento.mockResolvedValue(planejamentoCancelado);

    await expect(service.cancelar('planejamento-1', 'user-1')).resolves.toBe(
      planejamentoCancelado,
    );

    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.salvarPlanejamento).toHaveBeenCalledWith({
      id: 'planejamento-1',
      status: PlanejamentoStatus.CANCELADO,
    });
  });

  it('allows cancellation with a pending-review expense that creates no valid obligation', async () => {
    const planejamentoAberto = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.ABERTO,
      gastos: [criarGastoPersistido({ status: GastoStatus.PENDENTE_REVISAO })],
    });
    const planejamentoCancelado = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.CANCELADO,
    });
    repository.buscarAcessivelComParticipantes
      .mockResolvedValueOnce(planejamentoAberto)
      .mockResolvedValueOnce(planejamentoCancelado);
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      planejamentoAberto,
    );
    repository.salvarPlanejamento.mockResolvedValue(planejamentoCancelado);

    await expect(service.cancelar('planejamento-1', 'user-1')).resolves.toBe(
      planejamentoCancelado,
    );

    expect(repository.salvarPlanejamento).toHaveBeenCalledWith({
      id: 'planejamento-1',
      status: PlanejamentoStatus.CANCELADO,
    });
  });

  it.each([
    PlanejamentoStatus.FECHADO,
    PlanejamentoStatus.ARQUIVADO,
    PlanejamentoStatus.CANCELADO,
  ])('rejects canceling a planejamento with status %s', async (status) => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes({ status }),
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({ status }),
    );

    await expect(
      service.cancelar('planejamento-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_CANCELAR_STATUS_INVALIDO',
      details: { statusAtual: status },
      statusCode: 422,
    });

    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.salvarPlanejamento).not.toHaveBeenCalled();
    expect(logsService.logEntityEventTransactional).not.toHaveBeenCalled();
  });

  it('rejects an open planejamento with residual financial obligation after reconciliation', async () => {
    const planejamentoPendente = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.ABERTO,
      gastos: [criarGastoComPendencia()],
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      planejamentoPendente,
    );
    repository.buscarComGastosDivisoesAcertos
      .mockResolvedValueOnce(planejamentoPendente)
      .mockResolvedValueOnce(planejamentoPendente);
    repository.salvarAcertos.mockResolvedValue([
      criarEntidadeAcertoPersistido(),
    ]);

    await expect(
      service.cancelar('planejamento-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_CANCELAR_PENDENCIA_FINANCEIRA',
      details: {
        situacaoFinanceira: 'PENDENTE',
        obrigacaoResidualCentavos: 5000,
      },
      statusCode: 422,
    });

    expect(repository.salvarAcertos).toHaveBeenCalledTimes(1);
    expect(repository.buscarComGastosDivisoesAcertos).toHaveBeenCalledTimes(2);
    expect(repository.salvarPlanejamento).not.toHaveBeenCalled();
    expect(logsService.logEntityEventTransactional).not.toHaveBeenCalled();
  });

  it('validates access and ownership before acquiring the cancellation lock', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValueOnce(null);

    await expect(
      service.cancelar('planejamento-1', 'user-sem-acesso'),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_NOT_FOUND' });
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();

    jest.clearAllMocks();
    repository.executarEmTransacao.mockImplementation((operacao) =>
      operacao(repository as unknown as PlanejamentosRepository, entityManager),
    );
    repository.buscarAcessivelComParticipantes.mockResolvedValueOnce(
      criarPlanejamentoComParticipantes({ usuarioCriadorId: 'user-2' }),
    );

    await expect(
      service.cancelar('planejamento-1', 'user-1'),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_OWNER_REQUIRED' });
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(logsService.logEntityEventTransactional).not.toHaveBeenCalled();
  });

  it('revalidates ownership on the aggregate reloaded after the cancellation lock', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes({ status: PlanejamentoStatus.ABERTO }),
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.ABERTO,
        usuarioCriadorId: 'user-2',
      }),
    );

    await expect(
      service.cancelar('planejamento-1', 'user-1'),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_OWNER_REQUIRED' });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarComGastosDivisoesAcertos).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.salvarPlanejamento).not.toHaveBeenCalled();
    expect(logsService.logEntityEventTransactional).not.toHaveBeenCalled();
  });

  it('propagates reconciliation failures so the cancellation transaction can roll back', async () => {
    const erroReconciliacao = new Error('falha na reconciliacao');
    const planejamentoPendente = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.ABERTO,
      gastos: [criarGastoComPendencia()],
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      planejamentoPendente,
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      planejamentoPendente,
    );
    repository.salvarAcertos.mockRejectedValue(erroReconciliacao);

    await expect(service.cancelar('planejamento-1', 'user-1')).rejects.toBe(
      erroReconciliacao,
    );

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.salvarPlanejamento).not.toHaveBeenCalled();
  });

  it('propagates status persistence failures from the cancellation transaction', async () => {
    const erroPersistencia = new Error('falha ao cancelar');
    const planejamentoQuitado = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.ABERTO,
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      planejamentoQuitado,
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      planejamentoQuitado,
    );
    repository.salvarPlanejamento.mockRejectedValue(erroPersistencia);

    await expect(service.cancelar('planejamento-1', 'user-1')).rejects.toBe(
      erroPersistencia,
    );

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.salvarPlanejamento).toHaveBeenCalledWith({
      id: 'planejamento-1',
      status: PlanejamentoStatus.CANCELADO,
    });
    expect(logsService.logEntityEventTransactional).not.toHaveBeenCalled();
  });

  it('propagates transactional audit failures after persisting the cancellation status', async () => {
    const erroAuditoria = new Error('falha na auditoria transacional');
    const planejamentoAberto = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.ABERTO,
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      planejamentoAberto,
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      planejamentoAberto,
    );
    repository.salvarPlanejamento.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.CANCELADO,
      }),
    );
    logsService.logEntityEventTransactional.mockRejectedValue(erroAuditoria);

    await expect(service.cancelar('planejamento-1', 'user-1')).rejects.toBe(
      erroAuditoria,
    );

    expect(repository.salvarPlanejamento).toHaveBeenCalledWith({
      id: 'planejamento-1',
      status: PlanejamentoStatus.CANCELADO,
    });
    expectAuditoriaTransicao(
      'PLANEJAMENTO_CANCELADO',
      PlanejamentoStatus.ABERTO,
      PlanejamentoStatus.CANCELADO,
    );
  });

  it.each([
    'sincronizarAcertos',
    'pagarAcerto',
    'cancelarAcerto',
    'reabrirAcerto',
  ] as const)(
    'blocks %s after the lock when planejamento is archived or canceled',
    async (operacao) => {
      for (const status of [
        PlanejamentoStatus.ARQUIVADO,
        PlanejamentoStatus.CANCELADO,
      ]) {
        jest.clearAllMocks();
        repository.executarEmTransacao.mockImplementation((callback) =>
          callback(
            repository as unknown as PlanejamentosRepository,
            entityManager,
          ),
        );
        repository.buscarAcessivelComParticipantes.mockResolvedValue(
          criarPlanejamentoComParticipantes({ status }),
        );
        repository.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
          criarPlanejamentoComParticipantes({ status }),
        );
        repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
          criarPlanejamentoComParticipantes({ status }),
        );

        const chamada =
          operacao === 'sincronizarAcertos'
            ? service.sincronizarAcertos('planejamento-1', 'user-1')
            : service[operacao]('planejamento-1', 'acerto-1', 'user-1');

        await expect(chamada).rejects.toMatchObject({
          code: 'PLANEJAMENTO_ACERTO_OPERACAO_STATUS_INVALIDO',
          details: { statusAtual: status },
          statusCode: 422,
        });
        if (operacao === 'reabrirAcerto') {
          expect(
            repository.bloquearPlanejamentoParaAtualizacao,
          ).not.toHaveBeenCalled();
        } else {
          expect(
            repository.bloquearPlanejamentoParaAtualizacao,
          ).toHaveBeenCalledWith('planejamento-1');
        }
        expect(repository.salvarAcerto).not.toHaveBeenCalled();
        expect(repository.salvarAcertos).not.toHaveBeenCalled();
      }
    },
  );

  it('allows owner to mark a pending settlement as paid in a closed planejamento', async () => {
    const acertoPendente = criarEntidadeAcertoPersistido({
      deParticipante: criarParticipantePersistido('participante-2', 'user-2'),
    });
    const acertoPago = criarEntidadeAcertoPersistido({
      status: AcertoStatus.PAGO,
      dataPagamento: new Date('2026-07-13T12:00:00.000Z'),
    });
    repositoryTransacional = {
      ...repository,
      buscarAcessivelComParticipantes: jest.fn(),
      buscarAcertoPorIdEPlanejamento: jest.fn(),
      bloquearPlanejamentoParaAtualizacao: jest.fn(),
      buscarComGastosDivisoesAcertos: jest.fn(),
      salvarAcerto: jest.fn(),
      salvarAcertos: jest.fn(),
    };
    repositoryTransacional.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
      }),
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
      }),
    );
    repositoryTransacional.buscarAcertoPorIdEPlanejamento.mockResolvedValue(
      acertoPendente,
    );
    repositoryTransacional.salvarAcerto.mockResolvedValue(acertoPago);
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
        acertos: [acertoPago],
        gastos: [criarGastoComPendencia()],
      }),
    );

    const result = await service.pagarAcerto(
      'planejamento-1',
      'acerto-1',
      'user-1',
    );

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(
      repositoryTransacional.buscarAcertoPorIdEPlanejamento,
    ).toHaveBeenCalledWith('acerto-1', 'planejamento-1');
    expect(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[1],
    );
    expect(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[1],
    ).toBeLessThan(
      repositoryTransacional.buscarAcertoPorIdEPlanejamento.mock
        .invocationCallOrder[0],
    );
    expect(repositoryTransacional.salvarAcerto).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'acerto-1',
        status: AcertoStatus.PAGO,
        dataPagamento: expect.any(Date) as Date,
      }),
    );
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.salvarAcerto.mock.invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).toHaveBeenCalledWith('planejamento-1', 'user-1');
    expect(repositoryTransacional.salvarAcertos).not.toHaveBeenCalled();
    expect(
      repositoryTransacional.salvarAcerto.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.buscarComGastosDivisoesAcertos.mock
        .invocationCallOrder[0],
    );
    expect(repository.buscarAcessivelComParticipantes).not.toHaveBeenCalled();
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.buscarAcertoPorIdEPlanejamento).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcerto).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(result).toBe(acertoPago);
    expect(result.status).toBe(AcertoStatus.PAGO);
  });

  it('allows debtor participant to mark a pending settlement as paid', async () => {
    const acertoPendente = criarEntidadeAcertoPersistido({
      deParticipante: criarParticipantePersistido('participante-2', 'user-2'),
    });
    const acertoPago = criarEntidadeAcertoPersistido({
      status: AcertoStatus.PAGO,
      dataPagamento: new Date('2026-07-13T12:00:00.000Z'),
    });
    repositoryTransacional = {
      ...repository,
      buscarAcessivelComParticipantes: jest.fn(),
      buscarAcertoPorIdEPlanejamento: jest.fn(),
      bloquearPlanejamentoParaAtualizacao: jest.fn(),
      buscarComGastosDivisoesAcertos: jest.fn(),
      salvarAcerto: jest.fn(),
      salvarAcertos: jest.fn(),
    };
    repositoryTransacional.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes({ usuarioCriadorId: 'owner-1' }),
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      criarPlanejamentoComParticipantes({ usuarioCriadorId: 'owner-1' }),
    );
    repositoryTransacional.buscarAcertoPorIdEPlanejamento.mockResolvedValue(
      acertoPendente,
    );
    repositoryTransacional.salvarAcerto.mockResolvedValue(acertoPago);
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        usuarioCriadorId: 'owner-1',
        acertos: [acertoPago],
        gastos: [criarGastoComPendencia()],
      }),
    );

    const result = await service.pagarAcerto(
      'planejamento-1',
      'acerto-1',
      'user-2',
    );

    expect(repositoryTransacional.salvarAcerto).toHaveBeenCalledWith(
      expect.objectContaining({ status: AcertoStatus.PAGO }),
    );
    expect(repositoryTransacional.salvarAcertos).not.toHaveBeenCalled();
    expect(result).toBe(acertoPago);
  });

  it('rejects creditor participant when marking a settlement as paid', async () => {
    repositoryTransacional = {
      ...repository,
      buscarAcessivelComParticipantes: jest.fn(),
      buscarAcertoPorIdEPlanejamento: jest.fn(),
      bloquearPlanejamentoParaAtualizacao: jest.fn(),
      buscarComGastosDivisoesAcertos: jest.fn(),
      salvarAcerto: jest.fn(),
      salvarAcertos: jest.fn(),
    };
    repositoryTransacional.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes({ usuarioCriadorId: 'owner-1' }),
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      criarPlanejamentoComParticipantes({ usuarioCriadorId: 'owner-1' }),
    );
    repositoryTransacional.buscarAcertoPorIdEPlanejamento.mockResolvedValue(
      criarEntidadeAcertoPersistido({
        deParticipante: criarParticipantePersistido('participante-2', 'user-2'),
        paraParticipante: criarParticipantePersistido(
          'participante-1',
          'user-3',
        ),
      }),
    );

    await expect(
      service.pagarAcerto('planejamento-1', 'acerto-1', 'user-3'),
    ).rejects.toBeInstanceOf(ForbiddenResourceException);

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repositoryTransacional.salvarAcerto).not.toHaveBeenCalled();
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).not.toHaveBeenCalled();
    expect(repository.salvarAcerto).not.toHaveBeenCalled();
  });

  it('rejects payment when settlement is not pending', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValue(
      criarEntidadeAcertoPersistido({ status: AcertoStatus.PAGO }),
    );

    await expect(
      service.pagarAcerto('planejamento-1', 'acerto-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_ACERTO_PAGAR_STATUS_INVALIDO',
    });

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.salvarAcerto).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('cancels obsolete pending settlements after persisting the target payment', async () => {
    const acertoPendente = criarEntidadeAcertoPersistido();
    const pendenteObsoleto = criarEntidadeAcertoPersistido({
      id: 'acerto-pendente-obsoleto',
    });
    const acertoPago = criarEntidadeAcertoPersistido({
      status: AcertoStatus.PAGO,
      dataPagamento: new Date('2026-07-13T12:00:00.000Z'),
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValue(acertoPendente);
    repository.salvarAcerto.mockResolvedValue(acertoPago);
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [acertoPago, pendenteObsoleto],
        gastos: [criarGastoComPendencia()],
      }),
    );
    repository.salvarAcertos.mockResolvedValue([]);

    const result = await service.pagarAcerto(
      'planejamento-1',
      'acerto-1',
      'user-1',
    );

    expect(repository.salvarAcertos).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'acerto-pendente-obsoleto',
        status: AcertoStatus.CANCELADO,
        dataPagamento: null,
      }),
    ]);
    expect(repository.salvarAcerto.mock.invocationCallOrder[0]).toBeLessThan(
      repository.salvarAcertos.mock.invocationCallOrder[0],
    );
    expect(result).toBe(acertoPago);
  });

  it('creates only the newly calculated pending balance after payment', async () => {
    const acertoPendente = criarEntidadeAcertoPersistido();
    const acertoPago = criarEntidadeAcertoPersistido({
      status: AcertoStatus.PAGO,
      dataPagamento: new Date('2026-07-13T12:00:00.000Z'),
    });
    const novaPendencia = criarEntidadeAcertoPersistido({
      id: 'acerto-saldo-restante',
      valorCentavos: 2000,
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValue(acertoPendente);
    repository.salvarAcerto.mockResolvedValue(acertoPago);
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [acertoPago],
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 14000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 7000),
              criarDivisaoPersistida('participante-2', 7000),
            ],
          }),
        ],
      }),
    );
    repository.salvarAcertos.mockResolvedValue([novaPendencia]);

    const result = await service.pagarAcerto(
      'planejamento-1',
      'acerto-1',
      'user-1',
    );

    expect(repository.salvarAcertos).toHaveBeenCalledWith([
      expect.objectContaining({
        deParticipanteId: 'participante-2',
        paraParticipanteId: 'participante-1',
        status: AcertoStatus.PENDENTE,
        valorCentavos: 2000,
      }),
    ]);
    expect(repository.salvarAcertos.mock.calls[0][0]).toHaveLength(1);
    expect(repository.salvarAcerto.mock.invocationCallOrder[0]).toBeLessThan(
      repository.salvarAcertos.mock.invocationCallOrder[0],
    );
    expect(result).toBe(acertoPago);
  });

  it('propagates reconciliation failures from the payment transaction', async () => {
    const erroReconciliacao = new Error('falha na reconciliacao');
    const acertoPendente = criarEntidadeAcertoPersistido();
    const acertoPago = criarEntidadeAcertoPersistido({
      status: AcertoStatus.PAGO,
      dataPagamento: new Date('2026-07-13T12:00:00.000Z'),
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValue(acertoPendente);
    repository.salvarAcerto.mockResolvedValue(acertoPago);
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [acertoPago],
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 14000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 7000),
              criarDivisaoPersistida('participante-2', 7000),
            ],
          }),
        ],
      }),
    );
    repository.salvarAcertos.mockRejectedValue(erroReconciliacao);

    await expect(
      service.pagarAcerto('planejamento-1', 'acerto-1', 'user-1'),
    ).rejects.toBe(erroReconciliacao);

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.salvarAcerto).toHaveBeenCalledTimes(1);
    expect(repository.salvarAcertos).toHaveBeenCalledTimes(1);
  });

  it('rejects settlement changes when user has no planejamento access', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(null);

    await expect(
      service.pagarAcerto('planejamento-1', 'acerto-1', 'user-3'),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);

    expect(repository.buscarAcertoPorIdEPlanejamento).not.toHaveBeenCalled();
    expect(repository.salvarAcerto).not.toHaveBeenCalled();
  });

  it('rejects settlement changes when acerto does not belong to planejamento', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValue(null);

    await expect(
      service.pagarAcerto('planejamento-1', 'acerto-outro', 'user-1'),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);

    expect(repository.salvarAcerto).not.toHaveBeenCalled();
  });

  it.each(['pagarAcerto', 'cancelarAcerto', 'reabrirAcerto'] as const)(
    'does not lock or load the settlement without planejamento access in %s',
    async (transicao) => {
      repository.buscarAcessivelComParticipantes.mockResolvedValue(null);

      await expect(
        service[transicao]('planejamento-1', 'acerto-1', 'user-3'),
      ).rejects.toMatchObject({ code: 'PLANEJAMENTO_NOT_FOUND' });

      expect(
        repository.bloquearPlanejamentoParaAtualizacao,
      ).not.toHaveBeenCalled();
      expect(repository.buscarAcertoPorIdEPlanejamento).not.toHaveBeenCalled();
    },
  );

  it.each(['pagarAcerto', 'cancelarAcerto', 'reabrirAcerto'] as const)(
    'returns PLANEJAMENTO_NOT_FOUND when the planejamento disappears at the lock in %s',
    async (transicao) => {
      repository.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(null);

      await expect(
        service[transicao]('planejamento-1', 'acerto-1', 'user-1'),
      ).rejects.toMatchObject({ code: 'PLANEJAMENTO_NOT_FOUND' });

      expect(
        repository.bloquearPlanejamentoParaAtualizacao,
      ).toHaveBeenCalledWith('planejamento-1');
      expect(repository.buscarAcertoPorIdEPlanejamento).not.toHaveBeenCalled();
    },
  );

  it.each(['pagarAcerto', 'cancelarAcerto', 'reabrirAcerto'] as const)(
    'returns PLANEJAMENTO_ACERTO_NOT_FOUND only after locking in %s',
    async (transicao) => {
      repository.buscarAcertoPorIdEPlanejamento.mockResolvedValue(null);

      await expect(
        service[transicao]('planejamento-1', 'acerto-outro', 'user-1'),
      ).rejects.toMatchObject({ code: 'PLANEJAMENTO_ACERTO_NOT_FOUND' });

      expect(
        repository.bloquearPlanejamentoParaAtualizacao.mock
          .invocationCallOrder[0],
      ).toBeLessThan(
        repository.buscarAcertoPorIdEPlanejamento.mock.invocationCallOrder[0],
      );
      expect(repository.salvarAcerto).not.toHaveBeenCalled();
    },
  );

  it.each(['pagarAcerto', 'cancelarAcerto', 'reabrirAcerto'] as const)(
    'propagates planejamento lock failures without loading the settlement in %s',
    async (transicao) => {
      const erroLock = new Error(`falha no lock de ${transicao}`);
      repository.bloquearPlanejamentoParaAtualizacao.mockRejectedValue(
        erroLock,
      );

      await expect(
        service[transicao]('planejamento-1', 'acerto-1', 'user-1'),
      ).rejects.toBe(erroLock);

      expect(repository.buscarAcertoPorIdEPlanejamento).not.toHaveBeenCalled();
      expect(repository.salvarAcerto).not.toHaveBeenCalled();
    },
  );

  it('cancels a paid settlement in a closed planejamento and recreates the corresponding pending settlement in one transaction', async () => {
    const acertoPago = criarEntidadeAcertoPersistido({
      status: AcertoStatus.PAGO,
      dataPagamento: new Date('2026-07-04T00:00:00.000Z'),
    });
    const acertoCancelado = criarEntidadeAcertoPersistido({
      status: AcertoStatus.CANCELADO,
      dataPagamento: null,
    });
    const novaPendencia = criarEntidadeAcertoPersistido({
      id: 'acerto-novo',
    });
    repositoryTransacional = {
      ...repository,
      buscarAcessivelComParticipantes: jest.fn(),
      buscarAcertoPorIdEPlanejamento: jest.fn(),
      bloquearPlanejamentoParaAtualizacao: jest.fn(),
      buscarComGastosDivisoesAcertos: jest.fn(),
      salvarAcerto: jest.fn(),
      salvarAcertos: jest.fn(),
    };
    repositoryTransacional.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
      }),
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
      }),
    );
    repositoryTransacional.buscarAcertoPorIdEPlanejamento.mockResolvedValue(
      acertoPago,
    );
    repositoryTransacional.salvarAcerto.mockResolvedValue(acertoCancelado);
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
        acertos: [acertoCancelado],
        gastos: [criarGastoComPendencia()],
      }),
    );
    repositoryTransacional.salvarAcertos.mockResolvedValue([novaPendencia]);

    const result = await service.cancelarAcerto(
      'planejamento-1',
      'acerto-1',
      'user-1',
    );

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao,
    ).toHaveBeenCalledWith('planejamento-1');
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.buscarAcertoPorIdEPlanejamento.mock
        .invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.salvarAcerto.mock.invocationCallOrder[0],
    );
    expect(repositoryTransacional.salvarAcerto).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AcertoStatus.CANCELADO,
        dataPagamento: null,
      }),
    );
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).toHaveBeenCalledWith('planejamento-1', 'user-1');
    expect(repositoryTransacional.salvarAcertos).toHaveBeenCalledWith([
      expect.objectContaining({
        deParticipanteId: 'participante-2',
        paraParticipanteId: 'participante-1',
        status: AcertoStatus.PENDENTE,
        dataPagamento: null,
        valorCentavos: 5000,
      }),
    ]);
    expect(
      repository.executarEmTransacao.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[0],
    );
    expect(repository.buscarAcessivelComParticipantes).not.toHaveBeenCalled();
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.buscarAcertoPorIdEPlanejamento).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcerto).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(result).toBe(acertoCancelado);
    expect(result.status).toBe(AcertoStatus.CANCELADO);
  });

  it('cancels a pending settlement without forgiving the debt and creates a new equivalent pending record', async () => {
    const acertoPendente = criarEntidadeAcertoPersistido();
    const acertoCancelado = criarEntidadeAcertoPersistido({
      status: AcertoStatus.CANCELADO,
      dataPagamento: null,
    });
    const novaPendencia = criarEntidadeAcertoPersistido({
      id: 'acerto-novo',
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValue(acertoPendente);
    repository.salvarAcerto.mockResolvedValue(acertoCancelado);
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [acertoCancelado],
        gastos: [criarGastoComPendencia()],
      }),
    );
    repository.salvarAcertos.mockResolvedValue([novaPendencia]);

    const result = await service.cancelarAcerto(
      'planejamento-1',
      'acerto-1',
      'user-1',
    );

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao,
    ).toHaveBeenCalledWith('planejamento-1');
    expect(repository.salvarAcertos).toHaveBeenCalledWith([
      expect.objectContaining({
        deParticipanteId: acertoPendente.deParticipanteId,
        paraParticipanteId: acertoPendente.paraParticipanteId,
        status: AcertoStatus.PENDENTE,
        valorCentavos: acertoPendente.valorCentavos,
      }),
    ]);
    expect(repository.salvarAcertos.mock.calls[0][0][0]?.id).not.toBe(
      'acerto-1',
    );
    expect(result).toBe(acertoCancelado);
    expect(result.status).toBe(AcertoStatus.CANCELADO);
  });

  it('rejects non-owner canceling or reopening settlements', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes({ usuarioCriadorId: 'owner-1' }),
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValue(
      criarAcertoPersistido({ status: AcertoStatus.PENDENTE }) as never,
    );

    await expect(
      service.cancelarAcerto('planejamento-1', 'acerto-1', 'user-2'),
    ).rejects.toBeInstanceOf(ForbiddenResourceException);
    await expect(
      service.reabrirAcerto('planejamento-1', 'acerto-1', 'user-2'),
    ).rejects.toBeInstanceOf(ForbiddenResourceException);

    expect(repository.salvarAcerto).not.toHaveBeenCalled();
  });

  it('reopens a paid settlement in a closed planejamento when the same obligation remains valid', async () => {
    const dataPagamento = new Date('2026-07-04T00:00:00.000Z');
    const acertoPago = criarEntidadeAcertoPersistido({
      status: AcertoStatus.PAGO,
      dataPagamento,
    });
    const acertoReaberto = criarEntidadeAcertoPersistido({
      status: AcertoStatus.PENDENTE,
      dataPagamento: null,
    });
    repositoryTransacional = {
      ...repository,
      buscarAcessivelComParticipantes: jest.fn(),
      buscarAcertoPorIdEPlanejamento: jest.fn(),
      bloquearPlanejamentoParaAtualizacao: jest.fn(),
      buscarComGastosDivisoesAcertos: jest.fn(),
      salvarAcerto: jest.fn(),
      salvarAcertos: jest.fn(),
    };
    repositoryTransacional.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
      }),
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
      }),
    );
    repositoryTransacional.buscarAcertoPorIdEPlanejamento.mockResolvedValue(
      acertoPago,
    );
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValueOnce(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
        acertos: [acertoPago],
        gastos: [criarGastoComPendencia()],
      }),
    );
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValueOnce(
      criarPlanejamentoComParticipantes({
        status: PlanejamentoStatus.FECHADO,
        acertos: [acertoPago],
        gastos: [criarGastoComPendencia()],
      }),
    );
    repositoryTransacional.salvarAcerto.mockResolvedValue(acertoReaberto);

    const result = await service.reabrirAcerto(
      'planejamento-1',
      'acerto-1',
      'user-1',
    );

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao,
    ).toHaveBeenCalledWith('planejamento-1');
    expect(repositoryTransacional.salvarAcerto).toHaveBeenCalledWith(
      expect.objectContaining({
        id: acertoPago.id,
        status: AcertoStatus.PENDENTE,
        dataPagamento: null,
      }),
    );
    expect(repositoryTransacional.salvarAcertos).not.toHaveBeenCalled();
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.buscarAcertoPorIdEPlanejamento.mock
        .invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.salvarAcerto.mock.invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    );
    expect(logsService.logEntityEventTransactional).toHaveBeenCalledWith(
      {
        event: 'ACERTO_PLANEJAMENTO_REABERTO',
        module: 'planejamentos',
        action: 'update',
        success: true,
        userId: 'user-1',
        entity: 'acerto_planejamento',
        entityId: acertoPago.id,
        details: {
          statusAnterior: AcertoStatus.PAGO,
          statusPosterior: AcertoStatus.PENDENTE,
          dataPagamentoAnterior: dataPagamento,
        },
        context: {
          statusCode: 200,
        },
      },
      entityManager,
    );
    expect(repository.buscarAcessivelComParticipantes).not.toHaveBeenCalled();
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.buscarAcertoPorIdEPlanejamento).not.toHaveBeenCalled();
    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcerto).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(result).toBe(acertoReaberto);
    expect(result.status).toBe(AcertoStatus.PENDENTE);
  });

  it('cancels an equivalent pending duplicate while preserving the paid settlement id', async () => {
    const acertoPago = criarEntidadeAcertoPersistido({
      id: 'acerto-pago',
      status: AcertoStatus.PAGO,
      dataPagamento: new Date('2026-07-04T00:00:00.000Z'),
    });
    const pendenteEquivalente = criarEntidadeAcertoPersistido({
      id: 'acerto-pendente-atual',
      status: AcertoStatus.PENDENTE,
    });
    const pendenteCancelado = criarEntidadeAcertoPersistido({
      ...pendenteEquivalente,
      status: AcertoStatus.CANCELADO,
      dataPagamento: null,
    });
    const acertoReaberto = criarEntidadeAcertoPersistido({
      ...acertoPago,
      status: AcertoStatus.PENDENTE,
      dataPagamento: null,
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValue(acertoPago);
    repository.buscarComGastosDivisoesAcertos.mockResolvedValueOnce(
      criarPlanejamentoComParticipantes({
        acertos: [acertoPago, pendenteEquivalente],
        gastos: [criarGastoComPendencia()],
      }),
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValueOnce(
      criarPlanejamentoComParticipantes({
        acertos: [acertoPago, pendenteCancelado],
        gastos: [criarGastoComPendencia()],
      }),
    );
    repository.salvarAcertos.mockResolvedValue([pendenteCancelado]);
    repository.salvarAcerto.mockResolvedValue(acertoReaberto);

    const result = await service.reabrirAcerto(
      'planejamento-1',
      'acerto-pago',
      'user-1',
    );

    expect(repository.salvarAcertos).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'acerto-pendente-atual',
        status: AcertoStatus.CANCELADO,
        dataPagamento: null,
      }),
    ]);
    expect(repository.salvarAcerto).toHaveBeenCalledTimes(1);
    expect(repository.salvarAcerto).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'acerto-pago',
        status: AcertoStatus.PENDENTE,
        dataPagamento: null,
      }),
    );
    expect(repository.salvarAcertos.mock.invocationCallOrder[0]).toBeLessThan(
      repository.salvarAcerto.mock.invocationCallOrder[0],
    );
    expect(result).toBe(acertoReaberto);
    expect(result.id).toBe('acerto-pago');
    expect(result.status).toBe(AcertoStatus.PENDENTE);
  });

  it('rejects reopening a paid settlement whose obligation became obsolete', async () => {
    const acertoPago = criarEntidadeAcertoPersistido({
      status: AcertoStatus.PAGO,
      dataPagamento: new Date('2026-07-04T00:00:00.000Z'),
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValue(acertoPago);
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [acertoPago],
        gastos: [
          criarGastoPersistido({
            pagoPorParticipanteId: 'participante-1',
            valorCentavos: 8000,
            divisoes: [
              criarDivisaoPersistida('participante-1', 4000),
              criarDivisaoPersistida('participante-2', 4000),
            ],
          }),
        ],
      }),
    );

    await expect(
      service.reabrirAcerto('planejamento-1', 'acerto-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_ACERTO_REABRIR_OBSOLETO',
      message:
        'O acerto pago nao corresponde a uma pendencia atual do planejamento.',
    });

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.salvarAcerto).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
  });

  it('rejects invalid settlement status transitions and protects confirmed settlements', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValueOnce(
      criarAcertoPersistido({ status: AcertoStatus.PAGO }) as never,
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValueOnce(
      criarAcertoPersistido({ status: AcertoStatus.CANCELADO }) as never,
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValueOnce(
      criarAcertoPersistido({ status: AcertoStatus.CONFIRMADO }) as never,
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValueOnce(
      criarAcertoPersistido({ status: AcertoStatus.CANCELADO }) as never,
    );

    await expect(
      service.pagarAcerto('planejamento-1', 'acerto-1', 'user-1'),
    ).rejects.toBeInstanceOf(ValidationAppException);
    await expect(
      service.cancelarAcerto('planejamento-1', 'acerto-1', 'user-1'),
    ).rejects.toBeInstanceOf(ValidationAppException);
    await expect(
      service.cancelarAcerto('planejamento-1', 'acerto-1', 'user-1'),
    ).rejects.toBeInstanceOf(ValidationAppException);
    await expect(
      service.reabrirAcerto('planejamento-1', 'acerto-1', 'user-1'),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(repository.salvarAcerto).not.toHaveBeenCalled();
  });

  it.each([
    AcertoStatus.PENDENTE,
    AcertoStatus.CANCELADO,
    AcertoStatus.CONFIRMADO,
  ])('rejects reopening a settlement with status %s', async (status) => {
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValue(
      criarEntidadeAcertoPersistido({ status }),
    );

    await expect(
      service.reabrirAcerto('planejamento-1', 'acerto-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_ACERTO_REABRIR_STATUS_INVALIDO',
      message: 'Apenas acertos pagos podem ser reabertos.',
    });

    expect(repository.buscarComGastosDivisoesAcertos).not.toHaveBeenCalled();
    expect(repository.salvarAcerto).not.toHaveBeenCalled();
    expect(logsService.logEntityEventTransactional).not.toHaveBeenCalled();
  });

  it('propagates transactional audit failures after reopening so the transaction can roll back', async () => {
    const acertoPago = criarEntidadeAcertoPersistido({
      status: AcertoStatus.PAGO,
      dataPagamento: new Date('2026-07-04T00:00:00.000Z'),
    });
    const acertoReaberto = criarEntidadeAcertoPersistido({
      ...acertoPago,
      status: AcertoStatus.PENDENTE,
      dataPagamento: null,
    });
    const agregado = criarPlanejamentoComParticipantes({
      acertos: [acertoPago],
      gastos: [criarGastoComPendencia()],
    });
    const erroAuditoria = new Error('falha na auditoria transacional');
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValue(acertoPago);
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(agregado);
    repository.salvarAcerto.mockResolvedValue(acertoReaberto);
    logsService.logEntityEventTransactional.mockRejectedValue(erroAuditoria);

    await expect(
      service.reabrirAcerto('planejamento-1', 'acerto-1', 'user-1'),
    ).rejects.toBe(erroAuditoria);

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.salvarAcerto).toHaveBeenCalledWith(
      expect.objectContaining({
        id: acertoPago.id,
        status: AcertoStatus.PENDENTE,
        dataPagamento: null,
      }),
    );
    expect(logsService.logEntityEventTransactional).toHaveBeenCalledTimes(1);
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
    const planejamentoDoProprietario = {
      id: 'planejamento-1',
      status: PlanejamentoStatus.ABERTO,
      usuarioCriadorId: 'user-1',
    } as never;
    repositoryTransacional = {
      ...repository,
      buscarAcessivelComParticipantes: jest.fn(),
      bloquearPlanejamentoParaAtualizacao: jest.fn(),
      buscarParticipanteAtivoDuplicado: jest.fn(),
      salvarParticipante: jest.fn(),
    };
    repositoryTransacional.buscarAcessivelComParticipantes.mockResolvedValue(
      planejamentoDoProprietario,
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      planejamentoDoProprietario,
    );
    repositoryTransacional.buscarParticipanteAtivoDuplicado.mockResolvedValue(
      null,
    );
    repositoryTransacional.salvarParticipante.mockResolvedValue({
      id: 'participante-1',
    } as never);

    const result = await service.addParticipante('planejamento-1', 'user-1', {
      nome: 'Bruno',
      email: 'bruno@example.com',
    });

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repositoryTransacional.salvarParticipante).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'bruno@example.com',
        nome: 'Bruno',
        planejamentoId: 'planejamento-1',
        status: ParticipanteStatus.ATIVO,
        tipo: ParticipanteTipo.MANUAL,
        usuarioId: null,
      }),
    );
    expect(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[1],
    );
    expect(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[1],
    ).toBeLessThan(
      repositoryTransacional.buscarParticipanteAtivoDuplicado.mock
        .invocationCallOrder[0],
    );
    expect(
      repositoryTransacional.buscarParticipanteAtivoDuplicado.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.salvarParticipante.mock.invocationCallOrder[0],
    );
    expect(repository.buscarAcessivelComParticipantes).not.toHaveBeenCalled();
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.buscarParticipanteAtivoDuplicado).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'participante-1' });
  });

  it('adds a linked participant when usuarioId is provided', async () => {
    const planejamentoDoProprietario = {
      id: 'planejamento-1',
      status: PlanejamentoStatus.ABERTO,
      usuarioCriadorId: 'user-1',
    } as never;
    repositoryTransacional = {
      ...repository,
      buscarAcessivelComParticipantes: jest.fn(),
      bloquearPlanejamentoParaAtualizacao: jest.fn(),
      buscarParticipanteAtivoDuplicado: jest.fn(),
      salvarParticipante: jest.fn(),
    };
    repositoryTransacional.buscarAcessivelComParticipantes.mockResolvedValue(
      planejamentoDoProprietario,
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      planejamentoDoProprietario,
    );
    repositoryTransacional.buscarParticipanteAtivoDuplicado.mockResolvedValue(
      null,
    );
    repositoryTransacional.salvarParticipante.mockResolvedValue({
      id: 'participante-1',
    } as never);

    await service.addParticipante('planejamento-1', 'user-1', {
      nome: 'Carla',
      usuarioId: 'user-2',
    });

    expect(repositoryTransacional.salvarParticipante).toHaveBeenCalledWith(
      expect.objectContaining({
        email: null,
        nome: 'Carla',
        tipo: ParticipanteTipo.VINCULADO,
        usuarioId: 'user-2',
      }),
    );
    expect(repository.buscarAcessivelComParticipantes).not.toHaveBeenCalled();
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.buscarParticipanteAtivoDuplicado).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });

  it('rejects participant creation without access before acquiring the lock', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(null);

    await expect(
      service.addParticipante('planejamento-1', 'user-1', {
        nome: 'Bruno',
      }),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_NOT_FOUND',
      statusCode: 404,
    });

    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.buscarParticipanteAtivoDuplicado).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });

  it('rejects accessible non-owner before acquiring the lock', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue({
      id: 'planejamento-1',
      usuarioCriadorId: 'owner-1',
    } as never);

    await expect(
      service.addParticipante('planejamento-1', 'user-1', {
        nome: 'Bruno',
      }),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_OWNER_REQUIRED',
      statusCode: 403,
    });

    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.buscarParticipanteAtivoDuplicado).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });

  it('returns not found when planejamento disappears while locking participant creation', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue({
      id: 'planejamento-1',
      status: PlanejamentoStatus.ABERTO,
      usuarioCriadorId: 'user-1',
    } as never);
    repository.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(null);

    await expect(
      service.addParticipante('planejamento-1', 'user-1', {
        nome: 'Bruno',
      }),
    ).rejects.toMatchObject({ code: 'PLANEJAMENTO_NOT_FOUND' });

    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledTimes(1);
    expect(repository.buscarParticipanteAtivoDuplicado).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });

  it('revalidates planejamento ownership after acquiring the participant creation lock', async () => {
    const planejamentoInicial = {
      id: 'planejamento-1',
      usuarioCriadorId: 'user-1',
    } as never;
    const planejamentoComProprietarioAlterado = {
      id: 'planejamento-1',
      usuarioCriadorId: 'owner-alterado',
    } as never;
    repositoryTransacional = {
      ...repository,
      buscarAcessivelComParticipantes: jest.fn(),
      bloquearPlanejamentoParaAtualizacao: jest.fn(),
      buscarParticipanteAtivoDuplicado: jest.fn(),
      salvarParticipante: jest.fn(),
    };
    repositoryTransacional.buscarAcessivelComParticipantes
      .mockResolvedValueOnce(planejamentoInicial)
      .mockResolvedValueOnce(planejamentoComProprietarioAlterado);
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      planejamentoInicial,
    );

    await expect(
      service.addParticipante('planejamento-1', 'user-1', {
        nome: 'Bruno',
      }),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_OWNER_REQUIRED',
      statusCode: 403,
    });

    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao,
    ).toHaveBeenCalledWith('planejamento-1');
    expect(
      repositoryTransacional.buscarAcessivelComParticipantes,
    ).toHaveBeenCalledTimes(2);
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repositoryTransacional.buscarAcessivelComParticipantes.mock
        .invocationCallOrder[1],
    );
    expect(
      repositoryTransacional.buscarParticipanteAtivoDuplicado,
    ).not.toHaveBeenCalled();
    expect(repositoryTransacional.salvarParticipante).not.toHaveBeenCalled();
    expect(repository.buscarAcessivelComParticipantes).not.toHaveBeenCalled();
    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.buscarParticipanteAtivoDuplicado).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });

  it('rejects duplicated active participants only after acquiring the lock', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue({
      id: 'planejamento-1',
      status: PlanejamentoStatus.ABERTO,
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
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_PARTICIPANTE_DUPLICADO',
      statusCode: 409,
    });

    expect(
      repository.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[1],
    );
    expect(
      repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[1],
    ).toBeLessThan(
      repository.buscarParticipanteAtivoDuplicado.mock.invocationCallOrder[0],
    );
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });

  it('propagates planejamento lock failures without checking duplicates', async () => {
    const erroLock = new Error('falha ao adquirir lock do planejamento');
    repository.buscarAcessivelComParticipantes.mockResolvedValue({
      id: 'planejamento-1',
      usuarioCriadorId: 'user-1',
    } as never);
    repository.bloquearPlanejamentoParaAtualizacao.mockRejectedValue(erroLock);

    await expect(
      service.addParticipante('planejamento-1', 'user-1', {
        nome: 'Bruno',
      }),
    ).rejects.toBe(erroLock);

    expect(repository.buscarParticipanteAtivoDuplicado).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });

  it('propagates participant persistence failures from the transaction', async () => {
    const erroPersistencia = new Error('falha ao salvar participante');
    repository.buscarAcessivelComParticipantes.mockResolvedValue({
      id: 'planejamento-1',
      status: PlanejamentoStatus.ABERTO,
      usuarioCriadorId: 'user-1',
    } as never);
    repository.buscarParticipanteAtivoDuplicado.mockResolvedValue(null);
    repository.salvarParticipante.mockRejectedValue(erroPersistencia);

    await expect(
      service.addParticipante('planejamento-1', 'user-1', {
        nome: 'Bruno',
      }),
    ).rejects.toBe(erroPersistencia);

    expect(repository.buscarParticipanteAtivoDuplicado).toHaveBeenCalledTimes(
      1,
    );
    expect(repository.salvarParticipante).toHaveBeenCalledTimes(1);
  });

  it('removes an active participant transactionally and reloads it after commit', async () => {
    const planejamento = criarPlanejamentoComParticipantes();
    const participanteAtivo = {
      id: 'participante-2',
      planejamentoId: 'planejamento-1',
      status: ParticipanteStatus.ATIVO,
      usuarioId: 'user-2',
    } as never;
    const participanteRemovido = {
      ...participanteAtivo,
      status: ParticipanteStatus.REMOVIDO,
    } as never;
    repository.buscarAcessivelComParticipantes.mockResolvedValue(planejamento);
    repository.buscarParticipantePorIdEPlanejamento
      .mockResolvedValueOnce(participanteAtivo)
      .mockResolvedValueOnce(participanteRemovido);
    repository.salvarParticipante.mockResolvedValue(participanteRemovido);

    const result = await service.removerParticipante(
      'planejamento-1',
      'participante-2',
      'user-1',
    );

    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledTimes(2);
    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(
      repository.buscarParticipantePorIdEPlanejamento,
    ).toHaveBeenNthCalledWith(1, 'participante-2', 'planejamento-1');
    expect(repository.salvarParticipante).toHaveBeenCalledWith({
      id: 'participante-2',
      planejamentoId: 'planejamento-1',
      status: ParticipanteStatus.REMOVIDO,
    });
    expect(repository.salvarParticipante.mock.calls[0][0]).not.toHaveProperty(
      'participantes',
    );
    expect(
      repository.bloquearPlanejamentoParaAtualizacao.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[1],
    );
    expect(
      repository.buscarAcessivelComParticipantes.mock.invocationCallOrder[1],
    ).toBeLessThan(
      repository.buscarParticipantePorIdEPlanejamento.mock
        .invocationCallOrder[0],
    );
    expect(
      repository.buscarParticipantePorIdEPlanejamento.mock
        .invocationCallOrder[0],
    ).toBeLessThan(repository.salvarParticipante.mock.invocationCallOrder[0]);
    expect(
      repository.salvarParticipante.mock.invocationCallOrder[0],
    ).toBeLessThan(
      repository.buscarParticipantePorIdEPlanejamento.mock
        .invocationCallOrder[1],
    );
    expect(repository.salvarGasto).not.toHaveBeenCalled();
    expect(repository.salvarDivisoes).not.toHaveBeenCalled();
    expect(repository.salvarAcerto).not.toHaveBeenCalled();
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(result).toBe(participanteRemovido);
  });

  it('rejects inaccessible planejamento before acquiring the participant removal lock', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(null);

    await expect(
      service.removerParticipante('planejamento-1', 'participante-2', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_NOT_FOUND',
      statusCode: 404,
    });

    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });

  it('returns planejamento not found when it disappears before the participant removal lock', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(null);

    await expect(
      service.removerParticipante('planejamento-1', 'participante-2', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_NOT_FOUND',
      statusCode: 404,
    });

    expect(repository.buscarAcessivelComParticipantes).toHaveBeenCalledTimes(1);
    expect(repository.bloquearPlanejamentoParaAtualizacao).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(
      repository.buscarParticipantePorIdEPlanejamento,
    ).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });

  it('rejects an accessible non-owner before acquiring the participant removal lock', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes({ usuarioCriadorId: 'owner-1' }),
    );

    await expect(
      service.removerParticipante('planejamento-1', 'participante-2', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_OWNER_REQUIRED',
      statusCode: 403,
    });

    expect(
      repository.bloquearPlanejamentoParaAtualizacao,
    ).not.toHaveBeenCalled();
  });

  it('revalidates owner after acquiring the participant removal lock', async () => {
    repository.buscarAcessivelComParticipantes
      .mockResolvedValueOnce(criarPlanejamentoComParticipantes())
      .mockResolvedValueOnce(
        criarPlanejamentoComParticipantes({ usuarioCriadorId: 'owner-2' }),
      );

    await expect(
      service.removerParticipante('planejamento-1', 'participante-2', 'user-1'),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_OWNER_REQUIRED',
      statusCode: 403,
    });

    expect(
      repository.buscarParticipantePorIdEPlanejamento,
    ).not.toHaveBeenCalled();
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });

  it('returns not found for an absent participant or one from another planejamento', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarParticipantePorIdEPlanejamento.mockResolvedValue(null);

    await expect(
      service.removerParticipante(
        'planejamento-1',
        'participante-de-outro-planejamento',
        'user-1',
      ),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_PARTICIPANTE_NOT_FOUND',
      statusCode: 404,
    });
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });

  it.each([ParticipanteStatus.REMOVIDO, ParticipanteStatus.PENDENTE])(
    'rejects participant removal when current status is %s',
    async (status) => {
      repository.buscarAcessivelComParticipantes.mockResolvedValue(
        criarPlanejamentoComParticipantes(),
      );
      repository.buscarParticipantePorIdEPlanejamento.mockResolvedValue({
        id: 'participante-2',
        planejamentoId: 'planejamento-1',
        status,
        usuarioId: 'user-2',
      } as never);

      await expect(
        service.removerParticipante(
          'planejamento-1',
          'participante-2',
          'user-1',
        ),
      ).rejects.toMatchObject({
        code: 'PLANEJAMENTO_PARTICIPANTE_REMOVER_STATUS_INVALIDO',
        statusCode: 422,
      });
      expect(repository.salvarParticipante).not.toHaveBeenCalled();
    },
  );

  it('does not allow removing the participant linked to the planejamento owner', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarParticipantePorIdEPlanejamento.mockResolvedValue({
      id: 'participante-owner',
      planejamentoId: 'planejamento-1',
      status: ParticipanteStatus.ATIVO,
      usuarioId: 'user-1',
    } as never);

    await expect(
      service.removerParticipante(
        'planejamento-1',
        'participante-owner',
        'user-1',
      ),
    ).rejects.toMatchObject({
      code: 'PLANEJAMENTO_PARTICIPANTE_PROPRIETARIO_NAO_REMOVIVEL',
      statusCode: 422,
    });
    expect(repository.salvarParticipante).not.toHaveBeenCalled();
  });

  it.each([
    ['lock', 'bloquearPlanejamentoParaAtualizacao'],
    ['persistence', 'salvarParticipante'],
  ] as const)(
    'propagates %s failure and does not reload the participant after transaction failure',
    async (_cenario, metodo) => {
      const erro = new Error('falha transacional');
      repository.buscarAcessivelComParticipantes.mockResolvedValue(
        criarPlanejamentoComParticipantes(),
      );
      repository.buscarParticipantePorIdEPlanejamento.mockResolvedValue({
        id: 'participante-2',
        planejamentoId: 'planejamento-1',
        status: ParticipanteStatus.ATIVO,
        usuarioId: 'user-2',
      } as never);
      repository[metodo].mockRejectedValue(erro);

      await expect(
        service.removerParticipante(
          'planejamento-1',
          'participante-2',
          'user-1',
        ),
      ).rejects.toBe(erro);

      expect(
        repository.buscarParticipantePorIdEPlanejamento,
      ).toHaveBeenCalledTimes(metodo === 'salvarParticipante' ? 1 : 0);
    },
  );

  it('serializes two unit-level removals so only one changes the participant status', async () => {
    let status = ParticipanteStatus.ATIVO;
    let fila = Promise.resolve();
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarParticipantePorIdEPlanejamento.mockImplementation(() =>
      Promise.resolve({
        id: 'participante-2',
        planejamentoId: 'planejamento-1',
        status,
        usuarioId: 'user-2',
      } as never),
    );
    repository.salvarParticipante.mockImplementation((partial) => {
      status = partial.status as ParticipanteStatus;
      return Promise.resolve({ ...partial, usuarioId: 'user-2' } as never);
    });
    repository.executarEmTransacao.mockImplementation((operacao) => {
      const execucao = fila.then(() =>
        operacao(
          repository as unknown as PlanejamentosRepository,
          entityManager,
        ),
      );
      fila = execucao.then(
        () => undefined,
        () => undefined,
      );
      return execucao;
    });

    const resultados = await Promise.allSettled([
      service.removerParticipante('planejamento-1', 'participante-2', 'user-1'),
      service.removerParticipante('planejamento-1', 'participante-2', 'user-1'),
    ]);

    expect(resultados.map((resultado) => resultado.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    const rejeitado = resultados.find(
      (resultado): resultado is PromiseRejectedResult =>
        resultado.status === 'rejected',
    );
    expect(rejeitado?.reason).toMatchObject({
      code: 'PLANEJAMENTO_PARTICIPANTE_REMOVER_STATUS_INVALIDO',
    });
    expect(repository.salvarParticipante).toHaveBeenCalledTimes(1);
    expect(status).toBe(ParticipanteStatus.REMOVIDO);
  });

  function criarPlanejamentoComParticipantes(
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id: 'planejamento-1',
      status: PlanejamentoStatus.ABERTO,
      participantes: [
        criarParticipantePersistido('participante-1'),
        criarParticipantePersistido('participante-2'),
      ],
      usuarioCriadorId: 'user-1',
      gastos: [],
      acertos: [],
      ...overrides,
    } as never;
  }

  function prepararPlanejamentoFechadoAposLock(): void {
    const planejamentoAberto = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.ABERTO,
    });
    const planejamentoFechado = criarPlanejamentoComParticipantes({
      status: PlanejamentoStatus.FECHADO,
    });

    repository.buscarAcessivelComParticipantes
      .mockResolvedValueOnce(planejamentoAberto)
      .mockResolvedValueOnce(planejamentoFechado);
    repository.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      planejamentoAberto,
    );
  }

  function criarParticipantePersistido(id: string, usuarioId?: string) {
    return {
      id,
      nome: `Participante ${id}`,
      status: ParticipanteStatus.ATIVO,
      usuarioId: usuarioId ?? id.replace('participante', 'user'),
    };
  }

  function criarParticipanteParaResumo(
    id: string,
    nome: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      ...criarParticipantePersistido(id),
      email: `${nome.toLowerCase()}@example.com`,
      nome,
      tipo:
        id === 'participante-1'
          ? ParticipanteTipo.VINCULADO
          : ParticipanteTipo.MANUAL,
      ...overrides,
    };
  }

  function criarGastoPersistido(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      id: 'gasto-1',
      deletedAt: null,
      divisoes: [],
      pagoPorParticipanteId: 'participante-1',
      planejamentoId: 'planejamento-1',
      status: GastoStatus.ATIVO,
      valorCentavos: 1000,
      ...overrides,
    };
  }

  function criarGastoComPendencia(): Record<string, unknown> {
    return criarGastoPersistido({
      pagoPorParticipanteId: 'participante-1',
      valorCentavos: 10000,
      divisoes: [
        criarDivisaoPersistida('participante-1', 5000),
        criarDivisaoPersistida('participante-2', 5000),
      ],
    });
  }

  function criarDivisaoPersistida(
    participanteId: string,
    valorDevidoCentavos: number,
  ) {
    return {
      participanteId,
      status: DivisaoStatus.ATIVA,
      valorDevidoCentavos,
    };
  }

  function criarAcertoPersistido(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      dataPagamento: null,
      id: 'acerto-1',
      deParticipanteId: 'participante-2',
      paraParticipanteId: 'participante-1',
      deParticipante: criarParticipantePersistido('participante-2', 'user-2'),
      paraParticipante: criarParticipantePersistido('participante-1', 'user-1'),
      planejamentoId: 'planejamento-1',
      observacao: null,
      status: AcertoStatus.PENDENTE,
      valorCentavos: 5000,
      ...overrides,
    };
  }

  function criarEntidadeAcertoPersistido(
    overrides: Record<string, unknown> = {},
  ): AcertoPlanejamento {
    return Object.assign(
      new AcertoPlanejamento(),
      criarAcertoPersistido(overrides),
    );
  }

  function prepararAtualizacaoGasto(
    options: {
      gastoOverrides?: Record<string, unknown>;
      planejamentoOverrides?: Record<string, unknown>;
      agregadoOverrides?: Record<string, unknown>;
    } = {},
  ) {
    const divisaoAtiva1 = {
      ...criarDivisaoPersistida('participante-1', 5000),
      id: 'divisao-ativa-1',
      gastoId: 'gasto-1',
    };
    const divisaoAtiva2 = {
      ...criarDivisaoPersistida('participante-2', 5000),
      id: 'divisao-ativa-2',
      gastoId: 'gasto-1',
    };
    const divisaoCancelada = {
      ...criarDivisaoPersistida('participante-3', 1000),
      id: 'divisao-cancelada',
      gastoId: 'gasto-1',
      status: DivisaoStatus.CANCELADA,
    };
    const gasto = criarGastoPersistido({
      descricao: 'Mercado',
      valorCentavos: 10000,
      dataGasto: '2026-07-04',
      categoria: 'Alimentacao',
      comportamento: GastoComportamento.EVENTUAL,
      observacao: 'Compra compartilhada',
      mesReferencia: '2026-07',
      ultimaAlteracaoValorEm: new Date('2026-07-01T12:00:00.000Z'),
      comprovanteUrl: 'https://example.com/comprovante.pdf',
      comprovanteNome: 'comprovante.pdf',
      requerRevisaoMensal: false,
      divisoes: [divisaoAtiva2, divisaoCancelada, divisaoAtiva1],
      ...options.gastoOverrides,
    });
    const planejamento = criarPlanejamentoComParticipantes({
      participantes: [
        criarParticipantePersistido('participante-1'),
        criarParticipantePersistido('participante-2'),
        criarParticipantePersistido('participante-3'),
      ],
      ...options.planejamentoOverrides,
    });
    const gastoCompleto = {
      ...gasto,
      descricao: 'Gasto completo apos commit',
    } as never;

    repositoryTransacional = {
      ...repository,
      buscarAcessivelComParticipantes: jest.fn(),
      bloquearPlanejamentoParaAtualizacao: jest.fn(),
      buscarComGastosDivisoesAcertos: jest.fn(),
      buscarGastoPorIdEPlanejamento: jest.fn(),
      salvarAcertos: jest.fn(),
      salvarDivisoes: jest.fn(),
      salvarGasto: jest.fn(),
    };
    repositoryTransacional.buscarAcessivelComParticipantes.mockResolvedValue(
      planejamento,
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      planejamento,
    );
    repositoryTransacional.buscarGastoPorIdEPlanejamento.mockResolvedValue(
      gasto as never,
    );
    repositoryTransacional.salvarGasto.mockImplementation((gastoParaSalvar) =>
      Promise.resolve(gastoParaSalvar as never),
    );
    repositoryTransacional.salvarDivisoes.mockResolvedValue([] as never);
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [criarAcertoPersistido()],
        gastos: [],
        ...options.agregadoOverrides,
      }),
    );
    repositoryTransacional.salvarAcertos.mockResolvedValue([]);
    repository.buscarGastoPorIdEPlanejamento.mockResolvedValue(gastoCompleto);

    return {
      divisaoAtiva1,
      divisaoAtiva2,
      divisaoCancelada,
      gasto,
      gastoCompleto,
      planejamento,
    };
  }
});
