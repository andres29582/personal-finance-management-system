import { Injectable } from '@nestjs/common';
import { ValidationAppException } from '../../common/exceptions';
import { toNumber } from '../../common/number.util';
import { Conta } from '../../contas/entities/conta.entity';
import { Transacao } from '../../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../../transacoes/enums/tipo-transacao.enum';
import { Transferencia } from '../../transferencias/entities/transferencia.entity';
import {
  ML_MINIMUM_HISTORY_MONTHS,
  ML_PREDICTION_SCHEMA_VERSION,
} from '../constants/ml-prediction-contract';
import { PrevisaoRepository } from '../repositories/previsao.repository';
import type { DeficitFeatures } from '../types/deficit-features.type';

type MonthlyAggregate = {
  despesas: number;
  mes: string;
  numDespesas: number;
  numReceitas: number;
  receitas: number;
};

export type BuildDeficitFeaturesResult = {
  features: DeficitFeatures;
  indicadores: {
    historicoMeses: number;
    saldoInicialMes: number;
    mediaReceitas3Meses: number;
    mediaDespesas3Meses: number;
    tendenciaReceitas3Meses: number;
    tendenciaDespesas3Meses: number;
    taxaDeficit3Meses: number;
  };
  mesReferencia: string;
  schemaVersion: typeof ML_PREDICTION_SCHEMA_VERSION;
};

@Injectable()
export class DeficitFeaturesService {
  constructor(private readonly previsaoRepository: PrevisaoRepository) {}

  async build(
    usuarioId: string,
    mes?: string,
  ): Promise<BuildDeficitFeaturesResult> {
    const target = this.resolveTargetMonth(mes);
    const user = await this.previsaoRepository.findUserById(usuarioId);
    if (!user) {
      throw new ValidationAppException(
        'PREVISAO_USER_NOT_FOUND',
        'Usuario nao encontrado para gerar a previsao.',
      );
    }

    const monthStarts = this.previousMonthStarts(target.start);
    const completeMonths = monthStarts.filter(
      (start) => user.dataRegistro.getTime() <= start.getTime(),
    );
    if (completeMonths.length < ML_MINIMUM_HISTORY_MONTHS) {
      throw new ValidationAppException(
        'PREVISAO_INSUFFICIENT_HISTORY',
        'Sao necessarios tres meses completos de historico para gerar a previsao.',
        {
          details: {
            requiredMonths: ML_MINIMUM_HISTORY_MONTHS,
            availableMonths: completeMonths.length,
          },
        },
      );
    }

    const historyStart = this.formatDate(monthStarts[0]);
    const targetStartDate = this.formatDate(target.start);
    const [transactions, accounts, balanceTransactions, transfers] =
      await Promise.all([
        this.previsaoRepository.findTransactionsInHistoricalWindow(
          usuarioId,
          historyStart,
          targetStartDate,
        ),
        this.previsaoRepository.findAccountsCreatedBefore(
          usuarioId,
          target.start,
        ),
        this.previsaoRepository.findTransactionsBefore(
          usuarioId,
          targetStartDate,
        ),
        this.previsaoRepository.findTransfersBefore(usuarioId, targetStartDate),
      ]);

    const aggregates = this.buildMonthlyAggregates(monthStarts, transactions);
    const incomes = aggregates.map((item) => item.receitas);
    const expenses = aggregates.map((item) => item.despesas);
    const incomeCounts = aggregates.map((item) => item.numReceitas);
    const expenseCounts = aggregates.map((item) => item.numDespesas);
    const saldoInicialMes = this.calculateOpeningBalance(
      accounts,
      balanceTransactions,
      transfers,
    );
    const taxaDeficit = this.round(
      aggregates.filter((item) => item.despesas > item.receitas).length /
        ML_MINIMUM_HISTORY_MONTHS,
    );
    const mediaReceitas = this.mean(incomes);
    const mediaDespesas = this.mean(expenses);
    const tendenciaReceitas = this.trend(incomes);
    const tendenciaDespesas = this.trend(expenses);

    const features: DeficitFeatures = {
      receita_lag_1: this.round(incomes[2]),
      despesa_lag_1: this.round(expenses[2]),
      media_receita_3m: mediaReceitas,
      media_despesa_3m: mediaDespesas,
      tendencia_receita_3m: tendenciaReceitas,
      tendencia_despesa_3m: tendenciaDespesas,
      volatilidade_despesa_3m: this.sampleStandardDeviation(expenses),
      media_transacoes_receita_3m: this.mean(incomeCounts),
      media_transacoes_despesa_3m: this.mean(expenseCounts),
      taxa_deficit_3m: taxaDeficit,
      saldo_inicial_mes: this.round(saldoInicialMes),
      mes_do_ano: target.start.getUTCMonth() + 1,
    };

    return {
      features,
      indicadores: {
        historicoMeses: ML_MINIMUM_HISTORY_MONTHS,
        saldoInicialMes: features.saldo_inicial_mes,
        mediaReceitas3Meses: mediaReceitas,
        mediaDespesas3Meses: mediaDespesas,
        tendenciaReceitas3Meses: tendenciaReceitas,
        tendenciaDespesas3Meses: tendenciaDespesas,
        taxaDeficit3Meses: taxaDeficit,
      },
      mesReferencia: target.label,
      schemaVersion: ML_PREDICTION_SCHEMA_VERSION,
    };
  }

