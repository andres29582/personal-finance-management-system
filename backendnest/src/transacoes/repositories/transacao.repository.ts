import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { resolveMonthRange } from '../../common/date-range.util';
import { BaseRepository } from '../../common/abstract/base.repository';
import { notSoftDeleted } from '../../common/soft-delete.query';
import { FindTransacoesDto } from '../dto/find-transacoes.dto';
import { Transacao } from '../entities/transacao.entity';

@Injectable()
export class TransacaoRepository extends BaseRepository<Transacao> {
  constructor(
    @InjectRepository(Transacao)
    private readonly transacaoRepository: Repository<Transacao>,
  ) {
    super(transacaoRepository);
  }

  async findByUser(
    usuarioId: string,
    query: FindTransacoesDto,
  ): Promise<Transacao[]> {
    const whereClause: Record<string, unknown> = { usuarioId };

    if (query.mes) {
      const monthRange = resolveMonthRange(query.mes);
      whereClause.data = Between(monthRange.startDate, monthRange.endDate);
    }

    if (query.tipo) {
      whereClause.tipo = query.tipo;
    }

    if (query.contaId) {
      whereClause.contaId = query.contaId;
    }

    if (query.categoriaId) {
      whereClause.categoriaId = query.categoriaId;
    }

    return this.transacaoRepository.find({
      where: { ...whereClause, ...notSoftDeleted },
      order: { data: 'DESC', createdAt: 'DESC' },
    });
  }

  async findByIdAndUser(
    id: string,
    usuarioId: string,
  ): Promise<Transacao | null> {
    return this.transacaoRepository.findOneBy({
      id,
      usuarioId,
      ...notSoftDeleted,
    });
  }

  async updateByIdAndUser(
    id: string,
    usuarioId: string,
    data: Partial<Transacao>,
  ): Promise<void> {
    await this.transacaoRepository.update({ id, usuarioId }, data);
  }

  async softDeleteByIdAndUser(id: string, usuarioId: string): Promise<void> {
    await this.updateByIdAndUser(id, usuarioId, { excluidoEm: new Date() });
  }
}
