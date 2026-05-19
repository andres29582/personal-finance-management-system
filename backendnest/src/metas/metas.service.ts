import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ResourceNotFoundException } from '../common/exceptions';
import { assertPositiveFinancialValue } from '../common/financial-validation.util';
import { Meta } from './entities/meta.entity';
import { CreateMetaDto } from './dto/create-meta.dto';
import { UpdateMetaDto } from './dto/update-meta.dto';
import { ContasService } from '../contas/contas.service';
import { DividasService } from '../dividas/dividas.service';
import { LogsService } from '../logs/logs.service';
import { MetaRepository } from './repositories/meta.repository';

@Injectable()
export class MetasService {
  constructor(
    private readonly metaRepository: MetaRepository,
    private readonly contasService: ContasService,
    private readonly dividasService: DividasService,
    private readonly logsService: LogsService,
  ) {}

  async create(usuarioId: string, dto: CreateMetaDto): Promise<Meta> {
    assertPositiveFinancialValue(dto.montoObjetivo, 'Valor objetivo');
    if (dto.contaId) {
      await this.contasService.findOne(dto.contaId, usuarioId);
    }
    if (dto.dividaId) {
      await this.dividasService.findOne(dto.dividaId, usuarioId);
    }

    const saved = await this.metaRepository.create({
      id: randomUUID(),
      usuarioId,
      ...dto,
    });
    await this.logsService.logEntityEvent({
      event: 'META_CREATED',
      module: 'metas',
      action: 'create',
      userId: usuarioId,
      entity: 'meta',
      entityId: saved.id,
      message: 'Meta criada com sucesso.',
    });
    return saved;
  }

  async findAll(usuarioId: string): Promise<Meta[]> {
    return this.metaRepository.findActiveByUser(usuarioId);
  }

  async findOne(id: string, usuarioId: string): Promise<Meta> {
    const meta = await this.metaRepository.findByIdAndUser(id, usuarioId);
    if (!meta) {
      throw new ResourceNotFoundException(
        'META_NOT_FOUND',
        'Meta não encontrada',
      );
    }
    return meta;
  }

  async update(
    id: string,
    usuarioId: string,
    dto: UpdateMetaDto,
  ): Promise<Meta> {
    await this.findOne(id, usuarioId);

    if (dto.montoObjetivo !== undefined) {
      assertPositiveFinancialValue(dto.montoObjetivo, 'Valor objetivo');
    }
    if (dto.montoActual !== undefined) {
      assertPositiveFinancialValue(dto.montoActual, 'Valor atual');
    }

    await this.metaRepository.updateByIdAndUser(id, usuarioId, dto);
    const updated = await this.findOne(id, usuarioId);
    await this.logsService.logEntityEvent({
      event: 'META_UPDATED',
      module: 'metas',
      action: 'update',
      userId: usuarioId,
      entity: 'meta',
      entityId: id,
      message: 'Meta atualizada com sucesso.',
    });
    return updated;
  }

  async deactivate(id: string, usuarioId: string): Promise<void> {
    await this.findOne(id, usuarioId);
    await this.metaRepository.updateByIdAndUser(id, usuarioId, {
      ativa: false,
    });
    await this.logsService.logEntityEvent({
      event: 'META_DEACTIVATED',
      module: 'metas',
      action: 'deactivate',
      userId: usuarioId,
      entity: 'meta',
      entityId: id,
      message: 'Meta desativada.',
    });
  }
}
