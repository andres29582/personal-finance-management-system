import { Repository } from 'typeorm';
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
  let repository: PlanejamentosRepository;

  beforeEach(() => {
    planejamentoRepository = criarRepositoryMock<Planejamento>();
    participanteRepository = criarRepositoryMock<ParticipantePlanejamento>();
    gastoRepository = criarRepositoryMock<GastoPlanejamento>();
    divisaoRepository = criarRepositoryMock<DivisaoGasto>();
    acertoRepository = criarRepositoryMock<AcertoPlanejamento>();

    repository = new PlanejamentosRepository(
      comoRepositoryTypeOrm(planejamentoRepository),
      comoRepositoryTypeOrm(participanteRepository),
      comoRepositoryTypeOrm(gastoRepository),
      comoRepositoryTypeOrm(divisaoRepository),
      comoRepositoryTypeOrm(acertoRepository),
    );
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

  it('busca planejamento com gastos, divisoes e acertos mantendo escopo por usuario criador', async () => {
    planejamentoRepository.findOne.mockResolvedValue(null);

    await repository.buscarComGastosDivisoesAcertos(
      'planejamento-id',
      'usuario-id',
    );

    const argumento = obterObjetoDaPrimeiraChamada(
      planejamentoRepository.findOne,
    );
    const where = obterObjeto(argumento.where);

    expect(where.id).toBe('planejamento-id');
    expect(where.usuarioCriadorId).toBe('usuario-id');
    expect(argumento.relations).toEqual({
      participantes: true,
      gastos: {
        divisoes: true,
      },
      acertos: true,
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
    acertoRepository.save.mockResolvedValue(acertos);

    await expect(repository.salvarPlanejamento(planejamento)).resolves.toBe(
      planejamento,
    );
    await expect(repository.salvarParticipante(participante)).resolves.toBe(
      participante,
    );
    await expect(repository.salvarGasto(gasto)).resolves.toBe(gasto);
    await expect(repository.salvarDivisoes(divisoes)).resolves.toBe(divisoes);
    await expect(repository.salvarAcertos(acertos)).resolves.toBe(acertos);
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
