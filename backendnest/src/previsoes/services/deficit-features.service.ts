import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { notSoftDeleted } from '../../common/soft-delete.query';
import { resolveMonthRange } from '../../common/date-range.util';
import { toNumber } from '../../common/number.util';
import { Conta } from '../../contas/entities/conta.entity';
import { Transacao } from '../../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../../transacoes/enums/tipo-transacao.enum';
import { Transferencia } from '../../transferencias/entities/transferencia.entity';
import type { DeficitFeatures } from '../types/deficit-features.type';

type BuildDeficitFeaturesResult = {
  features: DeficitFeatures;
  mesReferencia: string;
};

@Injectable()
export class DeficitFeaturesService {
  constructor(
    @InjectRepository(Conta)
    private readonly contasRepository: Repository<Conta>,
    @InjectRepository(Transacao)
    private readonly transacoesRepository: Repository<Transacao>,
    @InjectRepository(Transferencia)
    private readonly transferenciasRepository: Repository<Transferencia>,
  ) {}

  async build(
    usuarioId: string,
    mes?: string,
  ): Promise<BuildDeficitFeaturesResult> {
    const monthRange = resolveMonthRange(mes);
    const cutoffDate = this.resolvePreviousMonthEnd(monthRange.label);

    const [contas, transacoesMes, transacoesAteCorte, transferenciasAteCorte] =
      await Promise.all([
        this.contasRepository.find({ where: { usuarioId, ativa: true } }),
        this.transacoesRepository.find({
          where: {
            usuarioId,
            data: Between(monthRange.startDate, monthRange.endDate),
            ...notSoftDeleted,
          },
        }),
        this.transacoesRepository.find({
          where: {
            usuarioId,
            data: LessThanOrEqual(cutoffDate),
            ...notSoftDeleted,
          },
        }),
        this.transferenciasRepository.find({
          where: {
            usuarioId,
            data: LessThanOrEqual(cutoffDate),
            excluidoEm: IsNull(),
          },
        }),
      ]);

    const activeAccountIds = new Set(contas.map((conta) => conta.id));
    const despesasMes = transacoesMes.filter(
      (transacao) => transacao.tipo === TipoTransacao.DESPESA,
    );
    const receitasMes = transacoesMes.filter(
      (transacao) => transacao.tipo === TipoTransacao.RECEITA,
    );
    const receitaMes = this.sumTransactions(receitasMes);
    const despesaMes = this.sumTransactions(despesasMes);

    return {
      mesReferencia: monthRange.label,
      features: {
        receita_mes: receitaMes,
        despesa_mes: despesaMes,
        saldo_inicial_mes: this.calculateOpeningBalance(
          contas,
          transacoesAteCorte.filter((transacao) =>
            activeAccountIds.has(transacao.contaId),
          ),
          transferenciasAteCorte,
        ),
        num_transacoes_despesa: despesasMes.length,
        num_transacoes_receita: receitasMes.length,
        volatilidade_despesa: this.calculateSampleStandardDeviation(
          despesasMes.map((transacao) => toNumber(transacao.valor)),
        ),
      },
    };
  }

  private calculateOpeningBalance(
    contas: Conta[],
    transacoesAteCorte: Transacao[],
    transferenciasAteCorte: Transferencia[],
  ): number {
    return contas.reduce((total, conta) => {
      const transactionDelta = transacoesAteCorte
        .filter((transacao) => transacao.contaId === conta.id)
        .reduce((sum, transacao) => {
          const value = toNumber(transacao.valor);

          return (
            sum + (transacao.tipo === TipoTransacao.RECEITA ? value : -value)
          );
        }, 0);
      const transferDelta = transferenciasAteCorte.reduce(
        (sum, transferencia) => {
          const transferValue = toNumber(transferencia.valor);
          const feeValue = toNumber(transferencia.comissao);

          if (transferencia.contaOrigemId === conta.id) {
            return sum - transferValue - feeValue;
          }

          if (transferencia.contaDestinoId === conta.id) {
            return sum + transferValue;
          }

          return sum;
        },
        0,
      );

      return (
        total + toNumber(conta.saldoInicial) + transactionDelta + transferDelta
      );
    }, 0);
  }

  private calculateSampleStandardDeviation(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      (values.length - 1);

    return Number(Math.sqrt(variance).toFixed(4));
  }

  private resolvePreviousMonthEnd(monthReference: string): string {
    const [year, month] = monthReference.split('-').map(Number);
    const previousMonthEnd = new Date(Date.UTC(year, month - 1, 0));

    return previousMonthEnd.toISOString().slice(0, 10);
  }

  private sumTransactions(transacoes: Transacao[]): number {
    return transacoes.reduce(
      (sum, transacao) => sum + toNumber(transacao.valor),
      0,
    );
  }
}
