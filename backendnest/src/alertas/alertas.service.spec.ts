import { LogsService } from '../logs/logs.service';
import { ResourceNotFoundException } from '../common/exceptions';
import { Alerta } from './entities/alerta.entity';
import { TipoAlerta } from './enums/tipo-alerta.enum';
import { AlertasService } from './alertas.service';
import { AlertaRepository } from './repositories/alerta.repository';
import { DividasService } from '../dividas/dividas.service';
import { MetasService } from '../metas/metas.service';
import { OrcamentosService } from '../orcamentos/orcamentos.service';

describe('AlertasService', () => {
  let service: AlertasService;
  let repository: jest.Mocked<
    Pick<
      AlertaRepository,
      'create' | 'findActiveByUser' | 'findByIdAndUser' | 'updateByIdAndUser'
    >
  >;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;
  let dividasService: jest.Mocked<Pick<DividasService, 'findOne'>>;
  let metasService: jest.Mocked<Pick<MetasService, 'findOne'>>;
  let orcamentosService: jest.Mocked<Pick<OrcamentosService, 'findOne'>>;

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
    dividasService = { findOne: jest.fn() };
    metasService = { findOne: jest.fn() };
    orcamentosService = { findOne: jest.fn() };

    service = new AlertasService(
      repository as unknown as AlertaRepository,
      logsService as unknown as LogsService,
      dividasService as unknown as DividasService,
      metasService as unknown as MetasService,
      orcamentosService as unknown as OrcamentosService,
    );
  });

  it.each([
    [TipoAlerta.VENCIMENTO_META, 'metasService'],
    [TipoAlerta.VENCIMENTO_DIVIDA, 'dividasService'],
    [TipoAlerta.LIMITE_GASTO, 'orcamentosService'],
  ] as const)(
    'validates the %s reference for its type',
    async (tipo, serviceName) => {
      repository.create.mockResolvedValue({ id: 'alerta-1' } as Alerta);
      const services = { dividasService, metasService, orcamentosService };

      await service.create('user-1', {
        diasAnticipacion: 3,
        referenciaId: 'ref-1',
        tipo,
      });

      expect(services[serviceName].findOne).toHaveBeenCalledWith(
        'ref-1',
        'user-1',
      );
      expect(repository.create).toHaveBeenCalled();
    },
  );

  it('does not create an alert when its typed reference does not exist', async () => {
    metasService.findOne.mockRejectedValue(
      new ResourceNotFoundException('META_NOT_FOUND', 'Meta nao encontrada'),
    );

    await expect(
      service.create('user-1', {
        diasAnticipacion: 3,
        referenciaId: 'foreign-meta',
        tipo: TipoAlerta.VENCIMENTO_META,
      }),
    ).rejects.toMatchObject({ code: 'META_NOT_FOUND' });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('does not accept a debt id as a meta reference', async () => {
    metasService.findOne.mockRejectedValue(
      new ResourceNotFoundException('META_NOT_FOUND', 'Meta nao encontrada'),
    );

    await expect(
      service.create('user-1', {
        diasAnticipacion: 3,
        referenciaId: 'divida-1',
        tipo: TipoAlerta.VENCIMENTO_META,
      }),
    ).rejects.toMatchObject({ code: 'META_NOT_FOUND' });

    expect(metasService.findOne).toHaveBeenCalledWith('divida-1', 'user-1');
    expect(dividasService.findOne).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('does not create an alert when its reference belongs to another user', async () => {
    metasService.findOne.mockRejectedValue(
      new ResourceNotFoundException('META_NOT_FOUND', 'Meta nao encontrada'),
    );

    await expect(
      service.create('user-1', {
        diasAnticipacion: 3,
        referenciaId: 'other-user-meta',
        tipo: TipoAlerta.VENCIMENTO_META,
      }),
    ).rejects.toMatchObject({ code: 'META_NOT_FOUND' });

    expect(metasService.findOne).toHaveBeenCalledWith(
      'other-user-meta',
      'user-1',
    );
    expect(repository.create).not.toHaveBeenCalled();
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
