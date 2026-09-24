import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { CategoriasService } from '../categorias/categorias.service';
import { TipoCategoria } from '../categorias/enums/tipo-categoria.enum';
import {
  AppConflictException,
  BusinessRuleException,
  ResourceNotFoundException,
} from '../common/exceptions';
import { assertPositiveFinancialValue } from '../common/financial-validation.util';
import { normalizeMonthReference } from '../common/date-range.util';
import { toNumber } from '../common/number.util';
import { CreateOrcamentoDto } from './dto/create-orcamento.dto';
import { FindOrcamentosDto } from './dto/find-orcamentos.dto';
import { UpdateOrcamentoDto } from './dto/update-orcamento.dto';
import { CreateOrcamentoCategoriaDto } from './dto/create-orcamento-categoria.dto';
import { UpdateOrcamentoCategoriaDto } from './dto/update-orcamento-categoria.dto';
import { Orcamento } from './entities/orcamento.entity';
import { OrcamentoCategoria } from './entities/orcamento-categoria.entity';
import { LogsService } from '../logs/logs.service';
import { OrcamentoRepository } from './repositories/orcamento.repository';

@Injectable()
export class OrcamentosService {
  constructor(
    private readonly orcamentoRepository: OrcamentoRepository,
    private readonly categoriasService: CategoriasService,
    private readonly dataSource: DataSource,
    private readonly logsService: LogsService,
  ) {}

  async create(usuarioId: string, dto: CreateOrcamentoDto) {
    assertPositiveFinancialValue(dto.valorPlanejado, 'Valor planejado');
    normalizeMonthReference(dto.mesReferencia);
    const existingBudget = await this.orcamentoRepository.findByUserAndMonth(
      usuarioId,
      dto.mesReferencia,
    );

    if (existingBudget) {
      throw new AppConflictException(
        'ORCAMENTO_ALREADY_EXISTS',
        'Ja existe um orcamento cadastrado para este mes.',
      );
    }

    try {
      const budget = await this.dataSource.transaction(async (manager) => {
        const created = await manager.save(
          manager.create(Orcamento, {
            id: randomUUID(),
            usuarioId,
            ...dto,
          }),
        );
        await this.logsService.logEntityEventTransactional(
          {
            event: 'ORCAMENTO_CREATED',
            module: 'orcamentos',
            action: 'create',
            userId: usuarioId,
            entity: 'orcamento',
            entityId: created.id,
            message: 'Orcamento criado com sucesso.',
            details: { mesReferencia: dto.mesReferencia },
          },
          manager,
        );
        return created;
      });

      return this.findOne(budget.id, usuarioId);
    } catch (error) {
      if (this.isDuplicateBudgetError(error)) {
        throw new AppConflictException(
          'ORCAMENTO_ALREADY_EXISTS',
          'Ja existe um orcamento cadastrado para este mes.',
        );
      }
      throw error;
    }
  }

  async findAll(usuarioId: string, query: FindOrcamentosDto) {
    const budgets = query.ano
      ? await this.orcamentoRepository.findByUserAndYear(usuarioId, query.ano)
      : await this.orcamentoRepository.findByUser(usuarioId);
    const expenseTotals =
      await this.orcamentoRepository.findExpenseTotalsByMonths(
        usuarioId,
        budgets.map((budget) => budget.mesReferencia),
      );

    return budgets.map((budget) =>
      this.enrichBudgetWithProgress(budget, expenseTotals),
    );
  }

  async findOne(id: string, usuarioId: string) {
    const budget = await this.orcamentoRepository.findByIdAndUser(
      id,
      usuarioId,
    );

    if (!budget) {
      throw new ResourceNotFoundException(
        'ORCAMENTO_NOT_FOUND',
        'Orcamento nao encontrado.',
      );
    }

    const expenseTotals =
      await this.orcamentoRepository.findExpenseTotalsByMonths(usuarioId, [
        budget.mesReferencia,
      ]);
    return this.enrichBudgetWithProgress(budget, expenseTotals);
  }

