import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { Categoria } from './entities/categoria.entity';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { DEFAULT_CATEGORIAS } from './default-categorias';
import { TipoCategoria } from './enums/tipo-categoria.enum';
import { LogsService } from '../logs/logs.service';
import {
  BusinessRuleException,
  ResourceNotFoundException,
} from '../common/exceptions';
import { CategoriaRepository } from './repositories/categoria.repository';

@Injectable()
export class CategoriasService {
  constructor(
    private readonly categoriaRepository: CategoriaRepository,
    private readonly logsService: LogsService,
  ) {}

  async create(usuarioId: string, dto: CreateCategoriaDto): Promise<Categoria> {
    const savedCategory = await this.categoriaRepository.create({
      id: randomUUID(),
      usuarioId,
      ...dto,
    });

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
    return this.categoriaRepository.findActiveByUser(usuarioId, tipo);
  }

  async findOne(id: string, usuarioId: string): Promise<Categoria> {
    const categoria = await this.categoriaRepository.findByIdAndUser(
      id,
      usuarioId,
    );
    if (!categoria) {
      throw new ResourceNotFoundException(
        'CATEGORIA_NOT_FOUND',
        'Categoria não encontrada',
      );
    }
    return categoria;
  }

  async findActiveForWrite(
    id: string,
    usuarioId: string,
    manager: EntityManager,
  ): Promise<Categoria> {
    const categoria = await this.categoriaRepository.findByIdAndUserForWrite(
      id,
      usuarioId,
      manager,
    );
    if (!categoria) {
      throw new ResourceNotFoundException(
        'CATEGORIA_NOT_FOUND',
        'Categoria não encontrada',
      );
    }
    if (categoria.ativa === false) {
      throw new BusinessRuleException(
        'CATEGORIA_INACTIVE',
        'Não é possível realizar operações financeiras com uma categoria inativa.',
      );
    }
    return categoria;
  }

  async update(
    id: string,
    usuarioId: string,
    dto: UpdateCategoriaDto,
  ): Promise<Categoria> {
    await this.findOne(id, usuarioId);
    await this.categoriaRepository.updateByIdAndUser(id, usuarioId, dto);
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
    await this.categoriaRepository.updateByIdAndUser(id, usuarioId, {
      ativa: false,
    });
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
    const existingCategoriesCount =
      await this.categoriaRepository.countByUser(usuarioId);

    if (existingCategoriesCount > 0) {
      return this.findAll(usuarioId);
    }

    const categories = DEFAULT_CATEGORIAS.map((defaultCategory) => ({
      id: randomUUID(),
      usuarioId,
      ...defaultCategory,
    }));

    await this.categoriaRepository.createMany(categories);

    return this.findAll(usuarioId);
  }

  private getChangedFields(dto: UpdateCategoriaDto): string[] {
    return Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
  }
}
