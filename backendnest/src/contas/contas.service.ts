import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import {
  BusinessRuleException,
  ResourceNotFoundException,
} from '../common/exceptions';
import { toNumber } from '../common/number.util';
import { LogsService } from '../logs/logs.service';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { CreateContaDto } from './dto/create-conta.dto';
import { UpdateContaDto } from './dto/update-conta.dto';
import { Conta } from './entities/conta.entity';
import { ContaRepository } from './repositories/conta.repository';

type ContaComSaldo = Conta & { saldoAtual: number };

@Injectable()
export class ContasService {
  constructor(
    private readonly contaRepository: ContaRepository,
    private readonly logsService: LogsService,
  ) {}

  async create(usuarioId: string, dto: CreateContaDto): Promise<ContaComSaldo> {
    const conta = await this.contaRepository.create({
      id: randomUUID(),
      usuarioId,
      nome: dto.nome,
      tipo: dto.tipo,
      saldoInicial: dto.saldoInicial,
      limiteCredito: dto.limiteCredito ?? null,
      dataCorte: dto.dataCorte ?? null,
      dataPagamento: dto.dataPagamento ?? null,
    });

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
    const contas = await this.contaRepository.findActiveByUser(usuarioId);

    return this.attachCurrentBalances(contas, usuarioId);
  }

  async findOne(id: string, usuarioId: string): Promise<ContaComSaldo> {
    const conta = await this.contaRepository.findByIdAndUser(id, usuarioId);

    if (!conta) {
      throw new ResourceNotFoundException(
        'CONTA_NOT_FOUND',
        'Conta não encontrada',
      );
    }

    const [enrichedAccount] = await this.attachCurrentBalances(
      [conta],
      usuarioId,
    );

    return enrichedAccount;
  }

  async findActiveForWrite(
    id: string,
    usuarioId: string,
    manager: EntityManager,
  ): Promise<Conta> {
    const conta = await this.contaRepository.findByIdAndUserForWrite(
      id,
      usuarioId,
      manager,
    );

    if (!conta) {
      throw this.createContaNotFoundException();
    }

    this.assertAccountsAreActive([conta]);

    return conta;
  }

  async findActiveManyForWrite(
    ids: string[],
    usuarioId: string,
    manager: EntityManager,
  ): Promise<Conta[]> {
    const requestedIds = [...new Set(ids)].sort((left, right) =>
      left.localeCompare(right),
    );
    const contas = await this.contaRepository.findManyByIdsAndUserForWrite(
      requestedIds,
      usuarioId,
      manager,
    );
    const foundIds = new Set(contas.map((conta) => conta.id));
    const hasMissingAccount =
      contas.length !== requestedIds.length ||
      requestedIds.some((id) => !foundIds.has(id));

    if (hasMissingAccount) {
      throw this.createContaNotFoundException();
    }

    this.assertAccountsAreActive(contas);

    return contas;
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

    await this.contaRepository.updateByIdAndUser(
      id,
      usuarioId,
      dadosAtualizacao,
    );
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
    await this.contaRepository.updateByIdAndUser(id, usuarioId, {
      ativa: false,
    });
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
      this.contaRepository.findTransactionsForAccounts(usuarioId, contaIds),
      this.contaRepository.findTransfersByUser(usuarioId),
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

  private assertAccountsAreActive(contas: Conta[]): void {
    if (contas.some((conta) => conta.ativa === false)) {
      throw new BusinessRuleException(
        'CONTA_INACTIVE',
        'Não é possível realizar operações financeiras em uma conta inativa.',
      );
    }
  }

  private createContaNotFoundException(): ResourceNotFoundException {
    return new ResourceNotFoundException(
      'CONTA_NOT_FOUND',
      'Conta não encontrada',
    );
  }
}
