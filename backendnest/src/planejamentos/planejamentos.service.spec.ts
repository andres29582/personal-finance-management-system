import {
  AppConflictException,
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
import { PlanejamentosRepository } from './planejamentos.repository';
import { PlanejamentosService } from './planejamentos.service';

describe('PlanejamentosService', () => {
  let service: PlanejamentosService;
  let repository: jest.Mocked<
    Pick<
      PlanejamentosRepository,
      | 'buscarAcessivelComParticipantes'
      | 'buscarComGastosDivisoesAcertos'
      | 'buscarGastoPorIdEPlanejamento'
      | 'buscarParticipanteAtivoDuplicado'
      | 'buscarParticipanteAtivoPorUsuario'
      | 'executarEmTransacao'
      | 'listarAcessiveisPorUsuario'
      | 'listarGastosPorPlanejamento'
      | 'salvarAcertos'
      | 'salvarDivisoes'
      | 'salvarGasto'
      | 'salvarParticipante'
      | 'salvarPlanejamento'
    >
  >;

  beforeEach(() => {
    repository = {
      buscarAcessivelComParticipantes: jest.fn(),
      buscarComGastosDivisoesAcertos: jest.fn(),
      buscarGastoPorIdEPlanejamento: jest.fn(),
      buscarParticipanteAtivoDuplicado: jest.fn(),
      buscarParticipanteAtivoPorUsuario: jest.fn(),
      executarEmTransacao: jest.fn(),
      listarAcessiveisPorUsuario: jest.fn(),
      listarGastosPorPlanejamento: jest.fn(),
      salvarAcertos: jest.fn(),
      salvarDivisoes: jest.fn(),
      salvarGasto: jest.fn(),
      salvarParticipante: jest.fn(),
      salvarPlanejamento: jest.fn(),
    };
    repository.executarEmTransacao.mockImplementation((operacao) =>
      operacao(repository as unknown as PlanejamentosRepository),
    );

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

  it('creates a shared expense for users with planejamento access using equal split', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(
      criarPlanejamentoComParticipantes(),
    );
    repository.salvarGasto.mockResolvedValue({
      id: 'gasto-1',
    } as never);
    repository.salvarDivisoes.mockResolvedValue([] as never);
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

    expect(repository.salvarGasto).toHaveBeenCalledWith(
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
    expect(repository.salvarDivisoes).toHaveBeenCalledWith([
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
    expect(result.id).toBe('gasto-1');
  });

  it('rejects shared expense creation when user has no planejamento access', async () => {
    repository.buscarAcessivelComParticipantes.mockResolvedValue(null);

    await expect(
      service.createGasto('planejamento-1', 'user-3', {
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-04',
        descricao: 'Mercado',
        pagoPorParticipanteId: 'participante-1',
        participantesIds: ['participante-1'],
        valorCentavos: 1000,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);

    expect(repository.salvarGasto).not.toHaveBeenCalled();
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

    expect(repository.salvarGasto).not.toHaveBeenCalled();
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

    expect(repository.salvarGasto).not.toHaveBeenCalled();
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

    expect(repository.salvarGasto).not.toHaveBeenCalled();
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
    repository.salvarAcertos.mockResolvedValue([
      criarAcertoPersistido({
        deParticipanteId: 'participante-2',
        paraParticipanteId: 'participante-1',
        valorCentavos: 5000,
      }),
    ] as never);

    const result = await service.sincronizarAcertos('planejamento-1', 'user-1');

    expect(repository.salvarAcertos).toHaveBeenCalledWith([
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
    expect(repository.executarEmTransacao).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({
        status: AcertoStatus.PENDENTE,
        valorCentavos: 5000,
      }),
    ]);
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
    expect(repository.executarEmTransacao).not.toHaveBeenCalled();
    expect(result).toEqual([acertoPendente]);
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
    repository.buscarComGastosDivisoesAcertos.mockResolvedValue(null);

    await expect(
      service.sincronizarAcertos('planejamento-1', 'user-3'),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);

    expect(repository.salvarAcertos).not.toHaveBeenCalled();
    expect(repository.executarEmTransacao).not.toHaveBeenCalled();
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

  function criarParticipantePersistido(id: string) {
    return {
      id,
      status: ParticipanteStatus.ATIVO,
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
      planejamentoId: 'planejamento-1',
      status: AcertoStatus.PENDENTE,
      valorCentavos: 5000,
      ...overrides,
    };
  }
});
