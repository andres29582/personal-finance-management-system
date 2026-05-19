import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Alerta } from './entities/alerta.entity';
import { CreateAlertaDto } from './dto/create-alerta.dto';
import { UpdateAlertaDto } from './dto/update-alerta.dto';
import { LogsService } from '../logs/logs.service';
import { ResourceNotFoundException } from '../common/exceptions';
import { AlertaRepository } from './repositories/alerta.repository';

@Injectable()
export class AlertasService {
  constructor(
    private readonly alertaRepository: AlertaRepository,
    private readonly logsService: LogsService,
  ) {}

  async create(usuarioId: string, dto: CreateAlertaDto): Promise<Alerta> {
    const saved = await this.alertaRepository.create({
      id: randomUUID(),
      usuarioId,
      ...dto,
    });
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
    return this.alertaRepository.findActiveByUser(usuarioId);
  }

  async findOne(id: string, usuarioId: string): Promise<Alerta> {
    const alerta = await this.alertaRepository.findByIdAndUser(id, usuarioId);
    if (!alerta) {
      throw new ResourceNotFoundException(
        'ALERTA_NOT_FOUND',
        'Alerta não encontrado',
      );
    }
    return alerta;
  }

  async update(
    id: string,
    usuarioId: string,
    dto: UpdateAlertaDto,
  ): Promise<Alerta> {
    await this.findOne(id, usuarioId);
    await this.alertaRepository.updateByIdAndUser(id, usuarioId, dto);
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
    await this.alertaRepository.updateByIdAndUser(id, usuarioId, {
      ativa: false,
    });
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
    await this.alertaRepository.updateByIdAndUser(id, usuarioId, {
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
