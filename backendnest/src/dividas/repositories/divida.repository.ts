import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../common/abstract/base.repository';
import { Divida } from '../entities/divida.entity';

@Injectable()
export class DividaRepository extends BaseRepository<Divida> {
  constructor(
    @InjectRepository(Divida)
    private readonly dividaRepository: Repository<Divida>,
  ) {
    super(dividaRepository);
  }

  async findActiveByUser(usuarioId: string): Promise<Divida[]> {
    return this.dividaRepository.find({
      where: { usuarioId, ativa: true },
      order: { proximoVencimiento: 'ASC' },
    });
  }

  async findByIdAndUser(id: string, usuarioId: string): Promise<Divida | null> {
    return this.dividaRepository.findOneBy({ id, usuarioId });
  }

  async updateByIdAndUser(
    id: string,
    usuarioId: string,
    data: Partial<Divida>,
  ): Promise<void> {
    await this.dividaRepository.update({ id, usuarioId }, data);
  }
}
