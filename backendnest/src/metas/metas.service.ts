import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { assertPositiveFinancialValue } from '../common/financial-validation.util';
import { Meta } from './entities/meta.entity';
import { CreateMetaDto } from './dto/create-meta.dto';
import { UpdateMetaDto } from './dto/update-meta.dto';
import { ContasService } from '../contas/contas.service';
import { DividasService } from '../dividas/dividas.service';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class MetasService {
  constructor(
    @InjectRepository(Meta)
    private readonly metasRepository: Repository<Meta>,
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

    const meta = this.metasRepository.create({
      id: randomUUID(),
      usuarioId,
      ...dto,
    });
    const saved = await this.metasRepository.save(meta);
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
    return this.metasRepository.find({
      where: { usuarioId, ativa: true },
      order: { fechaLimite: 'ASC' },
    });
  }

  async findOne(id: string, usuarioId: string): Promise<Meta> {
    const meta = await this.metasRepository.findOneBy({ id, usuarioId });
    if (!meta) {
      throw new NotFoundException('Meta não encontrada');
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

    await this.metasRepository.update({ id, usuarioId }, dto);
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
    await this.metasRepository.update({ id, usuarioId }, { ativa: false });
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
