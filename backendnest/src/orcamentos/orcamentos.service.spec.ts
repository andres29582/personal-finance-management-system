import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LogsService } from '../logs/logs.service';
import { Transacao } from '../transacoes/entities/transacao.entity';
import { TipoTransacao } from '../transacoes/enums/tipo-transacao.enum';
import { OrcamentosService } from './orcamentos.service';
import { Orcamento } from './entities/orcamento.entity';

describe('OrcamentosService', () => {
  let service: OrcamentosService;
  let orcamentosRepository: jest.Mocked<
    Pick<
      Repository<Orcamento>,
      'create' | 'find' | 'findOneBy' | 'save' | 'update'
    >
  >;
  let transacoesRepository: jest.Mocked<Pick<Repository<Transacao>, 'find'>>;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    orcamentosRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    transacoesRepository = {
      find: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new OrcamentosService(
      orcamentosRepository as unknown as Repository<Orcamento>,
      transacoesRepository as unknown as Repository<Transacao>,
      logsService as unknown as LogsService,
    );
  });

  it('calculates the current spending progress for a budget month', async () => {
    orcamentosRepository.findOneBy.mockResolvedValue({
      id: 'orcamento-1',
      mesReferencia: '2026-04',
      usuarioId: 'user-1',
      valorPlanejado: 1000,
    } as Orcamento);
    transacoesRepository.find.mockResolvedValue([
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
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(orcamentosRepository.save).not.toHaveBeenCalled();
  });

  it('updates a budget using id and user criteria', async () => {
    orcamentosRepository.findOneBy.mockResolvedValue({
      id: 'orcamento-1',
      mesReferencia: '2026-04',
      usuarioId: 'user-1',
      valorPlanejado: 1000,
    } as Orcamento);
    transacoesRepository.find.mockResolvedValue([]);

    await service.update('orcamento-1', 'user-1', {
      valorPlanejado: 1200,
    });

    expect(orcamentosRepository.update).toHaveBeenCalledWith(
      { id: 'orcamento-1', usuarioId: 'user-1' },
      { valorPlanejado: 1200 },
    );
  });
});
