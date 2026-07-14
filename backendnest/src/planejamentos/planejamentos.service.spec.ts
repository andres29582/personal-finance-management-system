import {
  ForbiddenResourceException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
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
    | 'executarEmTransacao'
    | 'listarAcessiveisPorUsuario'
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
      executarEmTransacao: jest.fn(),
      listarAcessiveisPorUsuario: jest.fn(),
      listarGastosPorPlanejamento: jest.fn(),
      salvarAcerto: jest.fn(),
      salvarAcertos: jest.fn(),
      salvarDivisoes: jest.fn(),
      salvarGasto: jest.fn(),
      salvarParticipante: jest.fn(),
      salvarPlanejamento: jest.fn(),
    };
    repositoryTransacional = repository;
    repository.executarEmTransacao.mockImplementation((operacao) =>
      operacao(repositoryTransacional as unknown as PlanejamentosRepository),
    );
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );

    service = new PlanejamentosService(
      repository as unknown as PlanejamentosRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('creates a shared expense for users with planejamento access using equal split', async () => {
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

    const result = await service.createGasto('planejamento-1', 'user-1', {
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
    ).toHaveBeenNthCalledWith(1, 'planejamento-1', 'user-1');
    expect(
      repositoryTransacional.bloquearPlanejamentoParaAtualizacao,
    ).toHaveBeenCalledWith('planejamento-1');
    expect(
      repositoryTransacional.buscarAcessivelComParticipantes,
    ).toHaveBeenNthCalledWith(2, 'planejamento-1', 'user-1');
    expect(
      repositoryTransacional.buscarComGastosDivisoesAcertos,
    ).toHaveBeenCalledWith('planejamento-1', 'user-1');
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
    expect(result.id).toBe('gasto-1');
  });

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

  it('returns an empty settlement list when planejamento has no expenses', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        gastos: [],
      }),
    );

    const result = await service.findAcertos('planejamento-1', 'user-1');

    expect(repository.buscarComGastosDivisoesAcertos).toHaveBeenCalledWith(
      'planejamento-1',
      'user-1',
    );
    expect(result).toEqual([]);
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

    const result = await service.findAcertos('planejamento-1', 'user-1');

    expect(result).toEqual([
      expect.objectContaining({
        devedorParticipanteId: 'participante-2',
        recebedorParticipanteId: 'participante-1',
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

    const result = await service.findAcertos('planejamento-1', 'user-2');

    expect(repository.buscarComGastosDivisoesAcertos).toHaveBeenCalledWith(
      'planejamento-1',
      'user-2',
    );
    expect(result).toHaveLength(1);
  });

  it('does not calculate settlements when user has no planejamento access', async () => {
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(null);

    await expect(
      service.findAcertos('planejamento-1', 'user-3'),
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

    const result = await service.findAcertos('planejamento-1', 'user-1');

    expect(result).toEqual([
      expect.objectContaining({
        devedorParticipanteId: 'participante-2',
        recebedorParticipanteId: 'participante-1',
        valorCentavos: 2000,
      }),
      expect.objectContaining({
        devedorParticipanteId: 'participante-3',
        recebedorParticipanteId: 'participante-1',
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
      service.findAcertos('planejamento-1', 'user-1'),
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

    await service.findAcertos('planejamento-1', 'user-1');

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

  it('keeps settlement synchronization idempotent when pending suggestion already exists', async () => {
    const acertoPendente = criarAcertoPersistido({
      deParticipanteId: 'participante-2',
      paraParticipanteId: 'participante-1',
      valorCentavos: 5000,
    });
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
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

  it('allows owner to mark a pending settlement as paid', async () => {
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
      criarPlanejamentoComParticipantes(),
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repositoryTransacional.buscarAcertoPorIdEPlanejamento.mockResolvedValue(
      acertoPendente,
    );
    repositoryTransacional.salvarAcerto.mockResolvedValue(acertoPago);
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
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

  it('cancels a paid settlement and recreates the corresponding pending settlement in one transaction', async () => {
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
      criarPlanejamentoComParticipantes(),
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repositoryTransacional.buscarAcertoPorIdEPlanejamento.mockResolvedValue(
      acertoPago,
    );
    repositoryTransacional.salvarAcerto.mockResolvedValue(acertoCancelado);
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
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

  it('reopens a canceled settlement when an exactly equivalent current suggestion exists', async () => {
    const acertoCancelado = criarEntidadeAcertoPersistido({
      status: AcertoStatus.CANCELADO,
      dataPagamento: new Date('2026-07-04T00:00:00.000Z'),
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
      criarPlanejamentoComParticipantes(),
    );
    repositoryTransacional.bloquearPlanejamentoParaAtualizacao.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repositoryTransacional.buscarAcertoPorIdEPlanejamento.mockResolvedValue(
      acertoCancelado,
    );
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValueOnce(
      criarPlanejamentoComParticipantes({
        acertos: [acertoCancelado],
        gastos: [criarGastoComPendencia()],
      }),
    );
    repositoryTransacional.buscarComGastosDivisoesAcertos.mockResolvedValueOnce(
      criarPlanejamentoComParticipantes({
        acertos: [acertoReaberto],
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

  it('cancels an equivalent pending settlement before reopening the historical record', async () => {
    const acertoCancelado = criarEntidadeAcertoPersistido({
      id: 'acerto-historico',
      status: AcertoStatus.CANCELADO,
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
      ...acertoCancelado,
      status: AcertoStatus.PENDENTE,
      dataPagamento: null,
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValue(
      acertoCancelado,
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValueOnce(
      criarPlanejamentoComParticipantes({
        acertos: [acertoCancelado, pendenteEquivalente],
        gastos: [criarGastoComPendencia()],
      }),
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValueOnce(
      criarPlanejamentoComParticipantes({
        acertos: [acertoReaberto, pendenteCancelado],
        gastos: [criarGastoComPendencia()],
      }),
    );
    repository.salvarAcerto
      .mockResolvedValueOnce(pendenteCancelado)
      .mockResolvedValueOnce(acertoReaberto);

    const result = await service.reabrirAcerto(
      'planejamento-1',
      'acerto-historico',
      'user-1',
    );

    expect(repository.salvarAcerto).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: 'acerto-pendente-atual',
        status: AcertoStatus.CANCELADO,
        dataPagamento: null,
      }),
    );
    expect(repository.salvarAcerto).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 'acerto-historico',
        status: AcertoStatus.PENDENTE,
        dataPagamento: null,
      }),
    );
    expect(repository.salvarAcerto.mock.invocationCallOrder[0]).toBeLessThan(
      repository.salvarAcerto.mock.invocationCallOrder[1],
    );
    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(result).toBe(acertoReaberto);
    expect(result.status).toBe(AcertoStatus.PENDENTE);
  });

  it('rejects reopening a canceled settlement that is obsolete for the current financial suggestions', async () => {
    const acertoCancelado = criarEntidadeAcertoPersistido({
      status: AcertoStatus.CANCELADO,
    });
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.buscarAcertoPorIdEPlanejamento.mockResolvedValue(
      acertoCancelado,
    );
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(
      criarPlanejamentoComParticipantes({
        acertos: [acertoCancelado],
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
        'O acerto cancelado nao corresponde a uma pendencia atual do planejamento.',
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
      criarAcertoPersistido({ status: AcertoStatus.PAGO }) as never,
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

  function criarPlanejamentoComParticipantes(
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id: 'planejamento-1',
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

  function criarParticipantePersistido(id: string, usuarioId?: string) {
    return {
      id,
      status: ParticipanteStatus.ATIVO,
      usuarioId: usuarioId ?? id.replace('participante', 'user'),
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
      id: 'acerto-1',
      deParticipanteId: 'participante-2',
      paraParticipanteId: 'participante-1',
      deParticipante: criarParticipantePersistido('participante-2', 'user-2'),
      paraParticipante: criarParticipantePersistido('participante-1', 'user-1'),
      planejamentoId: 'planejamento-1',
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
});
