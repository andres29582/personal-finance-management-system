import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Between, IsNull, Repository } from 'typeorm';
import { resolveMonthRange } from '../common/date-range.util';
import { notSoftDeleted } from '../common/soft-delete.query';
import { Transacao } from './entities/transacao.entity';
import { CreateTransacaoDto } from './dto/create-transacao.dto';
import { FindTransacoesDto } from './dto/find-transacoes.dto';
import { UpdateTransacaoDto } from './dto/update-transacao.dto';
import { ContasService } from '../contas/contas.service';
import { CategoriasService } from '../categorias/categorias.service';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class TransacoesService {
  constructor(
    @InjectRepository(Transacao)
    private readonly transacoesRepository: Repository<Transacao>,
    private readonly contasService: ContasService,
    private readonly categoriasService: CategoriasService,
    private readonly logsService: LogsService,
  ) {}

  async create(usuarioId: string, dto: CreateTransacaoDto): Promise<Transacao> {
    await this.contasService.findOne(dto.contaId, usuarioId);
    const categoria = await this.categoriasService.findOne(
      dto.categoriaId,
      usuarioId,
    );

    this.ensureCategoryMatchesTransactionType(categoria.tipo, dto.tipo);

    const transacao = this.transacoesRepository.create({
      id: randomUUID(),
      usuarioId,
      ...dto,
    });
    const savedTransaction = await this.transacoesRepository.save(transacao);

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
    const whereClause: Record<string, unknown> = { usuarioId };

    if (query.mes) {
      const monthRange = resolveMonthRange(query.mes);
      whereClause.data = Between(monthRange.startDate, monthRange.endDate);
    }

    if (query.tipo) {
      whereClause.tipo = query.tipo;
    }

    if (query.contaId) {
      whereClause.contaId = query.contaId;
    }

    if (query.categoriaId) {
      whereClause.categoriaId = query.categoriaId;
    }

    return this.transacoesRepository.find({
      where: { ...whereClause, ...notSoftDeleted },
      order: { data: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string, usuarioId: string): Promise<Transacao> {
    const transacao = await this.transacoesRepository.findOneBy({
      id,
      usuarioId,
      excluidoEm: IsNull(),
    });
    if (!transacao) {
      throw new NotFoundException('Transação não encontrada');
    }
    return transacao;
  }

  async update(
    id: string,
    usuarioId: string,
    dto: UpdateTransacaoDto,
  ): Promise<Transacao> {
    const currentTransaction = await this.findOne(id, usuarioId);

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

    await this.transacoesRepository.update(id, dto);
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
    await this.transacoesRepository.update(
      { id, usuarioId },
      { excluidoEm: new Date() },
    );
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
      throw new BadRequestException(
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
