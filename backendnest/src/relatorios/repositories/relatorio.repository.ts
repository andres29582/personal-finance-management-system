import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Categoria } from '../../categorias/entities/categoria.entity';
import { Conta } from '../../contas/entities/conta.entity';
import { notSoftDeleted } from '../../common/soft-delete.query';
import { Transacao } from '../../transacoes/entities/transacao.entity';

@Injectable()
export class RelatorioRepository {
  constructor(
    @InjectRepository(Transacao)
    private readonly transacaoRepository: Repository<Transacao>,
    @InjectRepository(Categoria)
    private readonly categoriaRepository: Repository<Categoria>,
    @InjectRepository(Conta)
    private readonly contaRepository: Repository<Conta>,
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

  async findCategoriesByUser(usuarioId: string): Promise<Categoria[]> {
    return this.categoriaRepository.find({ where: { usuarioId } });
  }

  async findAccountsByUser(usuarioId: string): Promise<Conta[]> {
    return this.contaRepository.find({ where: { usuarioId } });
  }
}
