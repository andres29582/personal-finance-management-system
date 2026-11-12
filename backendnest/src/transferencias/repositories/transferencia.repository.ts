import { FindTransferenciasDto } from '../dto/find-transferencias.dto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../common/abstract/base.repository';
import { notSoftDeleted } from '../../common/soft-delete.query';
import { Transferencia } from '../entities/transferencia.entity';

@Injectable()
export class TransferenciaRepository extends BaseRepository<Transferencia> {
  constructor(
    @InjectRepository(Transferencia)
    private readonly transferenciaRepository: Repository<Transferencia>,
  ) {
    super(transferenciaRepository);
  }

  async findByUser(
    usuarioId: string,
    query: FindTransferenciasDto = {},
  ): Promise<Transferencia[]> {
    return this.transferenciaRepository.find({
      where: { usuarioId, ...notSoftDeleted },
      order: { data: 'DESC', createdAt: 'DESC', id: 'DESC' },
      take: query.limit ?? 50,
      skip: query.offset ?? 0,
    });
  }

  async findByIdAndUser(
    id: string,
    usuarioId: string,
  ): Promise<Transferencia | null> {
    return this.transferenciaRepository.findOneBy({
      id,
      usuarioId,
      ...notSoftDeleted,
    });
  }

  async updateByIdAndUser(
    id: string,
    usuarioId: string,
    data: Partial<Transferencia>,
  ): Promise<void> {
    await this.transferenciaRepository.update({ id, usuarioId }, data);
  }

  async softDeleteByIdAndUser(id: string, usuarioId: string): Promise<void> {
    await this.updateByIdAndUser(id, usuarioId, { excluidoEm: new Date() });
  }
}
