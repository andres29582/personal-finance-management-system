import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { notSoftDeleted } from '../../common/soft-delete.query';
import { Conta } from '../../contas/entities/conta.entity';
import { Transacao } from '../../transacoes/entities/transacao.entity';
import { Transferencia } from '../../transferencias/entities/transferencia.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class PrevisaoRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Conta)
    private readonly contaRepository: Repository<Conta>,
    @InjectRepository(Transacao)
    private readonly transacaoRepository: Repository<Transacao>,
    @InjectRepository(Transferencia)
    private readonly transferenciaRepository: Repository<Transferencia>,
  ) {}

  async findUserById(usuarioId: string): Promise<User | null> {
    return this.userRepository.findOneBy({ id: usuarioId });
  }

  async findTransactionsInHistoricalWindow(
    usuarioId: string,
    startDate: string,
    targetStartDate: string,
  ): Promise<Transacao[]> {
    return this.transacaoRepository
      .createQueryBuilder('transacao')
      .where('transacao.usuario_id = :usuarioId', { usuarioId })
      .andWhere('transacao.data >= :startDate', { startDate })
      .andWhere('transacao.data < :targetStartDate', { targetStartDate })
      .andWhere('transacao.excluido_em IS NULL')
      .orderBy('transacao.data', 'ASC')
      .getMany();
  }

  async findAccountsCreatedBefore(
    usuarioId: string,
    targetStart: Date,
  ): Promise<Conta[]> {
    return this.contaRepository.find({
      where: { usuarioId, createdAt: LessThan(targetStart) },
    });
  }

  async findTransactionsBefore(
    usuarioId: string,
    targetStartDate: string,
  ): Promise<Transacao[]> {
    return this.transacaoRepository.find({
      where: {
        usuarioId,
        data: LessThan(targetStartDate),
        ...notSoftDeleted,
      },
    });
  }

  async findTransfersBefore(
    usuarioId: string,
    targetStartDate: string,
  ): Promise<Transferencia[]> {
    return this.transferenciaRepository.find({
      where: {
        usuarioId,
        data: LessThan(targetStartDate),
        ...notSoftDeleted,
      },
    });
  }
}
