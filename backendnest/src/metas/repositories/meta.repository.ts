import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../common/abstract/base.repository';
import { Meta } from '../entities/meta.entity';

@Injectable()
export class MetaRepository extends BaseRepository<Meta> {
  constructor(
    @InjectRepository(Meta)
    private readonly metaRepository: Repository<Meta>,
  ) {
    super(metaRepository);
  }

  async findActiveByUser(usuarioId: string): Promise<Meta[]> {
    return this.metaRepository.find({
      where: { usuarioId, ativa: true },
      order: { fechaLimite: 'ASC' },
    });
  }

  async findByIdAndUser(id: string, usuarioId: string): Promise<Meta | null> {
    return this.metaRepository.findOneBy({ id, usuarioId });
  }

  async updateByIdAndUser(
    id: string,
    usuarioId: string,
    data: Partial<Meta>,
  ): Promise<void> {
    await this.metaRepository.update({ id, usuarioId }, data);
  }
}
