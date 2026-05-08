import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  assertNonNegativeFinancialValue,
  assertPositiveFinancialValue,
} from '../common/financial-validation.util';
import { Divida } from './entities/divida.entity';
import { CreateDividaDto } from './dto/create-divida.dto';
import { UpdateDividaDto } from './dto/update-divida.dto';
import { ContasService } from '../contas/contas.service';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class DividasService {
  constructor(
    @InjectRepository(Divida)
    private readonly dividasRepository: Repository<Divida>,
    private readonly contasService: ContasService,
    private readonly logsService: LogsService,
  ) {}

  async create(usuarioId: string, dto: CreateDividaDto): Promise<Divida> {
    assertPositiveFinancialValue(dto.montoTotal, 'Valor total da divida');
    if (dto.cuotaMensual !== undefined) {
      assertPositiveFinancialValue(dto.cuotaMensual, 'Parcela mensal');
    }
    if (dto.tasaInteres !== undefined) {
      assertNonNegativeFinancialValue(dto.tasaInteres, 'Taxa de juros');
    }

    if (dto.contaId) {
      await this.contasService.findOne(dto.contaId, usuarioId);
    }

    const divida = this.dividasRepository.create({
      id: randomUUID(),
      usuarioId,
      ...dto,
    });
    const savedDebt = await this.dividasRepository.save(divida);

    await this.logsService.logEntityEvent({
      event: 'DIVIDA_CREATED',
      module: 'dividas',
      action: 'create',
      userId: usuarioId,
      entity: 'divida',
      entityId: savedDebt.id,
      message: 'Divida criada com sucesso.',
      details: {
        contaId: savedDebt.contaId,
        valorTotal: savedDebt.montoTotal,
      },
    });

    return savedDebt;
  }

  async findAll(usuarioId: string): Promise<Divida[]> {
    return this.dividasRepository.find({
      where: { usuarioId, ativa: true },
      order: { proximoVencimiento: 'ASC' },
    });
  }

  async findOne(id: string, usuarioId: string): Promise<Divida> {
    const divida = await this.dividasRepository.findOneBy({ id, usuarioId });
    if (!divida) {
      throw new NotFoundException('Dívida não encontrada');
    }
    return divida;
  }

  async update(
    id: string,
    usuarioId: string,
    dto: UpdateDividaDto,
  ): Promise<Divida> {
    await this.findOne(id, usuarioId);

    if (dto.cuotaMensual !== undefined) {
      assertPositiveFinancialValue(dto.cuotaMensual, 'Parcela mensal');
    }
    if (dto.tasaInteres !== undefined) {
      assertNonNegativeFinancialValue(dto.tasaInteres, 'Taxa de juros');
    }

    await this.dividasRepository.update({ id, usuarioId }, dto);
    const updatedDebt = await this.findOne(id, usuarioId);

    await this.logsService.logEntityEvent({
      event: 'DIVIDA_UPDATED',
      module: 'dividas',
      action: 'update',
      userId: usuarioId,
      entity: 'divida',
      entityId: updatedDebt.id,
      message: 'Divida atualizada com sucesso.',
      details: {
        changedFields: this.getChangedFields(dto),
      },
    });

    return updatedDebt;
  }

  async deactivate(id: string, usuarioId: string): Promise<void> {
    const debt = await this.findOne(id, usuarioId);
    await this.dividasRepository.update({ id, usuarioId }, { ativa: false });
    await this.logsService.logEntityEvent({
      event: 'DIVIDA_DEACTIVATED',
      module: 'dividas',
      action: 'deactivate',
      userId: usuarioId,
      entity: 'divida',
      entityId: debt.id,
      message: 'Divida desativada com sucesso.',
      details: {
        valorTotal: debt.montoTotal,
      },
    });
  }

  private getChangedFields(dto: UpdateDividaDto): string[] {
    return Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
  }
}
