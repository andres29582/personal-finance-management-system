import { Repository } from 'typeorm';
import { LogsService } from '../logs/logs.service';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<
    Pick<Repository<User>, 'create' | 'findOneBy' | 'save' | 'update'>
  >;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new UsersService(
      repository as unknown as Repository<User>,
      logsService as unknown as LogsService,
    );
  });

  it('creates and saves a new user', async () => {
    const payload = {
      cep: '01001000',
      cidade: 'Sao Paulo',
      cpf: '52998224725',
      email: 'ana@example.com',
      endereco: 'Rua das Flores',
      nome: 'Ana',
      numero: '123',
      senhaHash: 'hash',
    };
    const entity = { id: 'user-1', ...payload } as User;

    repository.create.mockReturnValue(entity);
    repository.save.mockResolvedValue(entity);

    const result = await service.create(payload);

    expect(repository.create).toHaveBeenCalledWith(payload);
    expect(repository.save).toHaveBeenCalledWith(entity);
    expect(result.id).toBe('user-1');
  });

  it('finds a user by email', async () => {
    repository.findOneBy.mockResolvedValue({
      email: 'ana@example.com',
      id: 'user-1',
    } as User);

    const result = await service.findByEmail('ana@example.com');

    expect(repository.findOneBy).toHaveBeenCalledWith({
      email: 'ana@example.com',
    });
    expect(result?.id).toBe('user-1');
  });

  it('finds a user by cpf', async () => {
    repository.findOneBy.mockResolvedValue({
      cpf: '52998224725',
      id: 'user-1',
    } as User);

    const result = await service.findByCpf('52998224725');

    expect(repository.findOneBy).toHaveBeenCalledWith({
      cpf: '52998224725',
    });
    expect(result?.id).toBe('user-1');
  });

  it('updates the stored password hash', async () => {
    repository.update.mockResolvedValue({} as never);

    await service.updatePassword('user-1', 'new-hash');

    expect(repository.update).toHaveBeenCalledWith('user-1', {
      senhaHash: 'new-hash',
    });
  });

  it('returns the public profile for an existing user', async () => {
    repository.findOneBy.mockResolvedValue({
      cep: '01001000',
      cidade: 'Sao Paulo',
      cpf: '52998224725',
      dataRegistro: new Date('2026-04-08T00:00:00Z'),
      email: 'ana@example.com',
      endereco: 'Rua das Flores',
      id: 'user-1',
      moedaPadrao: 'BRL',
      nome: 'Ana',
      numero: '123',
    } as User);

    const result = await service.getProfile('user-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'user-1',
        cpf: '52998224725',
        endereco: 'Rua das Flores',
      }),
    );
  });

  it('updates the profile and normalizes cpf and cep', async () => {
    repository.findOneBy
      .mockResolvedValueOnce({
        cep: '01001000',
        cidade: 'Sao Paulo',
        cpf: '11144477735',
        email: 'ana@example.com',
        endereco: 'Rua das Flores',
        id: 'user-1',
        moedaPadrao: 'BRL',
        nome: 'Ana',
        numero: '123',
      } as User)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        cep: '01310930',
        cidade: 'Sao Paulo',
        cpf: '52998224725',
        dataRegistro: new Date('2026-04-08T00:00:00Z'),
        email: 'ana@example.com',
        endereco: 'Avenida Paulista',
        id: 'user-1',
        moedaPadrao: 'BRL',
        nome: 'Ana Maria',
        numero: '1000',
      } as User);
    repository.update.mockResolvedValue({} as never);

    const result = await service.updateProfile('user-1', {
      cep: '01310-930',
      cidade: 'Sao Paulo',
      cpf: '529.982.247-25',
      endereco: 'Avenida Paulista',
      nome: 'Ana Maria',
      numero: '1000',
    });

    expect(repository.update).toHaveBeenCalledWith('user-1', {
      cep: '01310930',
      cidade: 'Sao Paulo',
      cpf: '52998224725',
      email: undefined,
      endereco: 'Avenida Paulista',
      nome: 'Ana Maria',
      numero: '1000',
    });
    expect(result.cpf).toBe('52998224725');
    expect(logsService.logEntityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'PROFILE_UPDATED',
        entity: 'usuario',
        userId: 'user-1',
      }),
    );
  });
});
