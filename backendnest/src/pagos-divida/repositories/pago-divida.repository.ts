import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../common/abstract/base.repository';
import { notSoftDeleted } from '../../common/soft-delete.query';
import { PagoDivida } from '../entities/pago-divida.entity';

@Injectable()
export class PagoDividaRepository extends BaseRepository<PagoDivida> {
  constructor(
    @InjectRepository(PagoDivida)
    private readonly pagoDividaRepository: Repository<PagoDivida>,
  ) {
    super(pagoDividaRepository);
  }

  async findByDivida(
    dividaId: string,
    usuarioId: string,
  ): Promise<PagoDivida[]> {
    return this.pagoDividaRepository.find({
      where: { dividaId, usuarioId, ...notSoftDeleted },
      order: { data: 'DESC' },
    });
  }

  async findActiveById(
    id: string,
    usuarioId: string,
  ): Promise<PagoDivida | null> {
    return this.pagoDividaRepository.findOneBy({
      id,
      usuarioId,
      ...notSoftDeleted,
    });
  }
}
