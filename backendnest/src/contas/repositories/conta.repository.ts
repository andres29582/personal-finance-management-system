import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { BaseRepository } from '../../common/abstract/base.repository';
import { notSoftDeleted } from '../../common/soft-delete.query';
import { Transacao } from '../../transacoes/entities/transacao.entity';
import { Transferencia } from '../../transferencias/entities/transferencia.entity';
import { Conta } from '../entities/conta.entity';

@Injectable()
export class ContaRepository extends BaseRepository<Conta> {
  constructor(
    @InjectRepository(Conta)
    private readonly contaRepository: Repository<Conta>,
    @InjectRepository(Transacao)
    private readonly transacaoRepository: Repository<Transacao>,
    @InjectRepository(Transferencia)
    private readonly transferenciaRepository: Repository<Transferencia>,
  ) {
    super(contaRepository);
  }

  async findActiveByUser(usuarioId: string): Promise<Conta[]> {
    return this.contaRepository.find({
      where: { usuarioId, ativa: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdAndUser(id: string, usuarioId: string): Promise<Conta | null> {
    return this.contaRepository.findOneBy({ id, usuarioId });
  }

  async findByIdAndUserForWrite(
    id: string,
    usuarioId: string,
    manager: EntityManager,
  ): Promise<Conta | null> {
    return manager.getRepository(Conta).findOne({
      where: { id, usuarioId },
      lock: { mode: 'pessimistic_read' },
    });
  }

  async findManyByIdsAndUserForWrite(
    ids: string[],
    usuarioId: string,
    manager: EntityManager,
  ): Promise<Conta[]> {
    const sortedIds = [...new Set(ids)].sort((left, right) =>
      left.localeCompare(right),
    );

    if (sortedIds.length === 0) {
      return [];
    }

    return manager.getRepository(Conta).find({
      where: { id: In(sortedIds), usuarioId },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_read' },
    });
  }

  async updateByIdAndUser(
    id: string,
    usuarioId: string,
    data: Partial<Conta>,
  ): Promise<void> {
    await this.contaRepository.update({ id, usuarioId }, data);
  }

  async findTransactionsForAccounts(
    usuarioId: string,
    contaIds: string[],
  ): Promise<Transacao[]> {
    return this.transacaoRepository.find({
      where: { usuarioId, contaId: In(contaIds), ...notSoftDeleted },
    });
  }

  async findTransfersByUser(usuarioId: string): Promise<Transferencia[]> {
    return this.transferenciaRepository.find({
      where: { usuarioId, ...notSoftDeleted },
    });
  }
}
