import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { notSoftDeleted } from '../../common/soft-delete.query';
import { Categoria } from '../../categorias/entities/categoria.entity';
import { Transacao } from '../../transacoes/entities/transacao.entity';

@Injectable()
export class DashboardRepository {
  constructor(
    @InjectRepository(Transacao)
    private readonly transacaoRepository: Repository<Transacao>,
    @InjectRepository(Categoria)
    private readonly categoriaRepository: Repository<Categoria>,
  ) {}

  async findTransactionsByPeriod(
    usuarioId: string,
    startDate: string,
    endDate: string,
  ): Promise<Transacao[]> {
    return this.transacaoRepository.find({
      where: {
        usuarioId,
        data: Between(startDate, endDate),
        ...notSoftDeleted,
      },
      order: {
        data: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  async findRecentTransactions(
    usuarioId: string,
    take = 5,
  ): Promise<Transacao[]> {
    return this.transacaoRepository.find({
      where: { usuarioId, ...notSoftDeleted },
      order: {
        data: 'DESC',
        createdAt: 'DESC',
      },
      take,
    });
  }

  async findCategoriesByUser(usuarioId: string): Promise<Categoria[]> {
    return this.categoriaRepository.find({
      where: { usuarioId },
    });
  }
}
