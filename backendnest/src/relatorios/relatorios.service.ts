import { Injectable } from '@nestjs/common';
import {
  resolveCustomRange,
  resolveMonthRange,
  resolveQuarterRange,
} from '../common/date-range.util';
import { toNumber } from '../common/number.util';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { GetRelatorioDto } from './dto/get-relatorio.dto';
import { PeriodoRelatorio } from './enums/periodo-relatorio.enum';
import { RelatorioRepository } from './repositories/relatorio.repository';

@Injectable()
export class RelatoriosService {
  constructor(private readonly relatorioRepository: RelatorioRepository) {}

  async getRelatorio(usuarioId: string, query: GetRelatorioDto) {
    const dateRange = this.resolveDateRange(query);
    const transacoes = await this.relatorioRepository.findTransactionsByPeriod(
      usuarioId,
      dateRange.startDate,
      dateRange.endDate,
    );
    const filteredTransactions = transacoes.filter((transaction) => {
      if (query.tipo && transaction.tipo !== query.tipo) {
        return false;
      }

      if (query.contaId && transaction.contaId !== query.contaId) {
        return false;
      }

      if (query.categoriaId && transaction.categoriaId !== query.categoriaId) {
        return false;
      }

      return true;
    });
    const [categorias, contas] = await Promise.all([
      this.relatorioRepository.findCategoriesByUser(usuarioId),
      this.relatorioRepository.findAccountsByUser(usuarioId),
    ]);
    const categoriasById = new Map(
      categorias.map((categoria) => [categoria.id, categoria]),
    );
    const contasById = new Map(contas.map((conta) => [conta.id, conta]));
    const totalReceitas = filteredTransactions
      .filter((transaction) => transaction.tipo === TipoTransacao.RECEITA)
      .reduce((sum, transaction) => sum + toNumber(transaction.valor), 0);
    const totalDespesas = filteredTransactions
      .filter((transaction) => transaction.tipo === TipoTransacao.DESPESA)
      .reduce((sum, transaction) => sum + toNumber(transaction.valor), 0);
    const despesasPorCategoriaMap = new Map<
      string,
      { categoriaId: string; categoriaNome: string; total: number }
    >();

    for (const transaction of filteredTransactions) {
      if (transaction.tipo !== TipoTransacao.DESPESA) {
        continue;
      }

      const categoria = categoriasById.get(transaction.categoriaId);
      const currentValue = despesasPorCategoriaMap.get(transaction.categoriaId);

      despesasPorCategoriaMap.set(transaction.categoriaId, {
        categoriaId: transaction.categoriaId,
        categoriaNome: categoria?.nome ?? 'Sem categoria',
        total: (currentValue?.total ?? 0) + toNumber(transaction.valor),
      });
    }

    const despesasPorCategoria = [...despesasPorCategoriaMap.values()]
      .sort((leftItem, rightItem) => rightItem.total - leftItem.total)
      .map((entry) => ({
        ...entry,
        percentual:
          totalDespesas > 0
            ? Number(((entry.total / totalDespesas) * 100).toFixed(2))
            : 0,
      }));

    const transactionsTable = filteredTransactions.map((transaction) => ({
      categoriaId: transaction.categoriaId,
      categoriaNome:
        categoriasById.get(transaction.categoriaId)?.nome ?? 'Sem categoria',
      contaId: transaction.contaId,
      contaNome: contasById.get(transaction.contaId)?.nome ?? 'Conta',
      data: transaction.data,
      descricao: transaction.descricao,
      id: transaction.id,
      tipo: transaction.tipo,
      valor: toNumber(transaction.valor),
    }));

    return {
      despesasPorCategoria,
      periodo: query.periodo,
      periodoReferencia: dateRange.label,
      resumo: {
        economia: totalReceitas - totalDespesas,
        totalDespesas,
        totalReceitas,
        totalTransacoes: filteredTransactions.length,
      },
      transacoes: transactionsTable,
    };
  }

  private resolveDateRange(query: GetRelatorioDto) {
    switch (query.periodo) {
      case PeriodoRelatorio.MENSAL:
        return resolveMonthRange(query.mes);
      case PeriodoRelatorio.TRIMESTRAL:
        return resolveQuarterRange(Number(query.ano), Number(query.trimestre));
      case PeriodoRelatorio.INTERVALO:
      default:
        return resolveCustomRange(query.dataInicio ?? '', query.dataFim ?? '');
    }
  }
}
