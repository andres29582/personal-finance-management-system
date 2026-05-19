import { CategoriasService } from './categorias.service';
import { Categoria } from './entities/categoria.entity';
import { DEFAULT_CATEGORIAS } from './default-categorias';
import { TipoCategoria } from './enums/tipo-categoria.enum';
import { LogsService } from '../logs/logs.service';
import { ResourceNotFoundException } from '../common/exceptions';
import { CategoriaRepository } from './repositories/categoria.repository';

describe('CategoriasService', () => {
  let service: CategoriasService;
  let repository: jest.Mocked<
    Pick<
      CategoriaRepository,
      | 'countByUser'
      | 'create'
      | 'createMany'
      | 'findActiveByUser'
      | 'findByIdAndUser'
      | 'updateByIdAndUser'
    >
  >;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    repository = {
      countByUser: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      findActiveByUser: jest.fn(),
      findByIdAndUser: jest.fn(),
      updateByIdAndUser: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new CategoriasService(
      repository as unknown as CategoriaRepository,
      logsService as unknown as LogsService,
    );
  });

  it('seeds the default categories only for users without categories', async () => {
    const seededCategories = DEFAULT_CATEGORIAS.map((categoria, index) => ({
      ativa: true,
      cor: categoria.cor,
      icone: categoria.icone,
      id: `categoria-${index}`,
      nome: categoria.nome,
      tipo: categoria.tipo,
      usuarioId: 'user-1',
    })) as Categoria[];

    repository.countByUser.mockResolvedValue(0);
    repository.createMany.mockResolvedValue(seededCategories);
    repository.findActiveByUser.mockResolvedValue(seededCategories);

    const result = await service.seedDefaultCategories('user-1');

    expect(repository.createMany).toHaveBeenCalledTimes(1);
    expect(repository.createMany.mock.calls[0][0]).toHaveLength(
      DEFAULT_CATEGORIAS.length,
    );
    expect(result).toHaveLength(DEFAULT_CATEGORIAS.length);
    expect(result.some((item) => item.tipo === TipoCategoria.DESPESA)).toBe(
      true,
    );
  });

  it('returns the existing categories when the user already has data', async () => {
    const existingCategories = [
      {
        ativa: true,
        id: 'categoria-1',
        nome: 'Salario',
        tipo: TipoCategoria.RECEITA,
        usuarioId: 'user-1',
      },
    ] as Categoria[];

    repository.countByUser.mockResolvedValue(1);
    repository.findActiveByUser.mockResolvedValue(existingCategories);

    const result = await service.seedDefaultCategories('user-1');

    expect(repository.createMany).not.toHaveBeenCalled();
    expect(result).toEqual(existingCategories);
  });

  it('updates a category using id and user criteria', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      id: 'categoria-1',
      nome: 'Mercado',
      tipo: TipoCategoria.DESPESA,
      usuarioId: 'user-1',
    } as Categoria);

    await service.update('categoria-1', 'user-1', {
      nome: 'Supermercado',
    });

    expect(repository.updateByIdAndUser).toHaveBeenCalledWith(
      'categoria-1',
      'user-1',
      { nome: 'Supermercado' },
    );
  });

  it('deactivates a category using id and user criteria', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      id: 'categoria-1',
      nome: 'Mercado',
      tipo: TipoCategoria.DESPESA,
      usuarioId: 'user-1',
    } as Categoria);

    await service.deactivate('categoria-1', 'user-1');

    expect(repository.updateByIdAndUser).toHaveBeenCalledWith(
      'categoria-1',
      'user-1',
      { ativa: false },
    );
  });

  it('throws a typed not found error when category does not exist', async () => {
    repository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      service.findOne('categoria-1', 'user-1'),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
    await expect(
      service.findOne('categoria-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'CATEGORIA_NOT_FOUND',
      message: 'Categoria não encontrada',
      statusCode: 404,
    });
  });
});
