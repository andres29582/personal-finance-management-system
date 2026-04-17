import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Transferencia } from './entities/transferencia.entity';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import { UpdateTransferenciaDto } from './dto/update-transferencia.dto';
import { ContasService } from '../contas/contas.service';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class TransferenciasService {
  constructor(
    @InjectRepository(Transferencia)
    private readonly transferenciasRepository: Repository<Transferencia>,
    private readonly contasService: ContasService,
    private readonly logsService: LogsService,
  ) {}

  async create(
    usuarioId: string,
    dto: CreateTransferenciaDto,
  ): Promise<Transferencia> {
    await this.contasService.findOne(dto.contaOrigemId, usuarioId);
    await this.contasService.findOne(dto.contaDestinoId, usuarioId);

    if (dto.contaOrigemId === dto.contaDestinoId) {
      throw new BadRequestException(
        'Conta origem e destino devem ser diferentes',
      );
    }

    const transferencia = this.transferenciasRepository.create({
      id: randomUUID(),
      usuarioId,
      ...dto,
    });
    const savedTransfer =
      await this.transferenciasRepository.save(transferencia);

    await this.logsService.logEntityEvent({
      event: 'TRANSFERENCIA_CREATED',
      module: 'transferencias',
      action: 'create',
      userId: usuarioId,
      entity: 'transferencia',
      entityId: savedTransfer.id,
      message: 'Transferencia criada com sucesso.',
      details: {
        contaOrigemId: savedTransfer.contaOrigemId,
        contaDestinoId: savedTransfer.contaDestinoId,
        valor: savedTransfer.valor,
      },
    });

    return savedTransfer;
  }

  async findAll(usuarioId: string): Promise<Transferencia[]> {
    return this.transferenciasRepository.find({
      where: { usuarioId },
      order: { data: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string, usuarioId: string): Promise<Transferencia> {
    const transferencia = await this.transferenciasRepository.findOneBy({
      id,
      usuarioId,
    });
    if (!transferencia) {
      throw new NotFoundException('Transferência não encontrada');
    }
    return transferencia;
  }

  async update(
    id: string,
    usuarioId: string,
    dto: UpdateTransferenciaDto,
  ): Promise<Transferencia> {
    await this.findOne(id, usuarioId);
    await this.transferenciasRepository.update(id, dto);
    const updatedTransfer = await this.findOne(id, usuarioId);

    await this.logsService.logEntityEvent({
      event: 'TRANSFERENCIA_UPDATED',
      module: 'transferencias',
      action: 'update',
      userId: usuarioId,
      entity: 'transferencia',
      entityId: updatedTransfer.id,
      message: 'Transferencia atualizada com sucesso.',
      details: {
        changedFields: this.getChangedFields(dto),
      },
    });

    return updatedTransfer;
  }

  async remove(id: string, usuarioId: string): Promise<void> {
    const transfer = await this.findOne(id, usuarioId);
    await this.transferenciasRepository.delete(id);
    await this.logsService.logEntityEvent({
      event: 'TRANSFERENCIA_DELETED',
      module: 'transferencias',
      action: 'delete',
      userId: usuarioId,
      entity: 'transferencia',
      entityId: transfer.id,
      message: 'Transferencia excluida com sucesso.',
      details: {
        contaOrigemId: transfer.contaOrigemId,
        contaDestinoId: transfer.contaDestinoId,
        valor: transfer.valor,
      },
    });
  }

  private getChangedFields(dto: UpdateTransferenciaDto): string[] {
    return Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
  }
}
