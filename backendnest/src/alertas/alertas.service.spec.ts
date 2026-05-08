import { Repository } from 'typeorm';
import { LogsService } from '../logs/logs.service';
import { Alerta } from './entities/alerta.entity';
import { TipoAlerta } from './enums/tipo-alerta.enum';
import { AlertasService } from './alertas.service';

describe('AlertasService', () => {
  let service: AlertasService;
  let repository: jest.Mocked<
    Pick<
      Repository<Alerta>,
      'create' | 'find' | 'findOneBy' | 'save' | 'update'
    >
  >;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new AlertasService(
      repository as unknown as Repository<Alerta>,
      logsService as unknown as LogsService,
    );
  });

  it('updates an alert using id and user criteria', async () => {
    repository.findOneBy.mockResolvedValue({
      id: 'alerta-1',
      tipo: TipoAlerta.VENCIMENTO_DIVIDA,
      usuarioId: 'user-1',
    } as Alerta);

    await service.update('alerta-1', 'user-1', {
      diasAnticipacion: 5,
    });

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'alerta-1', usuarioId: 'user-1' },
      { diasAnticipacion: 5 },
    );
  });

  it('deactivates an alert using id and user criteria', async () => {
    repository.findOneBy.mockResolvedValue({
      id: 'alerta-1',
      tipo: TipoAlerta.VENCIMENTO_DIVIDA,
      usuarioId: 'user-1',
    } as Alerta);

    await service.deactivate('alerta-1', 'user-1');

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'alerta-1', usuarioId: 'user-1' },
      { ativa: false },
    );
  });

  it('marks an alert as notified using id and user criteria', async () => {
    repository.findOneBy.mockResolvedValue({
      id: 'alerta-1',
      tipo: TipoAlerta.VENCIMENTO_DIVIDA,
      usuarioId: 'user-1',
    } as Alerta);

    await service.markNotified('alerta-1', 'user-1');

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'alerta-1', usuarioId: 'user-1' },
      { ultimaNotificacion: expect.any(Date) as Date },
    );
  });
});
