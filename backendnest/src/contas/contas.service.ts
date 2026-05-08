import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import { toNumber } from '../common/number.util';
import { notSoftDeleted } from '../common/soft-delete.query';
import { LogsService } from '../logs/logs.service';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { Transferencia } from '../transferencias/entities/transferencia.entity';
import { CreateContaDto } from './dto/create-conta.dto';
import { UpdateContaDto } from './dto/update-conta.dto';
import { Conta } from './entities/conta.entity';

type ContaComSaldo = Conta & { saldoAtual: number };

@Injectable()
export class ContasService {
  constructor(
    @InjectRepository(Conta)
    private readonly contasRepository: Repository<Conta>,
    @InjectRepository(Transacao)
    private readonly transacoesRepository: Repository<Transacao>,
    @InjectRepository(Transferencia)
    private readonly transferenciasRepository: Repository<Transferencia>,
    private readonly logsService: LogsService,
  ) {}

  async create(usuarioId: string, dto: CreateContaDto): Promise<ContaComSaldo> {
    const conta = this.contasRepository.create({
      id: randomUUID(),
      usuarioId,
      nome: dto.nome,
      tipo: dto.tipo,
      saldoInicial: dto.saldoInicial,
      limiteCredito: dto.limiteCredito ?? null,
      dataCorte: dto.dataCorte ?? null,
      dataPagamento: dto.dataPagamento ?? null,
    });

    await this.contasRepository.save(conta);
    const createdAccount = await this.findOne(conta.id, usuarioId);

    await this.logsService.logEntityEvent({
      event: 'CONTA_CREATED',
      module: 'contas',
      action: 'create',
      userId: usuarioId,
      entity: 'conta',
      entityId: createdAccount.id,
      message: 'Conta criada com sucesso.',
      details: {
        nome: createdAccount.nome,
        tipo: createdAccount.tipo,
      },
    });

    return createdAccount;
  }

  async findAll(usuarioId: string): Promise<ContaComSaldo[]> {
    const contas = await this.contasRepository.find({
      where: { usuarioId, ativa: true },
      order: { createdAt: 'DESC' },
    });

    return this.attachCurrentBalances(contas, usuarioId);
  }

  async findOne(id: string, usuarioId: string): Promise<ContaComSaldo> {
    const conta = await this.contasRepository.findOneBy({ id, usuarioId });

    if (!conta) {
      throw new NotFoundException('Conta não encontrada');
    }

    const [enrichedAccount] = await this.attachCurrentBalances(
      [conta],
      usuarioId,
    );

    return enrichedAccount;
  }

  async update(
    id: string,
    usuarioId: string,
    dto: UpdateContaDto,
  ): Promise<ContaComSaldo> {
    await this.findOne(id, usuarioId);

    const dadosAtualizacao: Partial<Conta> = {};

    if (dto.nome !== undefined) {
      dadosAtualizacao.nome = dto.nome;
    }
    if (dto.limiteCredito !== undefined) {
      dadosAtualizacao.limiteCredito = dto.limiteCredito;
    }
    if (dto.dataCorte !== undefined) {
      dadosAtualizacao.dataCorte = dto.dataCorte;
    }
    if (dto.dataPagamento !== undefined) {
      dadosAtualizacao.dataPagamento = dto.dataPagamento;
    }
    if (dto.ativa !== undefined) {
      dadosAtualizacao.ativa = dto.ativa;
    }

    await this.contasRepository.update({ id, usuarioId }, dadosAtualizacao);
    const updatedAccount = await this.findOne(id, usuarioId);

    await this.logsService.logEntityEvent({
      event: 'CONTA_UPDATED',
      module: 'contas',
      action: 'update',
      userId: usuarioId,
      entity: 'conta',
      entityId: updatedAccount.id,
      message: 'Conta atualizada com sucesso.',
      details: {
        changedFields: this.getChangedFields(dto),
      },
    });

    return updatedAccount;
  }

  async desativar(id: string, usuarioId: string): Promise<void> {
    const account = await this.findOne(id, usuarioId);
    await this.contasRepository.update({ id, usuarioId }, { ativa: false });
    await this.logsService.logEntityEvent({
      event: 'CONTA_DEACTIVATED',
      module: 'contas',
      action: 'deactivate',
      userId: usuarioId,
      entity: 'conta',
      entityId: account.id,
      message: 'Conta desativada com sucesso.',
      details: {
        nome: account.nome,
      },
    });
  }

  async deactivate(id: string, usuarioId: string): Promise<void> {
    await this.desativar(id, usuarioId);
  }

  private async attachCurrentBalances(
    contas: Conta[],
    usuarioId: string,
  ): Promise<ContaComSaldo[]> {
    if (contas.length === 0) {
      return [];
    }

    const contaIds = contas.map((conta) => conta.id);
    const [transacoes, transferencias] = await Promise.all([
      this.transacoesRepository.find({
        where: { usuarioId, contaId: In(contaIds), ...notSoftDeleted },
      }),
      this.transferenciasRepository.find({
        where: { usuarioId, ...notSoftDeleted },
      }),
    ]);

    return contas.map((conta) => {
      const transactionDelta = transacoes
        .filter((transaction) => transaction.contaId === conta.id)
        .reduce((sum, transaction) => {
          const transactionValue = toNumber(transaction.valor);

          return (
            sum +
            (transaction.tipo === TipoTransacao.RECEITA
              ? transactionValue
              : -transactionValue)
          );
        }, 0);
      const transferDelta = transferencias.reduce((sum, transferencia) => {
        const transferValue = toNumber(transferencia.valor);
        const feeValue = toNumber(transferencia.comissao);

        if (transferencia.contaOrigemId === conta.id) {
          return sum - transferValue - feeValue;
        }

        if (transferencia.contaDestinoId === conta.id) {
          return sum + transferValue;
        }

        return sum;
      }, 0);

      return {
        ...conta,
        saldoAtual:
          toNumber(conta.saldoInicial) + transactionDelta + transferDelta,
      };
    });
  }

  private getChangedFields(dto: UpdateContaDto): string[] {
    return Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
  }
}
