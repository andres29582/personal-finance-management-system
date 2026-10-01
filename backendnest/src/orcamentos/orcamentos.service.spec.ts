import { QueryFailedError } from 'typeorm';
import {
  AppConflictException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import { LogsService } from '../logs/logs.service';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { OrcamentosService } from './orcamentos.service';
import { Orcamento } from './entities/orcamento.entity';
import { OrcamentoRepository } from './repositories/orcamento.repository';

describe('OrcamentosService', () => {
  let service: OrcamentosService;
  let orcamentosRepository: jest.Mocked<
    Pick<
      OrcamentoRepository,
      | 'create'
      | 'findByIdAndUser'
      | 'findByUserAndMonth'
      | 'findExpenseTransactionsByPeriod'
      | 'updateByIdAndUser'
    >
  >;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    orcamentosRepository = {
      create: jest.fn(),
      findByIdAndUser: jest.fn(),
      findByUserAndMonth: jest.fn(),
      findExpenseTransactionsByPeriod: jest.fn(),
      updateByIdAndUser: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new OrcamentosService(
      orcamentosRepository as unknown as OrcamentoRepository,
      logsService as unknown as LogsService,
    );
  });

  it('calculates the current spending progress for a budget month', async () => {
    orcamentosRepository.findByIdAndUser.mockResolvedValue({
      id: 'orcamento-1',
      mesReferencia: '2026-04',
      usuarioId: 'user-1',
      valorPlanejado: 1000,
    } as Orcamento);
    orcamentosRepository.findExpenseTransactionsByPeriod.mockResolvedValue([
      {
        id: 'transacao-1',
        tipo: TipoTransacao.DESPESA,
        valor: 850,
      },
    ] as Transacao[]);

    const result = await service.findOne('orcamento-1', 'user-1');

    expect(result.gastoAtual).toBe(850);
    expect(result.percentualUtilizado).toBe(85);
    expect(result.statusAlerta).toBe('alerta_80');
    expect(result.restante).toBe(150);
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

  it.each([
    ['23505', 'uq_orcamento_usuario_mes', true],
    ['23505', 'another_constraint', false],
    ['23503', 'uq_orcamento_usuario_mes', false],
  ])(
    'maps only the budget duplicate constraint (%s, %s)',
    async (code, constraint, mapped) => {
      const error = new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('database error'), { code, constraint }),
      );
      orcamentosRepository.create.mockRejectedValue(error);
      const result = service.create('user-1', {
        mesReferencia: '2026-04',
        valorPlanejado: 1000,
      });
      if (mapped) {
        await expect(result).rejects.toMatchObject({
          code: 'ORCAMENTO_ALREADY_EXISTS',
          statusCode: 409,
        });
      } else {
        await expect(result).rejects.toBe(error);
      }
      expect(logsService.logEntityEvent).not.toHaveBeenCalled();
    },
  );

  it('does not map a non-database error with duplicate-looking properties', async () => {
    const error = Object.assign(new Error('not SQL'), {
      code: '23505',
      constraint: 'uq_orcamento_usuario_mes',
    });
    orcamentosRepository.create.mockRejectedValue(error);
    await expect(
      service.create('user-1', {
        mesReferencia: '2026-04',
        valorPlanejado: 1000,
      }),
    ).rejects.toBe(error);
  });

  it.each([{}, { valorPlanejado: undefined }])(
    'rejects an empty update without writing (%j)',
    async (dto) => {
      orcamentosRepository.findByIdAndUser.mockResolvedValue({
        mesReferencia: '2026-04',
        valorPlanejado: 1000,
      } as Orcamento);
      orcamentosRepository.findExpenseTransactionsByPeriod.mockResolvedValue(
        [],
      );
      await expect(
        service.update('orcamento-1', 'user-1', dto),
      ).rejects.toMatchObject({
        code: 'ORCAMENTO_ATUALIZACAO_VAZIA',
        statusCode: 422,
      });
      expect(orcamentosRepository.updateByIdAndUser).not.toHaveBeenCalled();
      expect(logsService.logEntityEvent).not.toHaveBeenCalled();
    },
  );

  it('preserves not-found precedence for an empty update', async () => {
    orcamentosRepository.findByIdAndUser.mockResolvedValue(null);
    await expect(service.update('missing', 'user-1', {})).rejects.toMatchObject(
      { code: 'ORCAMENTO_NOT_FOUND', statusCode: 404 },
    );
    expect(orcamentosRepository.updateByIdAndUser).not.toHaveBeenCalled();
  });

  it('updates a budget using id and user criteria', async () => {
    orcamentosRepository.findByIdAndUser.mockResolvedValue({
      id: 'orcamento-1',
      mesReferencia: '2026-04',
      usuarioId: 'user-1',
      valorPlanejado: 1000,
    } as Orcamento);
    orcamentosRepository.findExpenseTransactionsByPeriod.mockResolvedValue([]);

    await service.update('orcamento-1', 'user-1', {
      valorPlanejado: 1200,
    });

    expect(orcamentosRepository.updateByIdAndUser).toHaveBeenCalledWith(
      'orcamento-1',
      'user-1',
      { valorPlanejado: 1200 },
    );
  });
});
