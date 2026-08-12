import { DataSource, EntityManager } from 'typeorm';
import { CategoriasService } from '../categorias/categorias.service';
import { TipoCategoria } from '../categorias/enums/tipo-categoria.enum';
import {
  BusinessRuleException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import { ContasService } from '../contas/contas.service';
import { Conta } from '../contas/entities/conta.entity';
import { LogsService } from '../logs/logs.service';
import { Transacao } from './entities/transacao.entity';
import { TipoTransacao } from './enums/tipo-transacao.enum';
import { TransacaoRepository } from './repositories/transacao.repository';
import { TransacoesService } from './transacoes.service';

type TestManager = {
  create: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
};

describe('TransacoesService', () => {
  let service: TransacoesService;
  let repository: jest.Mocked<
    Pick<
      TransacaoRepository,
      'findByIdAndUser' | 'findByUser' | 'softDeleteByIdAndUser'
    >
  >;
  let contasService: jest.Mocked<
    Pick<ContasService, 'findActiveForWrite' | 'findActiveManyForWrite'>
  >;
  let categoriasService: jest.Mocked<Pick<CategoriasService, 'findOne'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;
  let manager: TestManager;

  const createDto = {
    categoriaId: 'categoria-1',
    contaId: 'conta-1',
    data: '2026-04-01',
    descricao: 'Salario',
    ehAjuste: false,
    tipo: TipoTransacao.RECEITA,
    valor: 2000,
  };

  beforeEach(() => {
    repository = {
      findByIdAndUser: jest.fn(),
      findByUser: jest.fn(),
      softDeleteByIdAndUser: jest.fn(),
    };
    contasService = {
      findActiveForWrite: jest.fn(),
      findActiveManyForWrite: jest.fn(),
    };
    categoriasService = {
      findOne: jest.fn(),
    };
    manager = {
      create: jest.fn((_entity: unknown, payload: Transacao) => payload),
      findOne: jest.fn(),
      save: jest.fn((entity: Transacao) => Promise.resolve(entity)),
      update: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(),
    };
    (dataSource.transaction as unknown as jest.Mock).mockImplementation(
      (callback: (transactionManager: EntityManager) => Promise<unknown>) =>
        callback(manager as unknown as EntityManager),
    );
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new TransacoesService(
      repository as unknown as TransacaoRepository,
      contasService as unknown as ContasService,
      categoriasService as unknown as CategoriasService,
      dataSource as unknown as DataSource,
      logsService as unknown as LogsService,
    );
  });

  it('creates a transaction with an active account inside the SQL transaction', async () => {
    contasService.findActiveForWrite.mockResolvedValue({
      ativa: true,
      id: 'conta-1',
      usuarioId: 'user-1',
    } as never);
    categoriasService.findOne.mockResolvedValue({
      id: 'categoria-1',
      tipo: TipoCategoria.RECEITA,
    } as never);

    const result = await service.create('user-1', createDto);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(contasService.findActiveForWrite).toHaveBeenCalledWith(
      'conta-1',
      'user-1',
      manager,
    );
    expect(manager.create).toHaveBeenCalledWith(
      Transacao,
      expect.objectContaining({
        categoriaId: 'categoria-1',
        contaId: 'conta-1',
        id: expect.any(String) as string,
        usuarioId: 'user-1',
      }),
    );
    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(result.contaId).toBe('conta-1');
    expect(logsService.logEntityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'TRANSACAO_CREATED',
        userId: 'user-1',
      }),
    );
    expect(manager.save.mock.invocationCallOrder[0]).toBeLessThan(
      logsService.logEntityEvent.mock.invocationCallOrder[0],
    );
  });

  it('rejects creation with an inactive account without persistence or success log', async () => {
    const error = new BusinessRuleException(
      'CONTA_INACTIVE',
      'Não é possível realizar operações financeiras em uma conta inativa.',
    );
    contasService.findActiveForWrite.mockRejectedValue(error);

    await expect(service.create('user-1', createDto)).rejects.toBe(error);

    expect(manager.create).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
    expect(categoriasService.findOne).not.toHaveBeenCalled();
    expect(logsService.logEntityEvent).not.toHaveBeenCalled();
  });

  it('preserves CONTA_NOT_FOUND for an absent or foreign account', async () => {
    const error = new ResourceNotFoundException(
      'CONTA_NOT_FOUND',
      'Conta não encontrada',
    );
    contasService.findActiveForWrite.mockRejectedValue(error);

    await expect(service.create('user-1', createDto)).rejects.toMatchObject({
      code: 'CONTA_NOT_FOUND',
      statusCode: 404,
    });
    expect(manager.save).not.toHaveBeenCalled();
    expect(logsService.logEntityEvent).not.toHaveBeenCalled();
  });

  it('rejects creation when category type does not match transaction type', async () => {
    contasService.findActiveForWrite.mockResolvedValue({
      ativa: true,
    } as never);
    categoriasService.findOne.mockResolvedValue({
      id: 'categoria-1',
      tipo: TipoCategoria.DESPESA,
    } as never);

    await expect(service.create('user-1', createDto)).rejects.toMatchObject({
      code: 'TRANSACAO_CATEGORY_TYPE_MISMATCH',
      statusCode: 400,
    });
    expect(manager.save).not.toHaveBeenCalled();
    expect(logsService.logEntityEvent).not.toHaveBeenCalled();
  });

  it('rejects creation with a non-positive amount before account validation', async () => {
    await expect(
      service.create('user-1', { ...createDto, valor: 0 }),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(contasService.findActiveForWrite).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
    expect(logsService.logEntityEvent).not.toHaveBeenCalled();
  });

  it('blocks PATCH when the currently linked account is inactive', async () => {
    const current = {
      categoriaId: 'categoria-1',
      contaId: 'conta-1',
      id: 'transacao-1',
      tipo: TipoTransacao.DESPESA,
      usuarioId: 'user-1',
      valor: 150,
    } as Transacao;
    manager.findOne.mockResolvedValueOnce(current);
    contasService.findActiveManyForWrite.mockRejectedValue(
      new BusinessRuleException('CONTA_INACTIVE', 'Conta inativa'),
    );

    await expect(
      service.update('transacao-1', 'user-1', { descricao: 'Ajuste' }),
    ).rejects.toMatchObject({ code: 'CONTA_INACTIVE' });

    expect(contasService.findActiveManyForWrite).toHaveBeenCalledWith(
      ['conta-1', 'conta-1'],
      'user-1',
      manager,
    );
    expect(manager.update).not.toHaveBeenCalled();
    expect(logsService.logEntityEvent).not.toHaveBeenCalled();
  });

  it('blocks PATCH when moving a transaction to an inactive account', async () => {
    manager.findOne.mockResolvedValueOnce({
      categoriaId: 'categoria-1',
      contaId: 'conta-1',
      id: 'transacao-1',
      tipo: TipoTransacao.DESPESA,
      usuarioId: 'user-1',
    } as Transacao);
    contasService.findActiveManyForWrite.mockRejectedValue(
      new BusinessRuleException('CONTA_INACTIVE', 'Conta inativa'),
    );

    await expect(
      service.update('transacao-1', 'user-1', { contaId: 'conta-2' }),
    ).rejects.toMatchObject({ code: 'CONTA_INACTIVE' });

    expect(contasService.findActiveManyForWrite).toHaveBeenCalledWith(
      ['conta-1', 'conta-2'],
      'user-1',
      manager,
    );
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('updates a transaction with active accounts in the same transaction', async () => {
    const current = {
      categoriaId: 'categoria-1',
      contaId: 'conta-1',
      id: 'transacao-1',
      tipo: TipoTransacao.DESPESA,
      usuarioId: 'user-1',
      valor: 150,
    } as Transacao;
    const updated = { ...current, descricao: 'Mercado atualizado' };
    manager.findOne
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(updated);
    contasService.findActiveManyForWrite.mockResolvedValue([
      { ativa: true, id: 'conta-1' } as Conta,
    ]);
    categoriasService.findOne.mockResolvedValue({
      id: 'categoria-1',
      tipo: TipoCategoria.DESPESA,
    } as never);

    const result = await service.update('transacao-1', 'user-1', {
      descricao: 'Mercado atualizado',
    });

    expect(manager.findOne).toHaveBeenCalledWith(
      Transacao,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      Transacao,
      expect.objectContaining({ id: 'transacao-1', usuarioId: 'user-1' }),
      { descricao: 'Mercado atualizado' },
    );
    expect(result).toBe(updated);
    expect(logsService.logEntityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'TRANSACAO_UPDATED' }),
    );
  });

  it('continues allowing DELETE without active-account validation', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      categoriaId: 'categoria-1',
      contaId: 'conta-inativa',
      id: 'transacao-1',
      tipo: TipoTransacao.DESPESA,
      usuarioId: 'user-1',
      valor: 150,
    } as Transacao);

    await service.remove('transacao-1', 'user-1');

    expect(repository.softDeleteByIdAndUser).toHaveBeenCalledWith(
      'transacao-1',
      'user-1',
    );
    expect(contasService.findActiveForWrite).not.toHaveBeenCalled();
    expect(contasService.findActiveManyForWrite).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('lists only repository-visible transactions', async () => {
    const transaction = {
      excluidoEm: null,
      id: 'transacao-1',
      usuarioId: 'user-1',
    } as Transacao;
    repository.findByUser.mockResolvedValue([transaction]);

    await expect(service.findAll('user-1', {})).resolves.toEqual([transaction]);
  });

  it('preserves the typed not-found contract for historical reads', async () => {
    repository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      service.findOne('transacao-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'TRANSACAO_NOT_FOUND',
      statusCode: 404,
    });
  });
});
