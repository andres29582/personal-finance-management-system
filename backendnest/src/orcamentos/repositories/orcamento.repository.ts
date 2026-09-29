import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { BaseRepository } from '../../common/abstract/base.repository';
import { Transacao } from '../../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../../transacoes/enums/tipo-transacao.enum';
import { Orcamento } from '../entities/orcamento.entity';

@Injectable()
export class OrcamentoRepository extends BaseRepository<Orcamento> {
  constructor(
    @InjectRepository(Orcamento)
    private readonly orcamentoRepository: Repository<Orcamento>,
    @InjectRepository(Transacao)
    private readonly transacaoRepository: Repository<Transacao>,
  ) {
    super(orcamentoRepository);
  }

  async findByUserAndMonth(
    usuarioId: string,
    mesReferencia: string,
  ): Promise<Orcamento | null> {
    return this.orcamentoRepository.findOneBy({ usuarioId, mesReferencia });
  }

  async findByIdAndUser(
    id: string,
    usuarioId: string,
  ): Promise<Orcamento | null> {
    return this.orcamentoRepository.findOne({
      where: { id, usuarioId },
      relations: { alocacoes: { categoria: true } },
    });
  }

  async findByUser(usuarioId: string): Promise<Orcamento[]> {
    return this.orcamentoRepository.find({
      where: { usuarioId },
      relations: { alocacoes: { categoria: true } },
      order: { mesReferencia: 'ASC' },
    });
  }

  async findByUserAndYear(
    usuarioId: string,
    ano: string | number,
  ): Promise<Orcamento[]> {
    return this.orcamentoRepository.find({
      where: {
        usuarioId,
        mesReferencia: Between(`${ano}-01`, `${ano}-12`),
      },
      relations: { alocacoes: { categoria: true } },
      order: { mesReferencia: 'ASC' },
    });
  }

  async updateByIdAndUser(
    id: string,
    usuarioId: string,
    data: Partial<Orcamento>,
  ): Promise<void> {
    await this.orcamentoRepository.update({ id, usuarioId }, data);
  }

  async findExpenseTotalsByMonths(
    usuarioId: string,
    mesReferencias: string[],
  ): Promise<
    Array<{ mesReferencia: string; categoriaId: string; gastoAtual: string }>
  > {
    if (mesReferencias.length === 0) {
      return [];
    }

    return this.transacaoRepository
      .createQueryBuilder('transaction')
      .select("TO_CHAR(transaction.data, 'YYYY-MM')", 'mesReferencia')
      .addSelect('transaction.categoriaId', 'categoriaId')
      .addSelect('SUM(transaction.valor)', 'gastoAtual')
      .where('transaction.usuarioId = :usuarioId', { usuarioId })
      .andWhere('transaction.tipo = :tipo', { tipo: TipoTransacao.DESPESA })
      .andWhere('transaction.ehAjuste = :ehAjuste', { ehAjuste: false })
      .andWhere('transaction.excluidoEm IS NULL')
      .andWhere(
        "TO_CHAR(transaction.data, 'YYYY-MM') IN (:...mesReferencias)",
        {
          mesReferencias,
        },
      )
      .groupBy("TO_CHAR(transaction.data, 'YYYY-MM')")
      .addGroupBy('transaction.categoriaId')
      .getRawMany();
  }
}
