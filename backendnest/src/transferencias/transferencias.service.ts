import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import {
  BusinessRuleException,
  ResourceNotFoundException,
} from '../common/exceptions';
import {
  assertNonNegativeFinancialValue,
  assertPositiveFinancialValue,
} from '../common/financial-validation.util';
import { notSoftDeleted } from '../common/soft-delete.query';
import { Transferencia } from './entities/transferencia.entity';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import { UpdateTransferenciaDto } from './dto/update-transferencia.dto';
import { ContasService } from '../contas/contas.service';
import { LogsService } from '../logs/logs.service';
import { TransferenciaRepository } from './repositories/transferencia.repository';

@Injectable()
export class TransferenciasService {
  constructor(
    private readonly transferenciaRepository: TransferenciaRepository,
    private readonly contasService: ContasService,
    private readonly dataSource: DataSource,
    private readonly logsService: LogsService,
  ) {}

  async create(
    usuarioId: string,
    dto: CreateTransferenciaDto,
  ): Promise<Transferencia> {
    const savedTransfer = await this.dataSource.transaction(async (manager) => {
      if (dto.contaOrigemId === dto.contaDestinoId) {
        throw new BusinessRuleException(
          'TRANSFERENCIA_SAME_ACCOUNT',
          'Conta origem e destino devem ser diferentes',
        );
      }

      assertPositiveFinancialValue(dto.valor, 'Valor da transferencia');
      assertNonNegativeFinancialValue(dto.comissao ?? 0, 'Comissao');

      await this.contasService.findActiveManyForWrite(
        [dto.contaOrigemId, dto.contaDestinoId],
        usuarioId,
        manager,
      );

      const transfer = manager.create(Transferencia, {
        id: randomUUID(),
        usuarioId,
        ...dto,
      });

      return manager.save(transfer);
    });

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
    return this.transferenciaRepository.findByUser(usuarioId);
  }

  async findOne(id: string, usuarioId: string): Promise<Transferencia> {
    const transferencia = await this.transferenciaRepository.findByIdAndUser(
      id,
      usuarioId,
    );
    if (!transferencia) {
      throw new ResourceNotFoundException(
        'TRANSFERENCIA_NOT_FOUND',
        'Transferência não encontrada',
      );
    }
    return transferencia;
  }

  async update(
    id: string,
    usuarioId: string,
    dto: UpdateTransferenciaDto,
  ): Promise<Transferencia> {
    const updatedTransfer = await this.dataSource.transaction(
      async (manager) => {
        const currentTransfer = await this.findOneForWrite(
          id,
          usuarioId,
          manager,
        );

        if (dto.valor !== undefined) {
          assertPositiveFinancialValue(dto.valor, 'Valor da transferencia');
        }

        if (dto.comissao !== undefined) {
          assertNonNegativeFinancialValue(dto.comissao, 'Comissao');
        }

        await this.contasService.findActiveManyForWrite(
          [currentTransfer.contaOrigemId, currentTransfer.contaDestinoId],
          usuarioId,
          manager,
        );

        await manager.update(
          Transferencia,
          { id, usuarioId, ...notSoftDeleted },
          dto,
        );

        return this.findOneForWrite(id, usuarioId, manager);
      },
    );

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
    await this.transferenciaRepository.softDeleteByIdAndUser(id, usuarioId);
    await this.logsService.logEntityEvent({
      event: 'TRANSFERENCIA_SOFT_DELETED',
      module: 'transferencias',
      action: 'delete',
      userId: usuarioId,
      entity: 'transferencia',
      entityId: transfer.id,
      message: 'Transferencia excluida logicamente com sucesso.',
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

  private async findOneForWrite(
    id: string,
    usuarioId: string,
    manager: EntityManager,
  ): Promise<Transferencia> {
    const transfer = await manager.findOne(Transferencia, {
      where: { id, usuarioId, ...notSoftDeleted },
      lock: { mode: 'pessimistic_write' },
    });

    if (!transfer) {
      throw new ResourceNotFoundException(
        'TRANSFERENCIA_NOT_FOUND',
        'Transferência não encontrada',
      );
    }

    return transfer;
  }
}
