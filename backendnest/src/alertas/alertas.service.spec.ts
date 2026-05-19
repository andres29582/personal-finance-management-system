import { LogsService } from '../logs/logs.service';
import { ResourceNotFoundException } from '../common/exceptions';
import { Alerta } from './entities/alerta.entity';
import { TipoAlerta } from './enums/tipo-alerta.enum';
import { AlertasService } from './alertas.service';
import { AlertaRepository } from './repositories/alerta.repository';

describe('AlertasService', () => {
  let service: AlertasService;
  let repository: jest.Mocked<
    Pick<
      AlertaRepository,
      'create' | 'findActiveByUser' | 'findByIdAndUser' | 'updateByIdAndUser'
    >
  >;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findActiveByUser: jest.fn(),
      findByIdAndUser: jest.fn(),
      updateByIdAndUser: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new AlertasService(
      repository as unknown as AlertaRepository,
      logsService as unknown as LogsService,
    );
  });

  it('updates an alert using id and user criteria', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      id: 'alerta-1',
      tipo: TipoAlerta.VENCIMENTO_DIVIDA,
      usuarioId: 'user-1',
    } as Alerta);

    await service.update('alerta-1', 'user-1', {
      diasAnticipacion: 5,
    });

    expect(repository.updateByIdAndUser).toHaveBeenCalledWith(
      'alerta-1',
      'user-1',
      { diasAnticipacion: 5 },
    );
  });

  it('deactivates an alert using id and user criteria', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      id: 'alerta-1',
      tipo: TipoAlerta.VENCIMENTO_DIVIDA,
      usuarioId: 'user-1',
    } as Alerta);

    await service.deactivate('alerta-1', 'user-1');

    expect(repository.updateByIdAndUser).toHaveBeenCalledWith(
      'alerta-1',
      'user-1',
      { ativa: false },
    );
  });

  it('marks an alert as notified using id and user criteria', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      id: 'alerta-1',
      tipo: TipoAlerta.VENCIMENTO_DIVIDA,
      usuarioId: 'user-1',
    } as Alerta);

    await service.markNotified('alerta-1', 'user-1');

    expect(repository.updateByIdAndUser).toHaveBeenCalledWith(
      'alerta-1',
      'user-1',
      { ultimaNotificacion: expect.any(Date) as Date },
    );
  });

  it('throws a typed not found error when alert does not exist', async () => {
    repository.findByIdAndUser.mockResolvedValue(null);

    await expect(service.findOne('alerta-1', 'user-1')).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.findOne('alerta-1', 'user-1')).rejects.toMatchObject({
      code: 'ALERTA_NOT_FOUND',
      message: 'Alerta não encontrado',
      statusCode: 404,
    });
  });
});
