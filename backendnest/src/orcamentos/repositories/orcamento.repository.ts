import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { notSoftDeleted } from '../../common/soft-delete.query';
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
    return this.orcamentoRepository.findOneBy({ id, usuarioId });
  }

  async findByUser(usuarioId: string): Promise<Orcamento[]> {
    return this.orcamentoRepository.find({
      where: { usuarioId },
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

  async findExpenseTransactionsByPeriod(
    usuarioId: string,
    startDate: string,
    endDate: string,
  ): Promise<Transacao[]> {
    return this.transacaoRepository.find({
      where: {
        usuarioId,
        tipo: TipoTransacao.DESPESA,
        data: Between(startDate, endDate),
        ...notSoftDeleted,
      },
    });
  }
}
