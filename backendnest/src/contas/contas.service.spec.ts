import { EntityManager } from 'typeorm';
import {
  BusinessRuleException,
  ResourceNotFoundException,
} from '../common/exceptions';
import { LogsService } from '../logs/logs.service';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { Transferencia } from '../transferencias/entities/transferencia.entity';
import { Conta } from './entities/conta.entity';
import { TipoConta } from './enums/tipo-conta.enum';
import { ContasService } from './contas.service';
import { ContaRepository } from './repositories/conta.repository';

describe('ContasService', () => {
  let service: ContasService;
  let contasRepository: jest.Mocked<
    Pick<
      ContaRepository,
      | 'create'
      | 'findActiveByUser'
      | 'findByIdAndUser'
      | 'findByIdAndUserForWrite'
      | 'findManyByIdsAndUserForWrite'
      | 'findTransactionsForAccounts'
      | 'findTransfersByUser'
      | 'updateByIdAndUser'
    >
  >;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;
  let manager: EntityManager;

  const contas = [
    {
      ativa: true,
      id: 'conta-1',
      nome: 'Banco',
      saldoInicial: '1000.00',
      tipo: TipoConta.BANCO,
      usuarioId: 'user-1',
    },
    {
      ativa: true,
      id: 'conta-2',
      nome: 'Carteira',
      saldoInicial: 200,
      tipo: TipoConta.DINHEIRO,
      usuarioId: 'user-1',
    },
    {
      ativa: false,
      id: 'conta-inativa',
      nome: 'Conta inativa',
      saldoInicial: 10000,
      tipo: TipoConta.POUPANCA,
      usuarioId: 'user-1',
    },
    {
      ativa: true,
      id: 'conta-outro-usuario',
      nome: 'Outro usuario',
      saldoInicial: 9999,
      tipo: TipoConta.BANCO,
      usuarioId: 'user-2',
    },
  ] as Conta[];

  const transacoes = [
    {
      contaId: 'conta-1',
      excluidoEm: null,
      id: 'receita-conta-1',
      tipo: TipoTransacao.RECEITA,
      usuarioId: 'user-1',
      valor: '500.00',
    },
    {
      contaId: 'conta-1',
      excluidoEm: null,
      id: 'despesa-conta-1',
      tipo: TipoTransacao.DESPESA,
      usuarioId: 'user-1',
      valor: 150,
    },
    {
      contaId: 'conta-2',
      excluidoEm: null,
      id: 'receita-conta-2',
      tipo: TipoTransacao.RECEITA,
      usuarioId: 'user-1',
      valor: 100,
    },
    {
      contaId: 'conta-2',
      excluidoEm: null,
      id: 'despesa-conta-2',
      tipo: TipoTransacao.DESPESA,
      usuarioId: 'user-1',
      valor: '20.00',
    },
    {
      contaId: 'conta-1',
      excluidoEm: new Date('2026-04-10T10:00:00Z'),
      id: 'receita-soft-deleted',
      tipo: TipoTransacao.RECEITA,
      usuarioId: 'user-1',
      valor: 999,
    },
    {
      contaId: 'conta-1',
      excluidoEm: null,
      id: 'receita-outro-usuario',
      tipo: TipoTransacao.RECEITA,
      usuarioId: 'user-2',
      valor: 999,
    },
  ] as Transacao[];

  const transferencias = [
    {
      comissao: '5.00',
      contaDestinoId: 'conta-2',
      contaOrigemId: 'conta-1',
      excluidoEm: null,
      id: 'saida-conta-1',
      usuarioId: 'user-1',
      valor: 200,
    },
    {
      comissao: 2,
      contaDestinoId: 'conta-1',
      contaOrigemId: 'conta-2',
      excluidoEm: null,
      id: 'entrada-conta-1',
      usuarioId: 'user-1',
      valor: '75.00',
    },
    {
      comissao: 10,
      contaDestinoId: 'conta-2',
      contaOrigemId: 'conta-1',
      excluidoEm: new Date('2026-04-10T10:00:00Z'),
      id: 'transferencia-soft-deleted',
      usuarioId: 'user-1',
      valor: 300,
    },
    {
      comissao: 0,
      contaDestinoId: 'conta-1',
      contaOrigemId: 'conta-2',
      excluidoEm: null,
      id: 'transferencia-outro-usuario',
      usuarioId: 'user-2',
      valor: 999,
    },
  ] as Transferencia[];

  beforeEach(() => {
    contasRepository = {
      create: jest.fn(),
      findActiveByUser: jest.fn((usuarioId: string) =>
        Promise.resolve(
          contas.filter(
            (conta) => conta.usuarioId === usuarioId && conta.ativa === true,
          ),
        ),
      ),
      findByIdAndUser: jest.fn((id: string, usuarioId: string) =>
        Promise.resolve(
          contas.find(
            (conta) => conta.id === id && conta.usuarioId === usuarioId,
          ) ?? null,
        ),
      ),
      findByIdAndUserForWrite: jest.fn(),
      findManyByIdsAndUserForWrite: jest.fn(),
      findTransactionsForAccounts: jest.fn(
        (usuarioId: string, contaIds: string[]) =>
          Promise.resolve(
            transacoes.filter(
              (transacao) =>
                transacao.usuarioId === usuarioId &&
                contaIds.includes(transacao.contaId) &&
                transacao.excluidoEm === null,
            ),
          ),
      ),
      findTransfersByUser: jest.fn((usuarioId: string) =>
        Promise.resolve(
          transferencias.filter(
            (transferencia) =>
              transferencia.usuarioId === usuarioId &&
              transferencia.excluidoEm === null,
          ),
        ),
      ),
      updateByIdAndUser: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };
    manager = {} as EntityManager;

    service = new ContasService(
      contasRepository as unknown as ContaRepository,
      logsService as unknown as LogsService,
    );
  });

  it('calculates current balances from initial balance, transactions, transfers and fees', async () => {
    const result = await service.findAll('user-1');

    expect(contasRepository.findActiveByUser).toHaveBeenCalledWith('user-1');
    expect(result).toHaveLength(2);
    expect(result.map((conta) => conta.id)).toEqual(['conta-1', 'conta-2']);
    expect(result.find((conta) => conta.id === 'conta-1')?.saldoAtual).toBe(
      1220,
    );
    expect(result.find((conta) => conta.id === 'conta-2')?.saldoAtual).toBe(
      403,
    );
  });

  it('applies transfers to balances and ignores soft-deleted transfers', async () => {
    const result = await service.findAll('user-1');
    const contaOrigem = result.find((conta) => conta.id === 'conta-1');
    const contaDestino = result.find((conta) => conta.id === 'conta-2');

    expect(contasRepository.findTransfersByUser).toHaveBeenCalledWith('user-1');
    expect(contaOrigem?.saldoAtual).toBe(1000 + 500 - 150 - 200 - 5 + 75);
    expect(contaDestino?.saldoAtual).toBe(200 + 100 - 20 + 200 - 75 - 2);
  });

  it('does not include inactive accounts in list results', async () => {
    const result = await service.findAll('user-1');

    expect(result.some((conta) => conta.id === 'conta-inativa')).toBe(false);
    expect(result.every((conta) => conta.ativa)).toBe(true);
  });

  it('keeps inactive accounts available through historical lookup with their current balance', async () => {
    const result = await service.findOne('conta-inativa', 'user-1');

    expect(contasRepository.findByIdAndUser).toHaveBeenCalledWith(
      'conta-inativa',
      'user-1',
    );
    expect(contasRepository.findTransactionsForAccounts).toHaveBeenCalledWith(
      'user-1',
      ['conta-inativa'],
    );
    expect(contasRepository.findTransfersByUser).toHaveBeenCalledWith('user-1');
    expect(result).toMatchObject({
      ativa: false,
      id: 'conta-inativa',
      saldoAtual: 10000,
    });
  });

  it('returns an active account for writes through the transactional repository without calculating balance', async () => {
    contasRepository.findByIdAndUserForWrite.mockResolvedValue(contas[0]);

    await expect(
      service.findActiveForWrite('conta-1', 'user-1', manager),
    ).resolves.toBe(contas[0]);

    expect(contasRepository.findByIdAndUserForWrite).toHaveBeenCalledWith(
      'conta-1',
      'user-1',
      manager,
    );
    expect(contasRepository.findByIdAndUser).not.toHaveBeenCalled();
    expect(contasRepository.findTransactionsForAccounts).not.toHaveBeenCalled();
    expect(contasRepository.findTransfersByUser).not.toHaveBeenCalled();
  });

  it('rejects an inactive account for writes without calculating balance', async () => {
    contasRepository.findByIdAndUserForWrite.mockResolvedValue(contas[2]);

    const promise = service.findActiveForWrite(
      'conta-inativa',
      'user-1',
      manager,
    );

    await expect(promise).rejects.toBeInstanceOf(BusinessRuleException);
    await expect(promise).rejects.toMatchObject({
      code: 'CONTA_INACTIVE',
      message:
        'Não é possível realizar operações financeiras em uma conta inativa.',
      statusCode: 400,
    });
    expect(contasRepository.findTransactionsForAccounts).not.toHaveBeenCalled();
    expect(contasRepository.findTransfersByUser).not.toHaveBeenCalled();
  });

  it('keeps nonexistent and foreign accounts indistinguishable for writes', async () => {
    contasRepository.findByIdAndUserForWrite.mockResolvedValue(null);

    const promise = service.findActiveForWrite(
      'conta-outro-usuario',
      'user-1',
      manager,
    );

    await expect(promise).rejects.toBeInstanceOf(ResourceNotFoundException);
    await expect(promise).rejects.toMatchObject({
      code: 'CONTA_NOT_FOUND',
      message: 'Conta não encontrada',
      statusCode: 404,
    });
    expect(contasRepository.findByIdAndUserForWrite).toHaveBeenCalledWith(
      'conta-outro-usuario',
      'user-1',
      manager,
    );
    expect(contasRepository.findTransactionsForAccounts).not.toHaveBeenCalled();
    expect(contasRepository.findTransfersByUser).not.toHaveBeenCalled();
  });

  it('deduplicates and sorts account ids before validating multiple active accounts', async () => {
    contasRepository.findManyByIdsAndUserForWrite.mockResolvedValue([
      contas[0],
      contas[1],
    ]);

    await expect(
      service.findActiveManyForWrite(
        ['conta-2', 'conta-1', 'conta-2'],
        'user-1',
        manager,
      ),
    ).resolves.toEqual([contas[0], contas[1]]);

    expect(contasRepository.findManyByIdsAndUserForWrite).toHaveBeenCalledWith(
      ['conta-1', 'conta-2'],
      'user-1',
      manager,
    );
    expect(contasRepository.findTransactionsForAccounts).not.toHaveBeenCalled();
    expect(contasRepository.findTransfersByUser).not.toHaveBeenCalled();
  });

  it('rejects multiple-account writes when any owned account is inactive', async () => {
    contasRepository.findManyByIdsAndUserForWrite.mockResolvedValue([
      contas[0],
      contas[2],
    ]);

    await expect(
      service.findActiveManyForWrite(
        ['conta-1', 'conta-inativa'],
        'user-1',
        manager,
      ),
    ).rejects.toMatchObject({
      code: 'CONTA_INACTIVE',
      statusCode: 400,
    });
  });

  it('prioritizes not found over inactive when validating multiple accounts', async () => {
    contasRepository.findManyByIdsAndUserForWrite.mockResolvedValue([
      contas[2],
    ]);

    const promise = service.findActiveManyForWrite(
      ['conta-inativa', 'conta-outro-usuario'],
      'user-1',
      manager,
    );

    await expect(promise).rejects.toBeInstanceOf(ResourceNotFoundException);
    await expect(promise).rejects.toMatchObject({
      code: 'CONTA_NOT_FOUND',
      message: 'Conta não encontrada',
      statusCode: 404,
    });
  });

  it('rejects a same-size bulk result when it contains a different account id', async () => {
    contasRepository.findManyByIdsAndUserForWrite.mockResolvedValue([
      contas[2],
      contas[3],
    ]);

    const promise = service.findActiveManyForWrite(
      ['conta-1', 'conta-inativa'],
      'user-1',
      manager,
    );

    await expect(promise).rejects.toBeInstanceOf(ResourceNotFoundException);
    await expect(promise).rejects.toMatchObject({
      code: 'CONTA_NOT_FOUND',
      message: 'Conta não encontrada',
      statusCode: 404,
    });
  });

  it('throws a typed not found error when account does not exist', async () => {
    await expect(
      service.findOne('conta-inexistente', 'user-1'),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
    await expect(
      service.findOne('conta-inexistente', 'user-1'),
    ).rejects.toMatchObject({
      code: 'CONTA_NOT_FOUND',
      message: 'Conta não encontrada',
      statusCode: 404,
    });
  });
});
