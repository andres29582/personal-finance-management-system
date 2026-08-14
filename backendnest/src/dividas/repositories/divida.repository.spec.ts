import {
  EntityManager,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { Divida } from '../entities/divida.entity';
import { DividaRepository } from './divida.repository';

type DividaTypeOrmRepositoryMock = {
  findOne: jest.Mock<Promise<Divida | null>, [FindOneOptions<Divida>]>;
  findOneBy: jest.Mock<
    Promise<Divida | null>,
    [FindOptionsWhere<Divida> | FindOptionsWhere<Divida>[]]
  >;
};

describe('DividaRepository', () => {
  let dividaTypeOrmRepository: DividaTypeOrmRepositoryMock;
  let managerDividaRepository: DividaTypeOrmRepositoryMock;
  let getRepository: jest.Mock<Repository<Divida>, [typeof Divida]>;
  let manager: EntityManager;
  let repository: DividaRepository;

  beforeEach(() => {
    dividaTypeOrmRepository = createDividaTypeOrmRepositoryMock();
    managerDividaRepository = createDividaTypeOrmRepositoryMock();
    getRepository = jest.fn((target: typeof Divida) => {
      void target;
      return asDividaRepository(managerDividaRepository);
    });
    manager = { getRepository } as unknown as EntityManager;
    repository = new DividaRepository(
      asDividaRepository(dividaTypeOrmRepository),
    );
  });

  it.each([
    {
      description: 'returns the debt',
      result: { ativa: true, id: 'divida-1', usuarioId: 'user-1' } as Divida,
    },
    { description: 'returns null', result: null },
  ])(
    '$description through the transactional manager with a pessimistic read lock',
    async ({ result }) => {
      managerDividaRepository.findOne.mockResolvedValue(result);

      await expect(
        repository.findByIdAndUserForWrite('divida-1', 'user-1', manager),
      ).resolves.toBe(result);

      expect(getRepository).toHaveBeenCalledWith(Divida);
      expect(managerDividaRepository.findOne).toHaveBeenCalledWith({
        lock: { mode: 'pessimistic_read' },
        where: { id: 'divida-1', usuarioId: 'user-1' },
      });
      expect(dividaTypeOrmRepository.findOne).not.toHaveBeenCalled();
      expect(dividaTypeOrmRepository.findOneBy).not.toHaveBeenCalled();
    },
  );

  function createDividaTypeOrmRepositoryMock(): DividaTypeOrmRepositoryMock {
    return {
      findOne: jest.fn((options: FindOneOptions<Divida>) => {
        void options;
        return Promise.resolve(null);
      }),
      findOneBy: jest.fn(
        (where: FindOptionsWhere<Divida> | FindOptionsWhere<Divida>[]) => {
          void where;
          return Promise.resolve(null);
        },
      ),
    };
  }

  function asDividaRepository(
    repositoryMock: DividaTypeOrmRepositoryMock,
  ): Repository<Divida> {
    return repositoryMock as unknown as Repository<Divida>;
  }
});
