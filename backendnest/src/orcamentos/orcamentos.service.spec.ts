import {
  AppConflictException,
  BusinessRuleException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import { LogsService } from '../logs/logs.service';
import { CategoriasService } from '../categorias/categorias.service';
import { OrcamentosService } from './orcamentos.service';
import { Orcamento } from './entities/orcamento.entity';
import { OrcamentoCategoria } from './entities/orcamento-categoria.entity';
import { OrcamentoRepository } from './repositories/orcamento.repository';

describe('OrcamentosService', () => {
  let service: OrcamentosService;
  let orcamentosRepository: jest.Mocked<
    Pick<
      OrcamentoRepository,
      | 'create'
      | 'findByIdAndUser'
      | 'findByUser'
      | 'findByUserAndMonth'
      | 'findExpenseTotalsByMonths'
      | 'updateByIdAndUser'
    >
  >;
  let logsService: jest.Mocked<
    Pick<LogsService, 'logEntityEvent' | 'logEntityEventTransactional'>
  >;
  let categoriasService: jest.Mocked<
    Pick<CategoriasService, 'findActiveForWrite'>
  >;
  let manager: {
    create: jest.Mock;
    findOne: jest.Mock;
    getRepository: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };

  beforeEach(() => {
    orcamentosRepository = {
      create: jest.fn(),
      findByIdAndUser: jest.fn(),
      findByUser: jest.fn(),
      findByUserAndMonth: jest.fn(),
      findExpenseTotalsByMonths: jest.fn(),
      updateByIdAndUser: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
      logEntityEventTransactional: jest.fn(),
    };
    categoriasService = { findActiveForWrite: jest.fn() };
    manager = {
      create: jest.fn((_entity, data) => data),
      findOne: jest.fn(),
      getRepository: jest.fn(() => ({
        createQueryBuilder: () => ({
          getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
          select: () => ({
            where: () => ({
              getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
            }),
          }),
        }),
      })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      update: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };

    service = new OrcamentosService(
      orcamentosRepository as unknown as OrcamentoRepository,
      categoriasService as unknown as CategoriasService,
      dataSource as never,
      logsService as unknown as LogsService,
    );
  });

  it('calculates signed global and category progress from grouped expenses', async () => {
    orcamentosRepository.findByIdAndUser.mockResolvedValue({
      id: 'orcamento-1',
      mesReferencia: '2026-04',
      usuarioId: 'user-1',
      valorPlanejado: 100,
      alocacoes: [
        { id: 'allocation-1', categoriaId: 'food', valorPlanejado: 50 },
      ] as OrcamentoCategoria[],
    } as Orcamento);
    orcamentosRepository.findExpenseTotalsByMonths.mockResolvedValue([
      { mesReferencia: '2026-04', categoriaId: 'food', gastoAtual: '60' },
      {
        mesReferencia: '2026-04',
        categoriaId: 'transport',
        gastoAtual: '45',
      },
    ]);

    const result = await service.findOne('orcamento-1', 'user-1');

    expect(result).toMatchObject({
      gastoAtual: 105,
      percentualUtilizado: 105,
      restante: -5,
      statusAlerta: 'estourado',
    });
    expect(result.alocacoes).toEqual([
      expect.objectContaining({
        categoriaId: 'food',
        gastoAtual: 60,
        percentualUtilizado: 120,
        restante: -10,
        statusAlerta: 'estourado',
      }),
    ]);
  });

  it('marks exact 80 percent usage as an alert without treating it as exceeded', async () => {
    orcamentosRepository.findByIdAndUser.mockResolvedValue({
      id: 'orcamento-1',
      mesReferencia: '2026-04',
      usuarioId: 'user-1',
      valorPlanejado: 100,
      alocacoes: [
        { id: 'allocation-1', categoriaId: 'food', valorPlanejado: 40 },
      ] as OrcamentoCategoria[],
    } as Orcamento);
    orcamentosRepository.findExpenseTotalsByMonths.mockResolvedValue([
      { mesReferencia: '2026-04', categoriaId: 'food', gastoAtual: '40' },
      { mesReferencia: '2026-04', categoriaId: 'transport', gastoAtual: '40' },
    ]);

    await expect(
      service.findOne('orcamento-1', 'user-1'),
    ).resolves.toMatchObject({
      gastoAtual: 80,
      restante: 20,
      statusAlerta: 'alerta_80',
      alocacoes: [
        expect.objectContaining({
          categoriaId: 'food',
          gastoAtual: 40,
          restante: 0,
          statusAlerta: 'estourado',
        }),
      ],
    });
  });

  it('uses one grouped aggregate read for every budget in findAll', async () => {
    orcamentosRepository.findByUser.mockResolvedValue([
      {
        id: 'orcamento-1',
        mesReferencia: '2026-04',
        usuarioId: 'user-1',
        valorPlanejado: 100,
      },
      {
        id: 'orcamento-2',
        mesReferencia: '2026-05',
        usuarioId: 'user-1',
        valorPlanejado: 200,
      },
    ] as Orcamento[]);
    orcamentosRepository.findExpenseTotalsByMonths.mockResolvedValue([
      { mesReferencia: '2026-04', categoriaId: 'food', gastoAtual: '50' },
      { mesReferencia: '2026-05', categoriaId: 'food', gastoAtual: '25' },
    ]);

    const result = await service.findAll('user-1', {});

    expect(
      orcamentosRepository.findExpenseTotalsByMonths,
    ).toHaveBeenCalledTimes(1);
    expect(orcamentosRepository.findExpenseTotalsByMonths).toHaveBeenCalledWith(
      'user-1',
      ['2026-04', '2026-05'],
    );
    expect(result).toEqual([
      expect.objectContaining({ gastoAtual: 50 }),
      expect.objectContaining({ gastoAtual: 25 }),
    ]);
  });

  it('rejects creation with a non-positive planned amount', async () => {
    await expect(
      service.create('user-1', {
        mesReferencia: '2026-04',
        valorPlanejado: 0,
      }),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(orcamentosRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid budget month before querying or writing', async () => {
    await expect(
      service.create('user-1', {
        mesReferencia: '2026-13',
        valorPlanejado: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_MONTH_REFERENCE',
      field: 'mes',
      message: 'Mes de referencia invalido. Use o formato YYYY-MM.',
      statusCode: 422,
    });

    expect(orcamentosRepository.findByUserAndMonth).not.toHaveBeenCalled();
    expect(orcamentosRepository.create).not.toHaveBeenCalled();
  });

  it('rejects creation when a budget already exists for the month', async () => {
    orcamentosRepository.findByUserAndMonth.mockResolvedValue({
      id: 'orcamento-1',
      mesReferencia: '2026-04',
      usuarioId: 'user-1',
    } as Orcamento);

    await expect(
      service.create('user-1', {
        mesReferencia: '2026-04',
        valorPlanejado: 1000,
      }),
    ).rejects.toBeInstanceOf(AppConflictException);
    await expect(
      service.create('user-1', {
        mesReferencia: '2026-04',
        valorPlanejado: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'ORCAMENTO_ALREADY_EXISTS',
      message: 'Ja existe um orcamento cadastrado para este mes.',
      statusCode: 409,
    });

    expect(orcamentosRepository.create).not.toHaveBeenCalled();
  });

  it('keeps budget creation inside the transactional audit boundary', async () => {
    const auditFailure = new Error('audit failed');
    logsService.logEntityEventTransactional.mockRejectedValue(auditFailure);

    await expect(
      service.create('user-1', {
        mesReferencia: '2099-04',
        valorPlanejado: 1000,
      }),
    ).rejects.toBe(auditFailure);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(logsService.logEntityEventTransactional).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'ORCAMENTO_CREATED' }),
      manager,
    );
  });

  it('maps the monthly-budget unique constraint race to the existing conflict', async () => {
    dataSource.transaction.mockRejectedValue({
      code: '23505',
      constraint: 'uq_orcamento_usuario_mes',
    });

    await expect(
      service.create('user-1', {
        mesReferencia: '2099-04',
        valorPlanejado: 1000,
      }),
    ).rejects.toMatchObject({
      code: 'ORCAMENTO_ALREADY_EXISTS',
      statusCode: 409,
    });
  });

  it('throws a typed not found error when budget does not exist', async () => {
    orcamentosRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      service.findOne('orcamento-1', 'user-1'),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
    await expect(
      service.findOne('orcamento-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'ORCAMENTO_NOT_FOUND',
      message: 'Orcamento nao encontrado.',
      statusCode: 404,
    });
  });

  it('updates a budget using id and user criteria', async () => {
    orcamentosRepository.findByIdAndUser.mockResolvedValue({
      id: 'orcamento-1',
      mesReferencia: '2099-04',
      usuarioId: 'user-1',
      valorPlanejado: 1000,
    } as Orcamento);
    orcamentosRepository.findExpenseTotalsByMonths.mockResolvedValue([]);
    manager.findOne.mockResolvedValue({
      id: 'orcamento-1',
      mesReferencia: '2099-04',
      usuarioId: 'user-1',
      valorPlanejado: 1000,
    } as Orcamento);

    await service.update('orcamento-1', 'user-1', {
      valorPlanejado: 1200,
    });

    expect(manager.update).toHaveBeenCalledWith(
      Orcamento,
      { id: 'orcamento-1', usuarioId: 'user-1' },
      { valorPlanejado: 1200 },
    );
  });

  it('rejects an update without a planned amount', async () => {
    await expect(
      service.update('orcamento-1', 'user-1', {}),
    ).rejects.toMatchObject({
      code: 'ORCAMENTO_UPDATE_REQUIRES_VALUE',
      field: 'valorPlanejado',
      statusCode: 400,
    });

    expect(orcamentosRepository.findByIdAndUser).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('rejects updates to a past budget month', async () => {
    orcamentosRepository.findByIdAndUser.mockResolvedValue({
      id: 'orcamento-1',
      mesReferencia: '2000-01',
      usuarioId: 'user-1',
      valorPlanejado: 1000,
    } as Orcamento);
    orcamentosRepository.findExpenseTotalsByMonths.mockResolvedValue([]);
    manager.findOne.mockResolvedValue({
      id: 'orcamento-1',
      mesReferencia: '2000-01',
      usuarioId: 'user-1',
      valorPlanejado: 1000,
    } as Orcamento);

    await expect(
      service.update('orcamento-1', 'user-1', { valorPlanejado: 1200 }),
    ).rejects.toBeInstanceOf(BusinessRuleException);
    await expect(
      service.update('orcamento-1', 'user-1', { valorPlanejado: 1200 }),
    ).rejects.toMatchObject({
      code: 'ORCAMENTO_PAST_MONTH_IMMUTABLE',
      statusCode: 400,
    });

    expect(manager.update).not.toHaveBeenCalled();
  });
});
