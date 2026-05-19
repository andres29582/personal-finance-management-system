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
