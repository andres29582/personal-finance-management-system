import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../common/abstract/base.repository';
import { Categoria } from '../entities/categoria.entity';
import { TipoCategoria } from '../enums/tipo-categoria.enum';

@Injectable()
export class CategoriaRepository extends BaseRepository<Categoria> {
  constructor(
    @InjectRepository(Categoria)
    private readonly categoriaRepository: Repository<Categoria>,
  ) {
    super(categoriaRepository);
  }

  async findActiveByUser(
    usuarioId: string,
    tipo?: TipoCategoria,
  ): Promise<Categoria[]> {
    return this.categoriaRepository.find({
      where: { usuarioId, ativa: true, ...(tipo ? { tipo } : {}) },
      order: { tipo: 'ASC', nome: 'ASC' },
    });
  }

  async findByIdAndUser(
    id: string,
    usuarioId: string,
  ): Promise<Categoria | null> {
    return this.categoriaRepository.findOneBy({ id, usuarioId });
  }

  async updateByIdAndUser(
    id: string,
    usuarioId: string,
    data: Partial<Categoria>,
  ): Promise<void> {
    await this.categoriaRepository.update({ id, usuarioId }, data);
  }

  async countByUser(usuarioId: string): Promise<number> {
    return this.categoriaRepository.countBy({ usuarioId });
  }

  async createMany(
    categories: Array<Partial<Categoria>>,
  ): Promise<Categoria[]> {
    const entities = this.categoriaRepository.create(categories);
    return this.categoriaRepository.save(entities);
  }
}
