import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { notSoftDeleted } from '../../common/soft-delete.query';
import { Conta } from '../../contas/entities/conta.entity';
import { Transacao } from '../../transacoes/entities/transacao.entity';
import { Transferencia } from '../../transferencias/entities/transferencia.entity';

@Injectable()
export class PrevisaoRepository {
  constructor(
    @InjectRepository(Conta)
    private readonly contaRepository: Repository<Conta>,
    @InjectRepository(Transacao)
    private readonly transacaoRepository: Repository<Transacao>,
    @InjectRepository(Transferencia)
    private readonly transferenciaRepository: Repository<Transferencia>,
  ) {}

  async findActiveAccountsByUser(usuarioId: string): Promise<Conta[]> {
    return this.contaRepository.find({ where: { usuarioId, ativa: true } });
  }

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
    });
  }

  async findTransactionsUntil(
    usuarioId: string,
    cutoffDate: string,
  ): Promise<Transacao[]> {
    return this.transacaoRepository.find({
      where: {
        usuarioId,
        data: LessThanOrEqual(cutoffDate),
        ...notSoftDeleted,
      },
    });
  }

  async findTransfersUntil(
    usuarioId: string,
    cutoffDate: string,
  ): Promise<Transferencia[]> {
    return this.transferenciaRepository.find({
      where: {
        usuarioId,
        data: LessThanOrEqual(cutoffDate),
        excluidoEm: IsNull(),
      },
    });
  }
}
