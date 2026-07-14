import { DataSource, Repository } from 'typeorm';
import { AcertoPlanejamento } from './entities/acerto-planejamento.entity';
import { DivisaoGasto } from './entities/divisao-gasto.entity';
import { GastoPlanejamento } from './entities/gasto-planejamento.entity';
import { ParticipantePlanejamento } from './entities/participante-planejamento.entity';
import { Planejamento } from './entities/planejamento.entity';
import { ParticipanteStatus, PlanejamentoStatus } from './enums';
import { PlanejamentosRepository } from './planejamentos.repository';

type RepositoryMock<T> = {
  findOne: jest.Mock<Promise<T | null>, [unknown]>;
  find: jest.Mock<Promise<T[]>, [unknown]>;
  save: jest.Mock<Promise<T | T[]>, [unknown]>;
};

describe('PlanejamentosRepository', () => {
  let planejamentoRepository: RepositoryMock<Planejamento>;
  let participanteRepository: RepositoryMock<ParticipantePlanejamento>;
  let gastoRepository: RepositoryMock<GastoPlanejamento>;
  let divisaoRepository: RepositoryMock<DivisaoGasto>;
  let acertoRepository: RepositoryMock<AcertoPlanejamento>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let repository: PlanejamentosRepository;

  beforeEach(() => {
    planejamentoRepository = criarRepositoryMock<Planejamento>();
    participanteRepository = criarRepositoryMock<ParticipantePlanejamento>();
    gastoRepository = criarRepositoryMock<GastoPlanejamento>();
    divisaoRepository = criarRepositoryMock<DivisaoGasto>();
    acertoRepository = criarRepositoryMock<AcertoPlanejamento>();
    dataSource = {
      transaction: jest.fn(),
    };

    repository = new PlanejamentosRepository(
      comoRepositoryTypeOrm(planejamentoRepository),
      comoRepositoryTypeOrm(participanteRepository),
      comoRepositoryTypeOrm(gastoRepository),
      comoRepositoryTypeOrm(divisaoRepository),
      comoRepositoryTypeOrm(acertoRepository),
      dataSource as unknown as DataSource,
    );
  });

  it('executa operacoes compostas em transacao usando repositories do manager', async () => {
    const managerPlanejamentoRepository = criarRepositoryMock<Planejamento>();
    const managerParticipanteRepository =
      criarRepositoryMock<ParticipantePlanejamento>();
    const managerGastoRepository = criarRepositoryMock<GastoPlanejamento>();
    const managerDivisaoRepository = criarRepositoryMock<DivisaoGasto>();
    const managerAcertoRepository = criarRepositoryMock<AcertoPlanejamento>();
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Planejamento) {
          return comoRepositoryTypeOrm(managerPlanejamentoRepository);
        }

        if (entity === ParticipantePlanejamento) {
          return comoRepositoryTypeOrm(managerParticipanteRepository);
        }

        if (entity === GastoPlanejamento) {
          return comoRepositoryTypeOrm(managerGastoRepository);
        }

        if (entity === DivisaoGasto) {
          return comoRepositoryTypeOrm(managerDivisaoRepository);
        }

        return comoRepositoryTypeOrm(managerAcertoRepository);
      }),
    };
    dataSource.transaction.mockImplementation(
      (callback: (entityManager: typeof manager) => Promise<Planejamento>) =>
        callback(manager),
    );
    managerPlanejamentoRepository.save.mockResolvedValue({
      id: 'planejamento-transacao',
    } as Planejamento);

    const result = await repository.executarEmTransacao((transacional) =>
      transacional.salvarPlanejamento({ id: 'planejamento-transacao' }),
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.getRepository).toHaveBeenCalledWith(Planejamento);
    expect(managerPlanejamentoRepository.save).toHaveBeenCalledWith({
      id: 'planejamento-transacao',
    });
    expect(result).toEqual({ id: 'planejamento-transacao' });
  });

  it('usa o repository de planejamento do manager para adquirir o lock', async () => {
    const managerPlanejamentoRepository = criarRepositoryMock<Planejamento>();
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Planejamento) {
          return comoRepositoryTypeOrm(managerPlanejamentoRepository);
        }

        return comoRepositoryTypeOrm(criarRepositoryMock());
      }),
    };
    const planejamento = Object.assign(new Planejamento(), {
      id: 'planejamento-transacao',
    });
    dataSource.transaction.mockImplementation(
      (
        callback: (
          entityManager: typeof manager,
        ) => Promise<Planejamento | null>,
      ) => callback(manager),
    );
    managerPlanejamentoRepository.findOne.mockResolvedValue(planejamento);

    const result = await repository.executarEmTransacao((transacional) =>
      transacional.bloquearPlanejamentoParaAtualizacao(
        'planejamento-transacao',
      ),
    );

    expect(managerPlanejamentoRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        lock: { mode: 'pessimistic_write' },
      }),
    );
    expect(planejamentoRepository.findOne).not.toHaveBeenCalled();
    expect(result).toBe(planejamento);
  });

  it('busca planejamento por id sempre com usuario criador e sem removidos logicamente', async () => {
    planejamentoRepository.findOne.mockResolvedValue(null);

    await repository.buscarPorIdEUsuarioCriador(
      'planejamento-id',
      'usuario-id',
    );

    const where = obterWhereDaPrimeiraChamada(planejamentoRepository.findOne);

    expect(where.id).toBe('planejamento-id');
    expect(where.usuarioCriadorId).toBe('usuario-id');
    expect(where.deletedAt).toBeDefined();
  });

  it('lista planejamentos por usuario criador com escopo do MVP', async () => {
    planejamentoRepository.find.mockResolvedValue([]);

    await repository.listarPorUsuarioCriador('usuario-id');

    const argumento = obterObjetoDaPrimeiraChamada(planejamentoRepository.find);
    const where = obterObjeto(argumento.where);

    expect(where.usuarioCriadorId).toBe('usuario-id');
    expect(where.deletedAt).toBeDefined();
    expect(argumento.order).toEqual({ createdAt: 'DESC' });
  });

  it('lista planejamentos acessiveis por usuario criador ou participante ativo', async () => {
    planejamentoRepository.find.mockResolvedValue([]);

    await repository.listarAcessiveisPorUsuario('usuario-id', {
      status: PlanejamentoStatus.ABERTO,
    });

    const argumento = obterObjetoDaPrimeiraChamada(planejamentoRepository.find);
    const where = argumento.where as Record<string, unknown>[];
    const participantes = obterObjeto(where[1].participantes);

    expect(where).toHaveLength(2);
    expect(where[0]).toEqual(
      expect.objectContaining({
        status: PlanejamentoStatus.ABERTO,
        usuarioCriadorId: 'usuario-id',
      }),
    );
    expect(participantes).toEqual(
      expect.objectContaining({
        status: ParticipanteStatus.ATIVO,
        usuarioId: 'usuario-id',
      }),
    );
    expect(argumento.relations).toEqual({
      participantes: true,
    });
    expect(argumento.order).toEqual({ createdAt: 'DESC' });
  });

  it('busca planejamento com participantes mantendo escopo por usuario criador', async () => {
    planejamentoRepository.findOne.mockResolvedValue(null);

    await repository.buscarComParticipantes('planejamento-id', 'usuario-id');

    const argumento = obterObjetoDaPrimeiraChamada(
      planejamentoRepository.findOne,
    );
    const where = obterObjeto(argumento.where);

    expect(where.id).toBe('planejamento-id');
    expect(where.usuarioCriadorId).toBe('usuario-id');
    expect(argumento.relations).toEqual({
      participantes: true,
    });
  });

  it('busca planejamento acessivel por usuario criador ou participante ativo', async () => {
    planejamentoRepository.findOne.mockResolvedValue(null);

    await repository.buscarAcessivelComParticipantes(
      'planejamento-id',
      'usuario-id',
    );

    const argumento = obterObjetoDaPrimeiraChamada(
      planejamentoRepository.findOne,
    );
    const where = argumento.where as Record<string, unknown>[];
    const participantes = obterObjeto(where[1].participantes);

    expect(where).toHaveLength(2);
    expect(where[0]).toEqual(
      expect.objectContaining({
        id: 'planejamento-id',
        usuarioCriadorId: 'usuario-id',
      }),
    );
    expect(participantes).toEqual(
      expect.objectContaining({
        status: ParticipanteStatus.ATIVO,
        usuarioId: 'usuario-id',
      }),
    );
    expect(argumento.relations).toEqual({
      participantes: true,
    });
  });

  it('bloqueia somente o planejamento ativo solicitado para atualizacao', async () => {
    const planejamento = Object.assign(new Planejamento(), {
      id: 'planejamento-id',
    });
    planejamentoRepository.findOne
      .mockResolvedValueOnce(planejamento)
      .mockResolvedValueOnce(null);

    await expect(
      repository.bloquearPlanejamentoParaAtualizacao('planejamento-id'),
    ).resolves.toBe(planejamento);
    await expect(
      repository.bloquearPlanejamentoParaAtualizacao('planejamento-ausente'),
    ).resolves.toBeNull();

    const argumento = obterObjetoDaPrimeiraChamada(
      planejamentoRepository.findOne,
    );
    const where = obterObjeto(argumento.where);
    const lock = obterObjeto(argumento.lock);

    expect(where.id).toBe('planejamento-id');
    expect(where.deletedAt).toBeDefined();
    expect(lock.mode).toBe('pessimistic_write');
    expect(argumento.relations).toBeUndefined();
  });

  it('busca planejamento com gastos, pagadores, divisoes e acertos mantendo escopo por usuario criador', async () => {
    planejamentoRepository.findOne.mockResolvedValue(null);

    await repository.buscarComGastosDivisoesAcertos(
      'planejamento-id',
      'usuario-id',
    );

    const argumento = obterObjetoDaPrimeiraChamada(
      planejamentoRepository.findOne,
    );
    const where = argumento.where as Record<string, unknown>[];
    const participantes = obterObjeto(where[1].participantes);

    expect(where).toHaveLength(2);
    expect(where[0]).toEqual(
      expect.objectContaining({
        id: 'planejamento-id',
        usuarioCriadorId: 'usuario-id',
      }),
    );
    expect(participantes).toEqual(
      expect.objectContaining({
        status: ParticipanteStatus.ATIVO,
        usuarioId: 'usuario-id',
      }),
    );
    expect(argumento.relations).toEqual({
      participantes: true,
      gastos: {
        divisoes: true,
        pagoPorParticipante: true,
      },
      acertos: {
        deParticipante: true,
        paraParticipante: true,
      },
    });
  });

  it('busca participante ativo por usuario no planejamento', async () => {
    participanteRepository.findOne.mockResolvedValue(null);

    await repository.buscarParticipanteAtivoPorUsuario(
      'planejamento-id',
      'usuario-id',
    );

    const where = obterWhereDaPrimeiraChamada(participanteRepository.findOne);

    expect(where).toEqual({
      planejamentoId: 'planejamento-id',
      status: ParticipanteStatus.ATIVO,
      usuarioId: 'usuario-id',
    });
  });

  it('busca participante ativo duplicado por usuario e email', async () => {
    participanteRepository.findOne.mockResolvedValue(null);

    await repository.buscarParticipanteAtivoDuplicado('planejamento-id', {
      email: 'bruno@example.com',
      nome: 'Bruno',
      usuarioId: 'usuario-id',
    });

    const argumento = obterObjetoDaPrimeiraChamada(
      participanteRepository.findOne,
    );
    const where = argumento.where as Record<string, unknown>[];

    expect(where).toEqual([
      {
        planejamentoId: 'planejamento-id',
        status: ParticipanteStatus.ATIVO,
        usuarioId: 'usuario-id',
      },
      {
        email: 'bruno@example.com',
        planejamentoId: 'planejamento-id',
        status: ParticipanteStatus.ATIVO,
      },
    ]);
  });

  it('busca participante ativo duplicado por nome quando nao ha usuario ou email', async () => {
    participanteRepository.findOne.mockResolvedValue(null);

    await repository.buscarParticipanteAtivoDuplicado('planejamento-id', {
      nome: 'Bruno',
    });

    const argumento = obterObjetoDaPrimeiraChamada(
      participanteRepository.findOne,
    );
    const where = argumento.where as Record<string, unknown>[];

    expect(where).toEqual([
      {
        nome: 'Bruno',
        planejamentoId: 'planejamento-id',
        status: ParticipanteStatus.ATIVO,
      },
    ]);
  });

  it('lista gastos nao removidos de um planejamento com divisoes e pagador', async () => {
    gastoRepository.find.mockResolvedValue([]);

    await repository.listarGastosPorPlanejamento('planejamento-id');

    const argumento = obterObjetoDaPrimeiraChamada(gastoRepository.find);
    const where = obterObjeto(argumento.where);

    expect(where.planejamentoId).toBe('planejamento-id');
    expect(where.deletedAt).toBeDefined();
    expect(argumento.relations).toEqual({
      divisoes: true,
      pagoPorParticipante: true,
    });
    expect(argumento.order).toEqual({
      createdAt: 'DESC',
      dataGasto: 'DESC',
    });
  });

  it('busca gasto por id e planejamento com divisoes e pagador', async () => {
    gastoRepository.findOne.mockResolvedValue(null);

    await repository.buscarGastoPorIdEPlanejamento(
      'gasto-id',
      'planejamento-id',
    );

    const argumento = obterObjetoDaPrimeiraChamada(gastoRepository.findOne);
    const where = obterObjeto(argumento.where);

    expect(where.id).toBe('gasto-id');
    expect(where.planejamentoId).toBe('planejamento-id');
    expect(where.deletedAt).toBeDefined();
    expect(argumento.relations).toEqual({
      divisoes: true,
      pagoPorParticipante: true,
    });
  });

  it('busca acerto por id dentro do planejamento com participantes envolvidos', async () => {
    acertoRepository.findOne.mockResolvedValue(null);

    await repository.buscarAcertoPorIdEPlanejamento(
      'acerto-id',
      'planejamento-id',
    );

    const argumento = obterObjetoDaPrimeiraChamada(acertoRepository.findOne);
    const where = obterObjeto(argumento.where);

    expect(where.id).toBe('acerto-id');
    expect(where.planejamentoId).toBe('planejamento-id');
    expect(argumento.relations).toEqual({
      deParticipante: true,
      paraParticipante: true,
    });
  });

  it('delegar salvamentos aos repositories TypeORM sem aplicar calculo financeiro', async () => {
    const planejamento = { id: 'planejamento-id' } as Planejamento;
    const participante = { id: 'participante-id' } as ParticipantePlanejamento;
    const gasto = { id: 'gasto-id' } as GastoPlanejamento;
    const divisoes = [{ id: 'divisao-id' }] as DivisaoGasto[];
    const acertos = [{ id: 'acerto-id' }] as AcertoPlanejamento[];

    planejamentoRepository.save.mockResolvedValue(planejamento);
    participanteRepository.save.mockResolvedValue(participante);
    gastoRepository.save.mockResolvedValue(gasto);
    divisaoRepository.save.mockResolvedValue(divisoes);
    acertoRepository.save
      .mockResolvedValueOnce(acertos)
      .mockResolvedValueOnce(acertos[0]);

    await expect(repository.salvarPlanejamento(planejamento)).resolves.toBe(
      planejamento,
    );
    await expect(repository.salvarParticipante(participante)).resolves.toBe(
      participante,
    );
    await expect(repository.salvarGasto(gasto)).resolves.toBe(gasto);
    await expect(repository.salvarDivisoes(divisoes)).resolves.toBe(divisoes);
    await expect(repository.salvarAcertos(acertos)).resolves.toBe(acertos);
    await expect(repository.salvarAcerto(acertos[0])).resolves.toBe(acertos[0]);
  });

  function criarRepositoryMock<T>(): RepositoryMock<T> {
    return {
      findOne: criarFindOneMock<T>(),
      find: criarFindMock<T>(),
      save: criarSaveMock<T>(),
    };
  }

  function criarFindOneMock<T>(): RepositoryMock<T>['findOne'] {
    return jest.fn() as unknown as RepositoryMock<T>['findOne'];
  }

  function criarFindMock<T>(): RepositoryMock<T>['find'] {
    return jest.fn() as unknown as RepositoryMock<T>['find'];
  }

  function criarSaveMock<T>(): RepositoryMock<T>['save'] {
    return jest.fn() as unknown as RepositoryMock<T>['save'];
  }

  function comoRepositoryTypeOrm<T>(
    repositoryMock: RepositoryMock<T>,
  ): Repository<T> {
    return repositoryMock as unknown as Repository<T>;
  }

  function obterWhereDaPrimeiraChamada(
    mock: jest.Mock<unknown, [unknown]>,
  ): Record<string, unknown> {
    const argumento = obterObjetoDaPrimeiraChamada(mock);
    return obterObjeto(argumento.where);
  }

  function obterObjetoDaPrimeiraChamada(
    mock: jest.Mock<unknown, [unknown]>,
  ): Record<string, unknown> {
    const chamada = mock.mock.calls[0];

    if (!chamada) {
      throw new Error('Mock nao foi chamado.');
    }

    return obterObjeto(chamada[0]);
  }

  function obterObjeto(valor: unknown): Record<string, unknown> {
    if (!valor || typeof valor !== 'object') {
      throw new Error('Era esperado um objeto.');
    }

    return valor as Record<string, unknown>;
  }
});
