import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Categoria } from './entities/categoria.entity';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { DEFAULT_CATEGORIAS } from './default-categorias';
import { TipoCategoria } from './enums/tipo-categoria.enum';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private readonly categoriasRepository: Repository<Categoria>,
    private readonly logsService: LogsService,
  ) {}

  async create(usuarioId: string, dto: CreateCategoriaDto): Promise<Categoria> {
    const categoria = this.categoriasRepository.create({
      id: randomUUID(),
      usuarioId,
      ...dto,
    });
    const savedCategory = await this.categoriasRepository.save(categoria);

    await this.logsService.logEntityEvent({
      event: 'CATEGORIA_CREATED',
      module: 'categorias',
      action: 'create',
      userId: usuarioId,
      entity: 'categoria',
      entityId: savedCategory.id,
      message: 'Categoria criada com sucesso.',
      details: {
        nome: savedCategory.nome,
        tipo: savedCategory.tipo,
      },
    });

    return savedCategory;
  }

  async findAll(usuarioId: string, tipo?: TipoCategoria): Promise<Categoria[]> {
    return this.categoriasRepository.find({
      where: { usuarioId, ativa: true, ...(tipo ? { tipo } : {}) },
      order: { tipo: 'ASC', nome: 'ASC' },
    });
  }

  async findOne(id: string, usuarioId: string): Promise<Categoria> {
    const categoria = await this.categoriasRepository.findOneBy({
      id,
      usuarioId,
    });
    if (!categoria) {
      throw new NotFoundException('Categoria não encontrada');
    }
    return categoria;
  }

  async update(
    id: string,
    usuarioId: string,
    dto: UpdateCategoriaDto,
  ): Promise<Categoria> {
    await this.findOne(id, usuarioId);
    await this.categoriasRepository.update({ id, usuarioId }, dto);
    const updatedCategory = await this.findOne(id, usuarioId);

    await this.logsService.logEntityEvent({
      event: 'CATEGORIA_UPDATED',
      module: 'categorias',
      action: 'update',
      userId: usuarioId,
      entity: 'categoria',
      entityId: updatedCategory.id,
      message: 'Categoria atualizada com sucesso.',
      details: {
        changedFields: this.getChangedFields(dto),
      },
    });

    return updatedCategory;
  }

  async deactivate(id: string, usuarioId: string): Promise<void> {
    const category = await this.findOne(id, usuarioId);
    await this.categoriasRepository.update({ id, usuarioId }, { ativa: false });
    await this.logsService.logEntityEvent({
      event: 'CATEGORIA_DEACTIVATED',
      module: 'categorias',
      action: 'deactivate',
      userId: usuarioId,
      entity: 'categoria',
      entityId: category.id,
      message: 'Categoria desativada com sucesso.',
      details: {
        nome: category.nome,
      },
    });
  }

  async seedDefaultCategories(usuarioId: string): Promise<Categoria[]> {
    const existingCategoriesCount = await this.categoriasRepository.countBy({
      usuarioId,
    });

    if (existingCategoriesCount > 0) {
      return this.findAll(usuarioId);
    }

    const categories = DEFAULT_CATEGORIAS.map((defaultCategory) =>
      this.categoriasRepository.create({
        id: randomUUID(),
        usuarioId,
        ...defaultCategory,
      }),
    );

    await this.categoriasRepository.save(categories);

    return this.findAll(usuarioId);
  }

  private getChangedFields(dto: UpdateCategoriaDto): string[] {
    return Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
  }
}
