import { Repository } from 'typeorm';
import { LogsService } from '../logs/logs.service';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { Transferencia } from '../transferencias/entities/transferencia.entity';
import { Conta } from './entities/conta.entity';
import { TipoConta } from './enums/tipo-conta.enum';
import { ContasService } from './contas.service';

type FindArgs = {
  where?: Record<string, unknown>;
};

describe('ContasService', () => {
  let service: ContasService;
  let contasRepository: jest.Mocked<
    Pick<Repository<Conta>, 'create' | 'find' | 'findOneBy' | 'save' | 'update'>
  >;
  let transacoesRepository: jest.Mocked<Pick<Repository<Transacao>, 'find'>>;
  let transferenciasRepository: jest.Mocked<
    Pick<Repository<Transferencia>, 'find'>
  >;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

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
      find: jest.fn(({ where }: FindArgs = {}) =>
        Promise.resolve(
          contas.filter(
            (conta) =>
              conta.usuarioId === where?.usuarioId &&
              (where?.ativa === undefined || conta.ativa === where.ativa),
          ),
        ),
      ),
      findOneBy: jest.fn((where: Record<string, unknown>) =>
        Promise.resolve(
          contas.find(
            (conta) =>
              conta.id === where.id && conta.usuarioId === where.usuarioId,
          ) ?? null,
        ),
      ),
      save: jest.fn(),
      update: jest.fn(),
    };
    transacoesRepository = {
      find: jest.fn(({ where }: FindArgs = {}) => {
        expect(where).toEqual(
          expect.objectContaining({
            contaId: expect.any(Object),
            excluidoEm: expect.any(Object),
            usuarioId: 'user-1',
          }),
        );

        return Promise.resolve(
          transacoes.filter(
            (transacao) =>
              transacao.usuarioId === where?.usuarioId &&
              transacao.excluidoEm === null,
          ),
        );
      }),
    };
    transferenciasRepository = {
      find: jest.fn(({ where }: FindArgs = {}) => {
        expect(where).toEqual(
          expect.objectContaining({
            excluidoEm: expect.any(Object),
            usuarioId: 'user-1',
          }),
        );

        return Promise.resolve(
          transferencias.filter(
            (transferencia) =>
              transferencia.usuarioId === where?.usuarioId &&
              transferencia.excluidoEm === null,
          ),
        );
      }),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new ContasService(
      contasRepository as unknown as Repository<Conta>,
      transacoesRepository as unknown as Repository<Transacao>,
      transferenciasRepository as unknown as Repository<Transferencia>,
      logsService as unknown as LogsService,
    );
  });

  it('calculates current balances from initial balance, transactions, transfers and fees', async () => {
    const result = await service.findAll('user-1');

    expect(contasRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuarioId: 'user-1', ativa: true },
      }),
    );
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

    expect(transferenciasRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          excluidoEm: expect.any(Object),
          usuarioId: 'user-1',
        }),
      }),
    );
    expect(contaOrigem?.saldoAtual).toBe(1000 + 500 - 150 - 200 - 5 + 75);
    expect(contaDestino?.saldoAtual).toBe(200 + 100 - 20 + 200 - 75 - 2);
  });

  it('does not include inactive accounts in list results', async () => {
    const result = await service.findAll('user-1');

    expect(result.some((conta) => conta.id === 'conta-inativa')).toBe(false);
    expect(result.every((conta) => conta.ativa)).toBe(true);
  });
});
