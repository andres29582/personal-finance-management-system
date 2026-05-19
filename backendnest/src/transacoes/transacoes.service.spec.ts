import {
  BusinessRuleException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import { CategoriasService } from '../categorias/categorias.service';
import { TipoCategoria } from '../categorias/enums/tipo-categoria.enum';
import { ContasService } from '../contas/contas.service';
import { LogsService } from '../logs/logs.service';
import { Transacao } from './entities/transacao.entity';
import { TipoTransacao } from './enums/tipo-transacao.enum';
import { TransacoesService } from './transacoes.service';
import { TransacaoRepository } from './repositories/transacao.repository';

describe('TransacoesService', () => {
  let service: TransacoesService;
  let repository: jest.Mocked<
    Pick<
      TransacaoRepository,
      | 'create'
      | 'findByIdAndUser'
      | 'findByUser'
      | 'softDeleteByIdAndUser'
      | 'updateByIdAndUser'
    >
  >;
  let contasService: jest.Mocked<Pick<ContasService, 'findOne'>>;
  let categoriasService: jest.Mocked<Pick<CategoriasService, 'findOne'>>;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findByIdAndUser: jest.fn(),
      findByUser: jest.fn(),
      softDeleteByIdAndUser: jest.fn(),
      updateByIdAndUser: jest.fn(),
    };
    contasService = {
      findOne: jest.fn(),
    };
    categoriasService = {
      findOne: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new TransacoesService(
      repository as unknown as TransacaoRepository,
      contasService as unknown as ContasService,
      categoriasService as unknown as CategoriasService,
      logsService as unknown as LogsService,
    );
  });

  it('rejects creation when category type does not match transaction type', async () => {
    contasService.findOne.mockResolvedValue({ id: 'conta-1' } as never);
    categoriasService.findOne.mockResolvedValue({
      id: 'categoria-1',
      tipo: TipoCategoria.RECEITA,
    } as never);

    const promise = service.create('user-1', {
      categoriaId: 'categoria-1',
      contaId: 'conta-1',
      data: '2026-04-01',
      descricao: 'Mercado',
      ehAjuste: false,
      tipo: TipoTransacao.DESPESA,
      valor: 150,
    });

    await expect(promise).rejects.toBeInstanceOf(BusinessRuleException);
    await expect(promise).rejects.toMatchObject({
      code: 'TRANSACAO_CATEGORY_TYPE_MISMATCH',
      message: 'O tipo da categoria precisa coincidir com o tipo da transacao.',
      statusCode: 400,
    });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('creates a transaction when category type matches', async () => {
    const transaction = {
      categoriaId: 'categoria-1',
      contaId: 'conta-1',
      data: '2026-04-01',
      descricao: 'Salario',
      ehAjuste: false,
      id: 'transacao-1',
      tipo: TipoTransacao.RECEITA,
      usuarioId: 'user-1',
      valor: 2000,
    } as Transacao;

    contasService.findOne.mockResolvedValue({ id: 'conta-1' } as never);
    categoriasService.findOne.mockResolvedValue({
      id: 'categoria-1',
      tipo: TipoCategoria.RECEITA,
    } as never);
    repository.create.mockResolvedValue(transaction);

    const result = await service.create('user-1', {
      categoriaId: 'categoria-1',
      contaId: 'conta-1',
      data: '2026-04-01',
      descricao: 'Salario',
      ehAjuste: false,
      tipo: TipoTransacao.RECEITA,
      valor: 2000,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        categoriaId: 'categoria-1',
        contaId: 'conta-1',
        tipo: TipoTransacao.RECEITA,
        usuarioId: 'user-1',
        valor: 2000,
      }),
    );
    expect(result.id).toBe('transacao-1');
    expect(logsService.logEntityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'transacao',
        event: 'TRANSACAO_CREATED',
        userId: 'user-1',
      }),
    );
  });

  it('updates a transaction using id and user criteria', async () => {
    const transaction = {
      categoriaId: 'categoria-1',
      contaId: 'conta-1',
      id: 'transacao-1',
      tipo: TipoTransacao.DESPESA,
      usuarioId: 'user-1',
      valor: 150,
    } as Transacao;

    repository.findByIdAndUser.mockResolvedValue(transaction);
    categoriasService.findOne.mockResolvedValue({
      id: 'categoria-1',
      tipo: TipoCategoria.DESPESA,
    } as never);

    await service.update('transacao-1', 'user-1', {
      descricao: 'Mercado atualizado',
    });

    expect(repository.updateByIdAndUser).toHaveBeenCalledWith(
      'transacao-1',
      'user-1',
      { descricao: 'Mercado atualizado' },
    );
  });

  it('lists only transactions that are not soft-deleted', async () => {
    const activeTransaction = {
      excluidoEm: null,
      id: 'transacao-1',
      usuarioId: 'user-1',
    } as Transacao;

    repository.findByUser.mockResolvedValue([activeTransaction]);

    const result = await service.findAll('user-1', {});

    expect(repository.findByUser).toHaveBeenCalledWith('user-1', {});
    expect(result).toEqual([activeTransaction]);
  });

  it('does not find a transaction when it is soft-deleted', async () => {
    repository.findByIdAndUser.mockResolvedValue(null);

    const promise = service.findOne('transacao-1', 'user-1');

    await expect(promise).rejects.toBeInstanceOf(ResourceNotFoundException);
    await expect(promise).rejects.toMatchObject({
      code: 'TRANSACAO_NOT_FOUND',
      message: 'Transação não encontrada',
      statusCode: 404,
    });

    expect(repository.findByIdAndUser).toHaveBeenCalledWith(
      'transacao-1',
      'user-1',
    );
  });

  it('rejects creation with a non-positive amount', async () => {
    await expect(
      service.create('user-1', {
        categoriaId: 'categoria-1',
        contaId: 'conta-1',
        data: '2026-04-01',
        descricao: 'Valor invalido',
        ehAjuste: false,
        tipo: TipoTransacao.DESPESA,
        valor: 0,
      }),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(repository.create).not.toHaveBeenCalled();
    expect(contasService.findOne).not.toHaveBeenCalled();
  });
});
