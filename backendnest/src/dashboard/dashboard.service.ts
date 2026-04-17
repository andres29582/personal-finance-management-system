import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { resolveMonthRange } from '../common/date-range.util';
import { toNumber } from '../common/number.util';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Conta } from '../contas/entities/conta.entity';
import { ContasService } from '../contas/contas.service';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { GetDashboardDto } from './dto/get-dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly contasService: ContasService,
    @InjectRepository(Transacao)
    private readonly transacoesRepository: Repository<Transacao>,
    @InjectRepository(Categoria)
    private readonly categoriasRepository: Repository<Categoria>,
  ) {}

  async getDashboard(usuarioId: string, query: GetDashboardDto) {
    const periodRange = resolveMonthRange(query.mes);
    const [contas, transacoesPeriodo, transacoesRecentes, categorias] =
      await Promise.all([
        this.contasService.findAll(usuarioId),
        this.transacoesRepository.find({
          where: {
            usuarioId,
            data: Between(periodRange.startDate, periodRange.endDate),
          },
          order: {
            data: 'DESC',
            createdAt: 'DESC',
          },
        }),
        this.transacoesRepository.find({
          where: { usuarioId },
          order: {
            data: 'DESC',
            createdAt: 'DESC',
          },
          take: 5,
        }),
        this.categoriasRepository.find({
          where: { usuarioId },
        }),
      ]);

    const categoriasById = new Map(
      categorias.map((categoria) => [categoria.id, categoria]),
    );
    const contasById = new Map(contas.map((conta) => [conta.id, conta]));
    const totalReceitas = transacoesPeriodo
      .filter((transacao) => transacao.tipo === TipoTransacao.RECEITA)
      .reduce((sum, transacao) => sum + toNumber(transacao.valor), 0);
    const totalDespesas = transacoesPeriodo
      .filter((transacao) => transacao.tipo === TipoTransacao.DESPESA)
      .reduce((sum, transacao) => sum + toNumber(transacao.valor), 0);
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
