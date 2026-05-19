import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../common/abstract/base.repository';
import { Alerta } from '../entities/alerta.entity';

@Injectable()
export class AlertaRepository extends BaseRepository<Alerta> {
  constructor(
    @InjectRepository(Alerta)
    private readonly alertaRepository: Repository<Alerta>,
  ) {
    super(alertaRepository);
  }

  async findActiveByUser(usuarioId: string): Promise<Alerta[]> {
    return this.alertaRepository.find({
      where: { usuarioId, ativa: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdAndUser(id: string, usuarioId: string): Promise<Alerta | null> {
    return this.alertaRepository.findOneBy({ id, usuarioId });
  }

  async updateByIdAndUser(
    id: string,
    usuarioId: string,
    data: Partial<Alerta>,
  ): Promise<void> {
    await this.alertaRepository.update({ id, usuarioId }, data);
  }
}
