import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BusinessRuleException,
  ResourceNotFoundException,
} from '../common/exceptions';
import { assertPositiveFinancialValue } from '../common/financial-validation.util';
import { Transacao } from './entities/transacao.entity';
import { CreateTransacaoDto } from './dto/create-transacao.dto';
import { FindTransacoesDto } from './dto/find-transacoes.dto';
import { UpdateTransacaoDto } from './dto/update-transacao.dto';
import { ContasService } from '../contas/contas.service';
import { CategoriasService } from '../categorias/categorias.service';
import { LogsService } from '../logs/logs.service';
import { TransacaoRepository } from './repositories/transacao.repository';

@Injectable()
export class TransacoesService {
  constructor(
    private readonly transacaoRepository: TransacaoRepository,
    private readonly contasService: ContasService,
    private readonly categoriasService: CategoriasService,
    private readonly logsService: LogsService,
  ) {}

  async create(usuarioId: string, dto: CreateTransacaoDto): Promise<Transacao> {
    assertPositiveFinancialValue(dto.valor, 'Valor da transacao');
    await this.contasService.findOne(dto.contaId, usuarioId);
    const categoria = await this.categoriasService.findOne(
      dto.categoriaId,
      usuarioId,
    );

    this.ensureCategoryMatchesTransactionType(categoria.tipo, dto.tipo);

    const savedTransaction = await this.transacaoRepository.create({
      id: randomUUID(),
      usuarioId,
      ...dto,
    });

    await this.logsService.logEntityEvent({
      event: 'TRANSACAO_CREATED',
      module: 'transacoes',
      action: 'create',
      userId: usuarioId,
      entity: 'transacao',
      entityId: savedTransaction.id,
      message: 'Transacao criada com sucesso.',
      details: {
        contaId: savedTransaction.contaId,
        categoriaId: savedTransaction.categoriaId,
        tipo: savedTransaction.tipo,
        valor: savedTransaction.valor,
      },
    });

    return savedTransaction;
  }

  async findAll(
    usuarioId: string,
    query: FindTransacoesDto,
  ): Promise<Transacao[]> {
    return this.transacaoRepository.findByUser(usuarioId, query);
  }

  async findOne(id: string, usuarioId: string): Promise<Transacao> {
    const transacao = await this.transacaoRepository.findByIdAndUser(
      id,
      usuarioId,
    );
    if (!transacao) {
      throw new ResourceNotFoundException(
        'TRANSACAO_NOT_FOUND',
        'Transação não encontrada',
      );
    }
    return transacao;
  }

  async update(
    id: string,
    usuarioId: string,
    dto: UpdateTransacaoDto,
  ): Promise<Transacao> {
    const currentTransaction = await this.findOne(id, usuarioId);

    if (dto.valor !== undefined) {
      assertPositiveFinancialValue(dto.valor, 'Valor da transacao');
    }

    if (dto.contaId) {
      await this.contasService.findOne(dto.contaId, usuarioId);
    }
    const updatedCategoryId = dto.categoriaId ?? currentTransaction.categoriaId;
    const updatedType = dto.tipo ?? currentTransaction.tipo;
    const categoria = await this.categoriasService.findOne(
      updatedCategoryId,
      usuarioId,
    );

    this.ensureCategoryMatchesTransactionType(categoria.tipo, updatedType);

    await this.transacaoRepository.updateByIdAndUser(id, usuarioId, dto);
    const updatedTransaction = await this.findOne(id, usuarioId);

    await this.logsService.logEntityEvent({
      event: 'TRANSACAO_UPDATED',
      module: 'transacoes',
      action: 'update',
      userId: usuarioId,
      entity: 'transacao',
      entityId: updatedTransaction.id,
      message: 'Transacao atualizada com sucesso.',
      details: {
        changedFields: this.getChangedFields(dto),
      },
    });

    return updatedTransaction;
  }

  async remove(id: string, usuarioId: string): Promise<void> {
    const transaction = await this.findOne(id, usuarioId);
    await this.transacaoRepository.softDeleteByIdAndUser(id, usuarioId);
    await this.logsService.logEntityEvent({
      event: 'TRANSACAO_SOFT_DELETED',
      module: 'transacoes',
      action: 'delete',
      userId: usuarioId,
      entity: 'transacao',
      entityId: transaction.id,
      message: 'Transacao excluida logicamente com sucesso.',
      details: {
        contaId: transaction.contaId,
        categoriaId: transaction.categoriaId,
        tipo: transaction.tipo,
        valor: transaction.valor,
      },
    });
  }

  private ensureCategoryMatchesTransactionType(
    categoryType: string,
    transactionType: string,
  ): void {
    if (categoryType !== transactionType) {
      throw new BusinessRuleException(
        'TRANSACAO_CATEGORY_TYPE_MISMATCH',
        'O tipo da categoria precisa coincidir com o tipo da transacao.',
      );
    }
  }

  private getChangedFields(dto: UpdateTransacaoDto): string[] {
    return Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
  }
}
