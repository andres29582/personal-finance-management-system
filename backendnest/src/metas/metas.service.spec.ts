import {
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import { ContasService } from '../contas/contas.service';
import { DividasService } from '../dividas/dividas.service';
import { LogsService } from '../logs/logs.service';
import { TipoMeta } from './enums/tipo-meta.enum';
import { Meta } from './entities/meta.entity';
import { MetasService } from './metas.service';
import { MetaRepository } from './repositories/meta.repository';

describe('MetasService', () => {
  let service: MetasService;
  let repository: jest.Mocked<
    Pick<
      MetaRepository,
      'create' | 'findActiveByUser' | 'findByIdAndUser' | 'updateByIdAndUser'
    >
  >;
  let contasService: jest.Mocked<Pick<ContasService, 'findOne'>>;
  let dividasService: jest.Mocked<Pick<DividasService, 'findOne'>>;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findActiveByUser: jest.fn(),
      findByIdAndUser: jest.fn(),
      updateByIdAndUser: jest.fn(),
    };
    contasService = {
      findOne: jest.fn(),
    };
    dividasService = {
      findOne: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new MetasService(
      repository as unknown as MetaRepository,
      contasService as unknown as ContasService,
      dividasService as unknown as DividasService,
      logsService as unknown as LogsService,
    );
  });

  it('rejects creation with a non-positive target amount', async () => {
    await expect(
      service.create('user-1', {
        fechaLimite: '2026-12-31',
        montoObjetivo: 0,
        nome: 'Reserva',
        tipo: TipoMeta.ECONOMIA,
      }),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects update with a non-positive current amount', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      id: 'meta-1',
      usuarioId: 'user-1',
    } as Meta);

    await expect(
      service.update('meta-1', 'user-1', {
        montoActual: 0,
      }),
    ).rejects.toBeInstanceOf(ValidationAppException);

    expect(repository.updateByIdAndUser).not.toHaveBeenCalled();
  });

  it('updates a goal using id and user criteria', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      id: 'meta-1',
      usuarioId: 'user-1',
    } as Meta);

    await service.update('meta-1', 'user-1', {
      nome: 'Reserva atualizada',
    });

    expect(repository.updateByIdAndUser).toHaveBeenCalledWith(
      'meta-1',
      'user-1',
      { nome: 'Reserva atualizada' },
    );
  });

  it('deactivates a goal using id and user criteria', async () => {
    repository.findByIdAndUser.mockResolvedValue({
      id: 'meta-1',
      usuarioId: 'user-1',
    } as Meta);

    await service.deactivate('meta-1', 'user-1');

    expect(repository.updateByIdAndUser).toHaveBeenCalledWith(
      'meta-1',
      'user-1',
      { ativa: false },
    );
  });

  it('throws a typed not found error when goal does not exist', async () => {
    repository.findByIdAndUser.mockResolvedValue(null);

    await expect(service.findOne('meta-1', 'user-1')).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
    await expect(service.findOne('meta-1', 'user-1')).rejects.toMatchObject({
      code: 'META_NOT_FOUND',
      message: 'Meta não encontrada',
      statusCode: 404,
    });
  });
});
