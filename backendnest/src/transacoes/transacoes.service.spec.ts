import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CategoriasService } from '../categorias/categorias.service';
import { TipoCategoria } from '../categorias/enums/tipo-categoria.enum';
import { ContasService } from '../contas/contas.service';
import { LogsService } from '../logs/logs.service';
import { Transacao } from './entities/transacao.entity';
import { TipoTransacao } from './enums/tipo-transacao.enum';
import { TransacoesService } from './transacoes.service';

describe('TransacoesService', () => {
  let service: TransacoesService;
  let repository: jest.Mocked<
    Pick<
      Repository<Transacao>,
      'create' | 'delete' | 'find' | 'findOneBy' | 'save' | 'update'
    >
  >;
  let contasService: jest.Mocked<Pick<ContasService, 'findOne'>>;
  let categoriasService: jest.Mocked<Pick<CategoriasService, 'findOne'>>;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
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
      repository as unknown as Repository<Transacao>,
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

    await expect(
      service.create('user-1', {
        categoriaId: 'categoria-1',
        contaId: 'conta-1',
        data: '2026-04-01',
        descricao: 'Mercado',
        ehAjuste: false,
        tipo: TipoTransacao.DESPESA,
        valor: 150,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.save).not.toHaveBeenCalled();
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
    repository.create.mockReturnValue(transaction);
    repository.save.mockResolvedValue(transaction);

    const result = await service.create('user-1', {
      categoriaId: 'categoria-1',
      contaId: 'conta-1',
      data: '2026-04-01',
      descricao: 'Salario',
      ehAjuste: false,
      tipo: TipoTransacao.RECEITA,
      valor: 2000,
    });

    expect(repository.save).toHaveBeenCalledWith(transaction);
    expect(result.id).toBe('transacao-1');
    expect(logsService.logEntityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'transacao',
        event: 'TRANSACAO_CREATED',
        userId: 'user-1',
      }),
    );
  });
});
