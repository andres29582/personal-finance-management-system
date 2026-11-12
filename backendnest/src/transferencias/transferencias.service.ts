import { FindTransferenciasDto } from './dto/find-transferencias.dto';
import { AppException } from '../common/exceptions/app.exception';
import { InternalServerAppException } from '../common/exceptions';
import {
  canonicalTransferIntent,
  replayTransferIntent,
} from './transfer-intent';
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
    let created = false;
    const savedTransfer = await this.dataSource
      .transaction(async (manager) => {
        const key = dto.idempotencyKey?.toLowerCase();
        const intent = key ? canonicalTransferIntent(dto) : null;
        const findIntent = () =>
          manager
            .createQueryBuilder(Transferencia, 'transfer')
            .addSelect([
              'transfer.idempotencyKey',
              'transfer.idempotencyFingerprint',
            ])
            .where(
              'transfer.usuarioId = :usuarioId AND transfer.idempotencyKey = :key',
              { usuarioId, key },
            )
            .getOne();
        if (intent) {
          const existing = await findIntent();
          if (existing)
            return replayTransferIntent(existing, intent.fingerprint);
        }
        if (
          (intent?.values.contaOrigemId ?? dto.contaOrigemId) ===
          (intent?.values.contaDestinoId ?? dto.contaDestinoId)
        ) {
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
          ...(intent ? intent.values : dto),
          ...(intent
            ? {
                idempotencyKey: key,
                idempotencyFingerprint: intent.fingerprint,
              }
            : {}),
        });

        if (intent) {
          const result = await manager
            .createQueryBuilder()
            .insert()
            .into(Transferencia)
            .values(transfer)
            .onConflict('(usuario_id, idempotency_key) DO NOTHING')
            .returning('id')
            .execute();
          const stored = await findIntent();
          if (!stored) throw new Error('Transfer intent was not persisted.');
          const insertedRows: unknown = result.raw;
          if (!Array.isArray(insertedRows))
            throw new Error('Unexpected transfer insert result.');
          created = insertedRows.length > 0;
          return replayTransferIntent(stored, intent.fingerprint);
        }
        const saved = await manager.save(transfer);
        created = true;
        return saved;
      })
      .catch((error: unknown) => {
        if (!dto.idempotencyKey || error instanceof AppException) throw error;
        // Do not forward driver diagnostics containing the private intent fingerprint.
        throw new InternalServerAppException(
          'Nao foi possivel processar a tentativa de transferencia.',
        );
      });

    if (created)
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

  async findAll(
    usuarioId: string,
    query: FindTransferenciasDto = {},
  ): Promise<Transferencia[]> {
    return this.transferenciaRepository.findByUser(usuarioId, query);
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
    const changes: UpdateTransferenciaDto = Object.fromEntries(
      ['valor', 'comissao', 'data', 'descricao']
        .filter(
          (field) => dto[field as keyof UpdateTransferenciaDto] !== undefined,
        )
        .map((field) => [field, dto[field as keyof UpdateTransferenciaDto]]),
    );
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
          changes,
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
        changedFields: this.getChangedFields(changes),
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
