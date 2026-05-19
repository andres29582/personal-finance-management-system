import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AppConflictException,
  ResourceNotFoundException,
} from '../common/exceptions';
import { assertPositiveFinancialValue } from '../common/financial-validation.util';
import { resolveMonthRange } from '../common/date-range.util';
import { toNumber } from '../common/number.util';
import { CreateOrcamentoDto } from './dto/create-orcamento.dto';
import { FindOrcamentosDto } from './dto/find-orcamentos.dto';
import { UpdateOrcamentoDto } from './dto/update-orcamento.dto';
import { Orcamento } from './entities/orcamento.entity';
import { LogsService } from '../logs/logs.service';
import { OrcamentoRepository } from './repositories/orcamento.repository';

@Injectable()
export class OrcamentosService {
  constructor(
    private readonly orcamentoRepository: OrcamentoRepository,
    private readonly logsService: LogsService,
  ) {}

  async create(usuarioId: string, dto: CreateOrcamentoDto) {
    assertPositiveFinancialValue(dto.valorPlanejado, 'Valor planejado');
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

    const budget = await this.orcamentoRepository.create({
      id: randomUUID(),
      usuarioId,
      ...dto,
    });

    const created = await this.findOne(budget.id, usuarioId);
    await this.logsService.logEntityEvent({
      event: 'ORCAMENTO_CREATED',
      module: 'orcamentos',
      action: 'create',
      userId: usuarioId,
      entity: 'orcamento',
      entityId: budget.id,
      message: 'Orcamento criado com sucesso.',
      details: { mesReferencia: dto.mesReferencia },
    });
    return created;
  }

  async findAll(usuarioId: string, query: FindOrcamentosDto) {
    const budgets = query.ano
      ? await this.orcamentoRepository.findByUserAndYear(usuarioId, query.ano)
      : await this.orcamentoRepository.findByUser(usuarioId);

    return Promise.all(
      budgets.map((budget) => this.enrichBudgetWithProgress(budget, usuarioId)),
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

    return this.enrichBudgetWithProgress(budget, usuarioId);
  }

  async update(id: string, usuarioId: string, dto: UpdateOrcamentoDto) {
    await this.findOne(id, usuarioId);
    if (dto.valorPlanejado !== undefined) {
      assertPositiveFinancialValue(dto.valorPlanejado, 'Valor planejado');
    }
    await this.orcamentoRepository.updateByIdAndUser(id, usuarioId, dto);
    const updated = await this.findOne(id, usuarioId);
    await this.logsService.logEntityEvent({
      event: 'ORCAMENTO_UPDATED',
      module: 'orcamentos',
      action: 'update',
      userId: usuarioId,
      entity: 'orcamento',
      entityId: id,
      message: 'Orcamento atualizado com sucesso.',
    });
    return updated;
  }

  private async enrichBudgetWithProgress(
    orcamento: Orcamento,
    usuarioId: string,
  ) {
    const monthRange = resolveMonthRange(orcamento.mesReferencia);
    const expenseTransactions =
      await this.orcamentoRepository.findExpenseTransactionsByPeriod(
        usuarioId,
        monthRange.startDate,
        monthRange.endDate,
      );
    const gastoAtual = expenseTransactions.reduce(
      (sum, transaction) => sum + toNumber(transaction.valor),
      0,
    );
    const valorPlanejado = toNumber(orcamento.valorPlanejado);
    const percentualUtilizado =
      valorPlanejado > 0
        ? Number(((gastoAtual / valorPlanejado) * 100).toFixed(2))
        : gastoAtual > 0
          ? 100
          : 0;
    const statusAlerta =
      percentualUtilizado >= 100
        ? 'estourado'
        : percentualUtilizado >= 80
          ? 'alerta_80'
          : 'normal';

    return {
      ...orcamento,
      gastoAtual,
      percentualUtilizado,
      restante: Math.max(valorPlanejado - gastoAtual, 0),
      statusAlerta,
      valorPlanejado,
    };
  }
}