  private resolveTargetMonth(monthReference?: string) {
    const now = new Date();
    const currentLabel = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = monthReference ?? currentLabel;
    if (!/^\d{4}-\d{2}$/.test(label)) {
      throw new ValidationAppException(
        'INVALID_MONTH_REFERENCE',
        'Mes de referencia invalido. Use o formato YYYY-MM.',
        { field: 'mes' },
      );
    }
    const [year, month] = label.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    if (start.getUTCFullYear() !== year || start.getUTCMonth() !== month - 1) {
      throw new ValidationAppException(
        'INVALID_MONTH_REFERENCE',
        'Mes de referencia invalido. Use o formato YYYY-MM.',
        { field: 'mes' },
      );
    }
    const currentStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    if (start.getTime() > currentStart.getTime()) {
      throw new ValidationAppException(
        'PREVISAO_FUTURE_MONTH_NOT_ALLOWED',
        'Nao e permitido prever um mes futuro.',
        { field: 'mes' },
      );
    }
    return { label, start };
  }

  private previousMonthStarts(targetStart: Date): Date[] {
    return [3, 2, 1].map(
      (offset) =>
        new Date(
          Date.UTC(
            targetStart.getUTCFullYear(),
            targetStart.getUTCMonth() - offset,
            1,
          ),
        ),
    );
  }

  private buildMonthlyAggregates(
    monthStarts: Date[],
    transactions: Transacao[],
  ): MonthlyAggregate[] {
    return monthStarts.map((start) => {
      const label = this.formatDate(start).slice(0, 7);
      const monthly = transactions.filter(
        (transaction) => transaction.data.slice(0, 7) === label,
      );
      const receitas = monthly.filter(
        (transaction) => transaction.tipo === TipoTransacao.RECEITA,
      );
      const despesas = monthly.filter(
        (transaction) => transaction.tipo === TipoTransacao.DESPESA,
      );
      return {
        mes: label,
        receitas: receitas.reduce(
          (sum, transaction) => sum + toNumber(transaction.valor),
          0,
        ),
        despesas: despesas.reduce(
          (sum, transaction) => sum + toNumber(transaction.valor),
          0,
        ),
        numReceitas: receitas.length,
        numDespesas: despesas.length,
      };
    });
  }

  private calculateOpeningBalance(
    accounts: Conta[],
    transactions: Transacao[],
    transfers: Transferencia[],
  ): number {
    const accountIds = new Set(accounts.map((account) => account.id));
    const initial = accounts.reduce(
      (sum, account) => sum + toNumber(account.saldoInicial),
      0,
    );
    const transactionDelta = transactions
      .filter((transaction) => accountIds.has(transaction.contaId))
      .reduce(
        (sum, transaction) =>
          sum +
          (transaction.tipo === TipoTransacao.RECEITA
            ? toNumber(transaction.valor)
            : -toNumber(transaction.valor)),
        0,
      );
    const transferDelta = transfers.reduce((sum, transfer) => {
      const value = toNumber(transfer.valor);
      const fee = toNumber(transfer.comissao);
      let delta = 0;
      if (accountIds.has(transfer.contaOrigemId)) {
        delta -= value + fee;
      }
      if (accountIds.has(transfer.contaDestinoId)) {
        delta += value;
      }
      return sum + delta;
    }, 0);
    return initial + transactionDelta + transferDelta;
  }

  private mean(values: number[]): number {
    return this.round(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    );
  }

  private trend(values: number[]): number {
    return this.round((values[2] - values[0]) / 2);
  }

  private sampleStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      (values.length - 1);
    return this.round(Math.sqrt(variance));
  }

  private round(value: number): number {
    return Number(value.toFixed(4));
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
