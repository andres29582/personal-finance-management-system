import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Alerta } from './entities/alerta.entity';
import { CreateAlertaDto } from './dto/create-alerta.dto';
import { UpdateAlertaDto } from './dto/update-alerta.dto';

@Injectable()
export class AlertasService {
  constructor(
    @InjectRepository(Alerta)
    private readonly alertasRepository: Repository<Alerta>,
  ) {}

  async create(usuarioId: string, dto: CreateAlertaDto): Promise<Alerta> {
    const alerta = this.alertasRepository.create({
      id: randomUUID(),
      usuarioId,
      ...dto,
    });
    return this.alertasRepository.save(alerta);
  }

  async findAll(usuarioId: string): Promise<Alerta[]> {
    return this.alertasRepository.find({
      where: { usuarioId, ativa: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, usuarioId: string): Promise<Alerta> {
    const alerta = await this.alertasRepository.findOneBy({ id, usuarioId });
    if (!alerta) {
      throw new NotFoundException('Alerta não encontrado');
    }
    return alerta;
  }

  async update(
    id: string,
    usuarioId: string,
    dto: UpdateAlertaDto,
  ): Promise<Alerta> {
    await this.findOne(id, usuarioId);
    await this.alertasRepository.update(id, dto);
    return this.findOne(id, usuarioId);
  }

  async deactivate(id: string, usuarioId: string): Promise<void> {
    await this.findOne(id, usuarioId);
    await this.alertasRepository.update(id, { ativa: false });
  }

  async markNotified(id: string, usuarioId: string): Promise<void> {
    await this.findOne(id, usuarioId);
    await this.alertasRepository.update(id, {
      ultimaNotificacion: new Date(),
    });
  }
}