  async update(id: string, usuarioId: string, dto: UpdateOrcamentoDto) {
    const valorPlanejado = dto.valorPlanejado;
    if (valorPlanejado === undefined) {
      throw new BusinessRuleException(
        'ORCAMENTO_UPDATE_REQUIRES_VALUE',
        'Informe um valor planejado para atualizar o orcamento.',
        { field: 'valorPlanejado' },
      );
    }

    assertPositiveFinancialValue(valorPlanejado, 'Valor planejado');
    await this.dataSource.transaction(async (manager) => {
      const budget = await this.findOneForWrite(id, usuarioId, manager);
      this.assertMutable(budget);
      await this.assertAllocationTotalWithinBudget(id, valorPlanejado, manager);
      await manager.update(Orcamento, { id, usuarioId }, { valorPlanejado });
      await this.logsService.logEntityEventTransactional(
        {
          event: 'ORCAMENTO_UPDATED',
          module: 'orcamentos',
          action: 'update',
          userId: usuarioId,
          entity: 'orcamento',
          entityId: id,
          message: 'Orcamento atualizado com sucesso.',
        },
        manager,
      );
    });
    const updated = await this.findOne(id, usuarioId);
    return updated;
  }

  async createAllocation(
    id: string,
    usuarioId: string,
    dto: CreateOrcamentoCategoriaDto,
  ): Promise<OrcamentoCategoria> {
    assertPositiveFinancialValue(dto.valorPlanejado, 'Valor planejado');
    return this.dataSource.transaction(async (manager) => {
      const budget = await this.findOneForWrite(id, usuarioId, manager);
      this.assertMutable(budget);
      const categoria = await this.categoriasService.findActiveForWrite(
        dto.categoriaId,
        usuarioId,
        manager,
      );
      if (categoria.tipo !== TipoCategoria.DESPESA) {
        throw new BusinessRuleException(
          'ORCAMENTO_CATEGORIA_MUST_BE_EXPENSE',
          'A categoria do orcamento deve ser do tipo despesa.',
        );
      }
      const allocationRepository = manager.getRepository(OrcamentoCategoria);
      const existing = await allocationRepository.findOneBy({
        orcamentoId: id,
        categoriaId: dto.categoriaId,
      });
      if (existing) {
        throw new AppConflictException(
          'ORCAMENTO_CATEGORIA_ALREADY_EXISTS',
          'Ja existe uma alocacao para esta categoria.',
        );
      }
      await this.assertAllocationTotalWithinBudget(
        id,
        budget.valorPlanejado,
        manager,
        dto.valorPlanejado,
      );
      const allocation = await allocationRepository.save(
        allocationRepository.create({
          id: randomUUID(),
          orcamentoId: id,
          categoriaId: dto.categoriaId,
          valorPlanejado: dto.valorPlanejado,
        }),
      );
      await this.logsService.logEntityEventTransactional(
        {
          event: 'ORCAMENTO_CATEGORIA_CREATED',
          module: 'orcamentos',
          action: 'create',
          userId: usuarioId,
          entity: 'orcamento_categoria',
          entityId: allocation.id,
          message: 'Alocacao de categoria criada com sucesso.',
          details: { categoriaId: dto.categoriaId, orcamentoId: id },
        },
        manager,
      );
      return allocation;
    });
  }

  async updateAllocation(
    id: string,
    allocationId: string,
    usuarioId: string,
    dto: UpdateOrcamentoCategoriaDto,
  ): Promise<OrcamentoCategoria> {
    if (dto.valorPlanejado === undefined) {
      throw new BusinessRuleException(
        'ORCAMENTO_CATEGORIA_UPDATE_REQUIRES_VALUE',
        'Informe um valor planejado para atualizar a alocacao.',
        { field: 'valorPlanejado' },
      );
    }
    const valorPlanejado = dto.valorPlanejado;
    assertPositiveFinancialValue(valorPlanejado, 'Valor planejado');
    return this.dataSource.transaction(async (manager) => {
      const budget = await this.findOneForWrite(id, usuarioId, manager);
      this.assertMutable(budget);
      const allocationRepository = manager.getRepository(OrcamentoCategoria);
      const allocation = await allocationRepository.findOneBy({
        id: allocationId,
        orcamentoId: id,
      });
      if (!allocation) {
        throw new ResourceNotFoundException(
          'ORCAMENTO_CATEGORIA_NOT_FOUND',
          'Alocacao de categoria nao encontrada.',
        );
      }
      await this.assertAllocationTotalWithinBudget(
        id,
        budget.valorPlanejado,
        manager,
        valorPlanejado - toNumber(allocation.valorPlanejado),
      );
      allocation.valorPlanejado = valorPlanejado;
      const updated = await allocationRepository.save(allocation);
      await this.logsService.logEntityEventTransactional(
        {
          event: 'ORCAMENTO_CATEGORIA_UPDATED',
          module: 'orcamentos',
          action: 'update',
          userId: usuarioId,
          entity: 'orcamento_categoria',
          entityId: updated.id,
          message: 'Alocacao de categoria atualizada com sucesso.',
        },
        manager,
      );
      return updated;
    });
  }

