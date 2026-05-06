import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Alerta } from './entities/alerta.entity';
import { CreateAlertaDto } from './dto/create-alerta.dto';
import { UpdateAlertaDto } from './dto/update-alerta.dto';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class AlertasService {
  constructor(
    @InjectRepository(Alerta)
    private readonly alertasRepository: Repository<Alerta>,
    private readonly logsService: LogsService,
  ) {}

  async create(usuarioId: string, dto: CreateAlertaDto): Promise<Alerta> {
    const alerta = this.alertasRepository.create({
      id: randomUUID(),
      usuarioId,
      ...dto,
    });
    const saved = await this.alertasRepository.save(alerta);
    await this.logsService.logEntityEvent({
      event: 'ALERTA_CREATED',
      module: 'alertas',
      action: 'create',
      userId: usuarioId,
      entity: 'alerta',
      entityId: saved.id,
      message: 'Alerta criado com sucesso.',
    });
    return saved;
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
    const updated = await this.findOne(id, usuarioId);
    await this.logsService.logEntityEvent({
      event: 'ALERTA_UPDATED',
      module: 'alertas',
      action: 'update',
      userId: usuarioId,
      entity: 'alerta',
      entityId: id,
      message: 'Alerta atualizado com sucesso.',
    });
    return updated;
  }

  async deactivate(id: string, usuarioId: string): Promise<void> {
    await this.findOne(id, usuarioId);
    await this.alertasRepository.update(id, { ativa: false });
    await this.logsService.logEntityEvent({
      event: 'ALERTA_DEACTIVATED',
      module: 'alertas',
      action: 'deactivate',
      userId: usuarioId,
      entity: 'alerta',
      entityId: id,
      message: 'Alerta desativado.',
    });
  }

  async markNotified(id: string, usuarioId: string): Promise<void> {
    await this.findOne(id, usuarioId);
    await this.alertasRepository.update(id, {
      ultimaNotificacion: new Date(),
    });
    await this.logsService.logEntityEvent({
      event: 'ALERTA_NOTIFIED',
      module: 'alertas',
      action: 'notify',
      userId: usuarioId,
      entity: 'alerta',
      entityId: id,
      message: 'Alerta marcado como notificado.',
    });
  }
}
