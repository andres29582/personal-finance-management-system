import { Injectable } from '@nestjs/common';
import { resolveMonthRange } from '../common/date-range.util';
import { toNumber } from '../common/number.util';
import { Conta } from '../contas/entities/conta.entity';
import { ContasService } from '../contas/contas.service';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { GetDashboardDto } from './dto/get-dashboard.dto';
import { DashboardRepository } from './repositories/dashboard.repository';

@Injectable()
export class DashboardService {
  constructor(
    private readonly contasService: ContasService,
    private readonly dashboardRepository: DashboardRepository,
  ) {}

  async getDashboard(usuarioId: string, query: GetDashboardDto) {
    const periodRange = resolveMonthRange(query.mes);
    const previousPeriodRange = resolvePreviousMonthRange(periodRange.label);
    const [
      contas,
      transacoesPeriodo,
      transacoesPeriodoAnterior,
      transacoesRecentes,
      categorias,
    ] = await Promise.all([
        this.contasService.findAll(usuarioId),
        this.dashboardRepository.findTransactionsByPeriod(
          usuarioId,
          periodRange.startDate,
          periodRange.endDate,
        ),
        this.dashboardRepository.findTransactionsByPeriod(
          usuarioId,
          previousPeriodRange.startDate,
          previousPeriodRange.endDate,
        ),
        this.dashboardRepository.findRecentTransactions(usuarioId, 5),
        this.dashboardRepository.findCategoriesByUser(usuarioId),
      ]);

    const categoriasById = new Map(
      categorias.map((categoria) => [categoria.id, categoria]),
    );
    const contasById = new Map(contas.map((conta) => [conta.id, conta]));
    const totalReceitas = sumTransactionsByType(
      transacoesPeriodo,
      TipoTransacao.RECEITA,
    );
    const totalDespesas = sumTransactionsByType(
      transacoesPeriodo,
      TipoTransacao.DESPESA,
    );
    const totalReceitasAnterior = sumTransactionsByType(
      transacoesPeriodoAnterior,
      TipoTransacao.RECEITA,
    );
    const totalDespesasAnterior = sumTransactionsByType(
      transacoesPeriodoAnterior,
      TipoTransacao.DESPESA,
    );
    const gastosPorCategoriaMap = new Map<
      string,
      { categoriaId: string; categoriaNome: string; total: number }
    >();

    for (const transacao of transacoesPeriodo) {
      if (transacao.tipo !== TipoTransacao.DESPESA) {
        continue;
      }

      const categoria = categoriasById.get(transacao.categoriaId);
      const currentEntry = gastosPorCategoriaMap.get(transacao.categoriaId);
      const total = (currentEntry?.total ?? 0) + toNumber(transacao.valor);

      gastosPorCategoriaMap.set(transacao.categoriaId, {
        categoriaId: transacao.categoriaId,
        categoriaNome: categoria?.nome ?? 'Sem categoria',
        total,
      });
    }

    const gastosPorCategoria = [...gastosPorCategoriaMap.values()]
      .sort((leftItem, rightItem) => rightItem.total - leftItem.total)
      .map((entry) => ({
        ...entry,
        percentual:
          totalDespesas > 0
            ? Number(((entry.total / totalDespesas) * 100).toFixed(2))
            : 0,
      }));

    const transacoesRecentesEnriquecidas = transacoesRecentes.map(
      (transacao) => {
        const conta = contasById.get(transacao.contaId);
        const categoria = categoriasById.get(transacao.categoriaId);

        return {
          categoriaId: transacao.categoriaId,
          categoriaNome: categoria?.nome ?? 'Sem categoria',
          contaId: transacao.contaId,
          contaNome: conta?.nome ?? 'Conta',
          data: transacao.data,
          descricao: transacao.descricao,
          id: transacao.id,
          tipo: transacao.tipo,
          valor: toNumber(transacao.valor),
        };
      },
    );

    const saldoTotal = contas.reduce(
      (sum, conta) =>
        sum + toNumber((conta as Conta & { saldoAtual?: number }).saldoAtual),
      0,
    );

    return {
      contas: contas.map((conta) => ({
        id: conta.id,
        moeda: conta.moeda,
        nome: conta.nome,
        saldoAtual: toNumber(
          (conta as Conta & { saldoAtual?: number }).saldoAtual,
        ),
        tipo: conta.tipo,
      })),
      comparativoMensal: {
        despesas: buildMonthlyComparison(totalDespesas, totalDespesasAnterior),
        mesAnterior: previousPeriodRange.label,
        mesAtual: periodRange.label,
        receitas: buildMonthlyComparison(totalReceitas, totalReceitasAnterior),
      },
      despesasMes: totalDespesas,
      economiaMes: totalReceitas - totalDespesas,
      gastosPorCategoria,
      mesReferencia: periodRange.label,
      receitasMes: totalReceitas,
      saldoTotal,
      totalContas: contas.length,
      transacoesRecentes: transacoesRecentesEnriquecidas,
    };
  }
}

function resolvePreviousMonthRange(monthReference: string) {
  const [year, month] = monthReference.split('-').map(Number);
  const previousMonthDate = new Date(Date.UTC(year, month - 2, 1));
  const previousMonthReference = previousMonthDate.toISOString().slice(0, 7);

  return resolveMonthRange(previousMonthReference);
}

function sumTransactionsByType(
  transactions: Array<{
    tipo: TipoTransacao;
    valor: number | string | null | undefined;
  }>,
  type: TipoTransacao,
) {
  return transactions
    .filter((transacao) => transacao.tipo === type)
    .reduce((sum, transacao) => sum + toNumber(transacao.valor), 0);
}

function buildMonthlyComparison(currentValue: number, previousValue: number) {
  const diferenca = currentValue - previousValue;

  return {
    atual: currentValue,
    anterior: previousValue,
    diferenca,
    percentual:
      previousValue > 0
        ? Number(((diferenca / previousValue) * 100).toFixed(2))
        : currentValue > 0
          ? 100
          : 0,
  };
}
