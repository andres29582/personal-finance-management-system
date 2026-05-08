import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ContasService } from '../contas/contas.service';
import { LogsService } from '../logs/logs.service';
import { Divida } from './entities/divida.entity';
import { DividasService } from './dividas.service';

describe('DividasService', () => {
  let service: DividasService;
  let repository: jest.Mocked<
    Pick<
      Repository<Divida>,
      'create' | 'find' | 'findOneBy' | 'save' | 'update'
    >
  >;
  let contasService: jest.Mocked<Pick<ContasService, 'findOne'>>;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    contasService = {
      findOne: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new DividasService(
      repository as unknown as Repository<Divida>,
      contasService as unknown as ContasService,
      logsService as unknown as LogsService,
    );
  });

  it('rejects creation with a non-positive total amount', async () => {
    await expect(
      service.create('user-1', {
        fechaInicio: '2026-04-01',
        fechaVencimiento: '2026-12-01',
        montoTotal: 0,
        nome: 'Cartao',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects creation with a non-positive monthly installment', async () => {
    await expect(
      service.create('user-1', {
        cuotaMensual: -10,
        fechaInicio: '2026-04-01',
        fechaVencimiento: '2026-12-01',
        montoTotal: 1000,
        nome: 'Cartao',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('updates a debt using id and user criteria', async () => {
    repository.findOneBy.mockResolvedValue({
      id: 'divida-1',
      usuarioId: 'user-1',
    } as Divida);

    await service.update('divida-1', 'user-1', {
      nome: 'Cartao atualizado',
    });

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'divida-1', usuarioId: 'user-1' },
      { nome: 'Cartao atualizado' },
    );
  });

  it('deactivates a debt using id and user criteria', async () => {
    repository.findOneBy.mockResolvedValue({
      id: 'divida-1',
      montoTotal: 1000,
      usuarioId: 'user-1',
    } as Divida);

    await service.deactivate('divida-1', 'user-1');

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'divida-1', usuarioId: 'user-1' },
      { ativa: false },
    );
  });
});
