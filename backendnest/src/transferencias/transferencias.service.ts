import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  assertNonNegativeFinancialValue,
  assertPositiveFinancialValue,
} from '../common/financial-validation.util';
import { notSoftDeleted } from '../common/soft-delete.query';
import { Conta } from '../contas/entities/conta.entity';
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
    if (dto.contaOrigemId === dto.contaDestinoId) {
      throw new BadRequestException(
        'Conta origem e destino devem ser diferentes',
      );
    }

    assertPositiveFinancialValue(dto.valor, 'Valor da transferencia');
    assertNonNegativeFinancialValue(dto.comissao ?? 0, 'Comissao');

    const contaOrigem = await this.contasService.findOne(
      dto.contaOrigemId,
      usuarioId,
    );
    const contaDestino = await this.contasService.findOne(
      dto.contaDestinoId,
      usuarioId,
    );

    this.ensureAccountBelongsToUser(contaOrigem, usuarioId);
    this.ensureAccountBelongsToUser(contaDestino, usuarioId);

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
      where: { usuarioId, ...notSoftDeleted },
      order: { data: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string, usuarioId: string): Promise<Transferencia> {
    const transferencia = await this.transferenciasRepository.findOneBy({
      id,
      usuarioId,
      ...notSoftDeleted,
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

    if (dto.valor !== undefined) {
      assertPositiveFinancialValue(dto.valor, 'Valor da transferencia');
    }

    if (dto.comissao !== undefined) {
      assertNonNegativeFinancialValue(dto.comissao, 'Comissao');
    }

    await this.transferenciasRepository.update({ id, usuarioId }, dto);
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
    await this.transferenciasRepository.update(
      { id, usuarioId },
      { excluidoEm: new Date() },
    );
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

  private ensureAccountBelongsToUser(
    conta: Pick<Conta, 'usuarioId'>,
    usuarioId: string,
  ): void {
    if (conta.usuarioId !== usuarioId) {
      throw new NotFoundException('Conta nao encontrada');
    }
  }
}