  async removeAllocation(
    id: string,
    allocationId: string,
    usuarioId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const budget = await this.findOneForWrite(id, usuarioId, manager);
      this.assertMutable(budget);
      const allocationRepository = manager.getRepository(OrcamentoCategoria);
      const allocation = await allocationRepository.findOneBy({
        id: allocationId,
        orcamentoId: id,
      });
      if (!allocation) {
        throw new ResourceNotFoundException(
          'ORCAMENTO_CATEGORIA_NOT_FOUND',
          'Alocacao de categoria nao encontrada.',
        );
      }
      await allocationRepository.remove(allocation);
      await this.logsService.logEntityEventTransactional(
        {
          event: 'ORCAMENTO_CATEGORIA_DELETED',
          module: 'orcamentos',
          action: 'delete',
          userId: usuarioId,
          entity: 'orcamento_categoria',
          entityId: allocation.id,
          message: 'Alocacao de categoria removida com sucesso.',
        },
        manager,
      );
    });
  }

  private async findOneForWrite(
    id: string,
    usuarioId: string,
    manager: EntityManager,
  ): Promise<Orcamento> {
    const budget = await manager.findOne(Orcamento, {
      where: { id, usuarioId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!budget) {
      throw new ResourceNotFoundException(
        'ORCAMENTO_NOT_FOUND',
        'Orcamento nao encontrado.',
      );
    }
    return budget;
  }

  private assertMutable(budget: Orcamento): void {
    if (budget.mesReferencia < normalizeMonthReference()) {
      throw new BusinessRuleException(
        'ORCAMENTO_PAST_MONTH_IMMUTABLE',
        'Orcamentos de meses anteriores nao podem ser alterados.',
      );
    }
  }

  private async assertAllocationTotalWithinBudget(
    orcamentoId: string,
    budgetValue: number | string,
    manager: EntityManager,
    delta = 0,
  ): Promise<void> {
    const result = await manager
      .getRepository(OrcamentoCategoria)
      .createQueryBuilder('allocation')
      .select('COALESCE(SUM(allocation.valorPlanejado), 0)', 'total')
      .where('allocation.orcamentoId = :orcamentoId', { orcamentoId })
      .getRawOne<{ total: string }>();
    const total = result?.total ?? '0';
    if (toNumber(total) + delta > toNumber(budgetValue)) {
      throw new BusinessRuleException(
        'ORCAMENTO_CATEGORIA_TOTAL_EXCEEDS_BUDGET',
        'A soma das alocacoes por categoria nao pode exceder o valor planejado.',
      );
    }
  }

  private enrichBudgetWithProgress(
    orcamento: Orcamento,
    expenseTotals: Array<{
      mesReferencia: string;
      categoriaId: string;
      gastoAtual: string;
    }>,
  ) {
    const monthlyTotals = expenseTotals.filter(
      (total) => total.mesReferencia === orcamento.mesReferencia,
    );
    const gastoAtual = monthlyTotals.reduce(
      (sum, total) => sum + toNumber(total.gastoAtual),
      0,
    );
    const valorPlanejado = toNumber(orcamento.valorPlanejado);
    const progress = this.calculateProgress(valorPlanejado, gastoAtual);

    return {
      ...orcamento,
      ...progress,
      valorPlanejado,
      alocacoes: orcamento.alocacoes?.map((allocation) => ({
        ...allocation,
        valorPlanejado: toNumber(allocation.valorPlanejado),
        ...this.calculateProgress(
          toNumber(allocation.valorPlanejado),
          toNumber(
            monthlyTotals.find(
              (total) => total.categoriaId === allocation.categoriaId,
            )?.gastoAtual ?? '0',
          ),
        ),
      })),
    };
  }

  private calculateProgress(valorPlanejado: number, gastoAtual: number) {
    const percentualUtilizado =
      valorPlanejado > 0
        ? Number(((gastoAtual / valorPlanejado) * 100).toFixed(2))
        : gastoAtual > 0
          ? 100
          : 0;

    return {
      gastoAtual,
      percentualUtilizado,
      restante: valorPlanejado - gastoAtual,
      statusAlerta:
        percentualUtilizado >= 100
          ? 'estourado'
          : percentualUtilizado >= 80
            ? 'alerta_80'
            : 'normal',
    };
  }

  private isDuplicateBudgetError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string; constraint?: string }).code === '23505' &&
      (error as { constraint?: string }).constraint ===
        'uq_orcamento_usuario_mes'
    );
  }
}
