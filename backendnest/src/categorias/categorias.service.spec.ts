import { Repository } from 'typeorm';
import { CategoriasService } from './categorias.service';
import { Categoria } from './entities/categoria.entity';
import { DEFAULT_CATEGORIAS } from './default-categorias';
import { TipoCategoria } from './enums/tipo-categoria.enum';
import { LogsService } from '../logs/logs.service';

describe('CategoriasService', () => {
  let service: CategoriasService;
  let repository: jest.Mocked<
    Pick<
      Repository<Categoria>,
      'countBy' | 'create' | 'find' | 'findOneBy' | 'save' | 'update'
    >
  >;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    repository = {
      countBy: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new CategoriasService(
      repository as unknown as Repository<Categoria>,
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

    repository.countBy.mockResolvedValue(0);
    repository.create.mockImplementation((entity) => entity as Categoria);
    repository.save.mockResolvedValue(seededCategories as never);
    repository.find.mockResolvedValue(seededCategories);

    const result = await service.seedDefaultCategories('user-1');

    expect(repository.create).toHaveBeenCalledTimes(DEFAULT_CATEGORIAS.length);
    expect(repository.save).toHaveBeenCalledTimes(1);
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

    repository.countBy.mockResolvedValue(1);
    repository.find.mockResolvedValue(existingCategories);

    const result = await service.seedDefaultCategories('user-1');

    expect(repository.save).not.toHaveBeenCalled();
    expect(result).toEqual(existingCategories);
  });

  it('updates a category using id and user criteria', async () => {
    repository.findOneBy.mockResolvedValue({
      id: 'categoria-1',
      nome: 'Mercado',
      tipo: TipoCategoria.DESPESA,
      usuarioId: 'user-1',
    } as Categoria);

    await service.update('categoria-1', 'user-1', {
      nome: 'Supermercado',
    });

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'categoria-1', usuarioId: 'user-1' },
      { nome: 'Supermercado' },
    );
  });

  it('deactivates a category using id and user criteria', async () => {
    repository.findOneBy.mockResolvedValue({
      id: 'categoria-1',
      nome: 'Mercado',
      tipo: TipoCategoria.DESPESA,
      usuarioId: 'user-1',
    } as Categoria);

    await service.deactivate('categoria-1', 'user-1');

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'categoria-1', usuarioId: 'user-1' },
      { ativa: false },
    );
  });
});
