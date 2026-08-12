import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { Transacao } from '../../transacoes/entities/transacao.entity';
import { Transferencia } from '../../transferencias/entities/transferencia.entity';
import { Conta } from '../entities/conta.entity';
import { TipoConta } from '../enums/tipo-conta.enum';
import { ContaRepository } from './conta.repository';

type ContaTypeOrmRepositoryMock = {
  find: jest.Mock<Promise<Conta[]>, [FindManyOptions<Conta>?]>;
  findOne: jest.Mock<Promise<Conta | null>, [FindOneOptions<Conta>]>;
  findOneBy: jest.Mock<
    Promise<Conta | null>,
    [FindOptionsWhere<Conta> | FindOptionsWhere<Conta>[]]
  >;
};

describe('ContaRepository', () => {
  let contaTypeOrmRepository: ContaTypeOrmRepositoryMock;
  let managerContaRepository: ContaTypeOrmRepositoryMock;
  let getRepository: jest.Mock<Repository<Conta>, [typeof Conta]>;
  let manager: EntityManager;
  let repository: ContaRepository;

  const conta = {
    ativa: true,
    id: 'conta-1',
    nome: 'Banco',
    saldoInicial: 100,
    tipo: TipoConta.BANCO,
    usuarioId: 'user-1',
  } as Conta;

  beforeEach(() => {
    contaTypeOrmRepository = createContaTypeOrmRepositoryMock();
    managerContaRepository = createContaTypeOrmRepositoryMock();
    getRepository = jest.fn((target: typeof Conta) => {
      void target;
      return asContaRepository(managerContaRepository);
    });
    manager = { getRepository } as unknown as EntityManager;

    repository = new ContaRepository(
      asContaRepository(contaTypeOrmRepository),
      {} as Repository<Transacao>,
      {} as Repository<Transferencia>,
    );
  });

  it('uses the transactional manager repository and a pessimistic read lock for one account', async () => {
    managerContaRepository.findOne.mockResolvedValue(conta);

    await expect(
      repository.findByIdAndUserForWrite('conta-1', 'user-1', manager),
    ).resolves.toBe(conta);

    expect(getRepository).toHaveBeenCalledWith(Conta);
    expect(managerContaRepository.findOne).toHaveBeenCalledWith({
      lock: { mode: 'pessimistic_read' },
      where: { id: 'conta-1', usuarioId: 'user-1' },
    });
    expect(contaTypeOrmRepository.findOne).not.toHaveBeenCalled();
    expect(contaTypeOrmRepository.findOneBy).not.toHaveBeenCalled();
  });

  it('deduplicates and sorts ids before locking multiple accounts through the transactional manager', async () => {
    const contas = [
      conta,
      { ...conta, id: 'conta-2', nome: 'Carteira' },
    ] as Conta[];
    managerContaRepository.find.mockResolvedValue(contas);

    await expect(
      repository.findManyByIdsAndUserForWrite(
        ['conta-2', 'conta-1', 'conta-2'],
        'user-1',
        manager,
      ),
    ).resolves.toBe(contas);

    expect(getRepository).toHaveBeenCalledWith(Conta);
    expect(managerContaRepository.find).toHaveBeenCalledTimes(1);
    const options = managerContaRepository.find.mock.calls[0]?.[0];

    expect(options).toEqual(
      expect.objectContaining({
        lock: { mode: 'pessimistic_read' },
        order: { id: 'ASC' },
      }),
    );
    const where = options?.where as unknown as {
      id: { value: string[] };
      usuarioId: string;
    };
    expect(where.usuarioId).toBe('user-1');
    expect(where.id.value).toEqual(['conta-1', 'conta-2']);
    expect(contaTypeOrmRepository.find).not.toHaveBeenCalled();
  });

  it('returns immediately for an empty bulk lookup without acquiring a repository', async () => {
    await expect(
      repository.findManyByIdsAndUserForWrite([], 'user-1', manager),
    ).resolves.toEqual([]);

    expect(getRepository).not.toHaveBeenCalled();
    expect(managerContaRepository.find).not.toHaveBeenCalled();
  });

  function createContaTypeOrmRepositoryMock(): ContaTypeOrmRepositoryMock {
    return {
      find: jest.fn((options?: FindManyOptions<Conta>) => {
        void options;
        return Promise.resolve([]);
      }),
      findOne: jest.fn((options: FindOneOptions<Conta>) => {
        void options;
        return Promise.resolve(null);
      }),
      findOneBy: jest.fn(
        (where: FindOptionsWhere<Conta> | FindOptionsWhere<Conta>[]) => {
          void where;
          return Promise.resolve(null);
        },
      ),
    };
  }

  function asContaRepository(
    repositoryMock: ContaTypeOrmRepositoryMock,
  ): Repository<Conta> {
    return repositoryMock as unknown as Repository<Conta>;
  }
});
