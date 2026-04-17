import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { resolveMonthRange } from '../common/date-range.util';
import { toNumber } from '../common/number.util';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { CreateOrcamentoDto } from './dto/create-orcamento.dto';
import { FindOrcamentosDto } from './dto/find-orcamentos.dto';
import { UpdateOrcamentoDto } from './dto/update-orcamento.dto';
import { Orcamento } from './entities/orcamento.entity';

@Injectable()
export class OrcamentosService {
  constructor(
    @InjectRepository(Orcamento)
    private readonly orcamentosRepository: Repository<Orcamento>,
    @InjectRepository(Transacao)
    private readonly transacoesRepository: Repository<Transacao>,
  ) {}

  async create(usuarioId: string, dto: CreateOrcamentoDto) {
    const existingBudget = await this.orcamentosRepository.findOneBy({
      usuarioId,
      mesReferencia: dto.mesReferencia,
    });

    if (existingBudget) {
      throw new ConflictException(
        'Ja existe um orcamento cadastrado para este mes.',
      );
    }

    const budget = this.orcamentosRepository.create({
      id: randomUUID(),
      usuarioId,
      ...dto,
    });

    await this.orcamentosRepository.save(budget);

    return this.findOne(budget.id, usuarioId);
  }

  async findAll(usuarioId: string, query: FindOrcamentosDto) {
    const where = query.ano
      ? {
          usuarioId,
          mesReferencia: Between(`${query.ano}-01`, `${query.ano}-12`),
        }
      : { usuarioId };

    const budgets = await this.orcamentosRepository.find({
      where,
      order: { mesReferencia: 'ASC' },
    });

    return Promise.all(
      budgets.map((budget) => this.enrichBudgetWithProgress(budget, usuarioId)),
    );
  }

  async findOne(id: string, usuarioId: string) {
    const budget = await this.orcamentosRepository.findOneBy({ id, usuarioId });

    if (!budget) {
      throw new NotFoundException('Orcamento nao encontrado.');
    }

    return this.enrichBudgetWithProgress(budget, usuarioId);
  }

  async update(id: string, usuarioId: string, dto: UpdateOrcamentoDto) {
    await this.findOne(id, usuarioId);
    await this.orcamentosRepository.update(id, dto);
    return this.findOne(id, usuarioId);
  }

  private async enrichBudgetWithProgress(
    orcamento: Orcamento,
    usuarioId: string,
  ) {
    const monthRange = resolveMonthRange(orcamento.mesReferencia);
    const expenseTransactions = await this.transacoesRepository.find({
      where: {
        usuarioId,
        tipo: TipoTransacao.DESPESA,
        data: Between(monthRange.startDate, monthRange.endDate),
      },
    });
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
