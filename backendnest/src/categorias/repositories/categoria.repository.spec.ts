import {
  EntityManager,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { Categoria } from '../entities/categoria.entity';
import { CategoriaRepository } from './categoria.repository';

type CategoriaTypeOrmRepositoryMock = {
  findOne: jest.Mock<Promise<Categoria | null>, [FindOneOptions<Categoria>]>;
  findOneBy: jest.Mock<
    Promise<Categoria | null>,
    [FindOptionsWhere<Categoria> | FindOptionsWhere<Categoria>[]]
  >;
};

describe('CategoriaRepository', () => {
  let categoriaTypeOrmRepository: CategoriaTypeOrmRepositoryMock;
  let managerCategoriaRepository: CategoriaTypeOrmRepositoryMock;
  let getRepository: jest.Mock<Repository<Categoria>, [typeof Categoria]>;
  let manager: EntityManager;
  let repository: CategoriaRepository;

  beforeEach(() => {
    categoriaTypeOrmRepository = createCategoriaTypeOrmRepositoryMock();
    managerCategoriaRepository = createCategoriaTypeOrmRepositoryMock();
    getRepository = jest.fn((target: typeof Categoria) => {
      void target;
      return asCategoriaRepository(managerCategoriaRepository);
    });
    manager = { getRepository } as unknown as EntityManager;
    repository = new CategoriaRepository(
      asCategoriaRepository(categoriaTypeOrmRepository),
    );
  });

  it.each([
    {
      description: 'returns the category',
      result: {
        ativa: true,
        id: 'categoria-1',
        usuarioId: 'user-1',
      } as Categoria,
    },
    { description: 'returns null', result: null },
  ])(
    '$description through the transactional manager with a pessimistic read lock',
    async ({ result }) => {
      managerCategoriaRepository.findOne.mockResolvedValue(result);

      await expect(
        repository.findByIdAndUserForWrite('categoria-1', 'user-1', manager),
      ).resolves.toBe(result);

      expect(getRepository).toHaveBeenCalledWith(Categoria);
      expect(managerCategoriaRepository.findOne).toHaveBeenCalledWith({
        lock: { mode: 'pessimistic_read' },
        where: { id: 'categoria-1', usuarioId: 'user-1' },
      });
      expect(categoriaTypeOrmRepository.findOne).not.toHaveBeenCalled();
      expect(categoriaTypeOrmRepository.findOneBy).not.toHaveBeenCalled();
    },
  );

  function createCategoriaTypeOrmRepositoryMock(): CategoriaTypeOrmRepositoryMock {
    return {
      findOne: jest.fn((options: FindOneOptions<Categoria>) => {
        void options;
        return Promise.resolve(null);
      }),
      findOneBy: jest.fn(
        (
          where: FindOptionsWhere<Categoria> | FindOptionsWhere<Categoria>[],
        ) => {
          void where;
          return Promise.resolve(null);
        },
      ),
    };
  }

  function asCategoriaRepository(
    repositoryMock: CategoriaTypeOrmRepositoryMock,
  ): Repository<Categoria> {
    return repositoryMock as unknown as Repository<Categoria>;
  }
});
