import {
  AppConflictException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import { LogsService } from '../logs/logs.service';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<
    Pick<
      UserRepository,
      'create' | 'findByEmail' | 'findByCpf' | 'findById' | 'update'
    >
  >;
  let logsService: jest.Mocked<Pick<LogsService, 'logEntityEvent'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findByCpf: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };
    logsService = {
      logEntityEvent: jest.fn(),
    };

    service = new UsersService(
      repository as unknown as UserRepository,
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

    repository.create.mockResolvedValue(entity);

    const result = await service.create(payload);

    expect(repository.create).toHaveBeenCalledWith(payload);
    expect(result.id).toBe('user-1');
  });

  it('finds a user by email', async () => {
    repository.findByEmail.mockResolvedValue({
      email: 'ana@example.com',
      id: 'user-1',
    } as User);

    const result = await service.findByEmail('ana@example.com');

    expect(repository.findByEmail).toHaveBeenCalledWith('ana@example.com');
    expect(result?.id).toBe('user-1');
  });

  it('finds a user by cpf', async () => {
    repository.findByCpf.mockResolvedValue({
      cpf: '52998224725',
      id: 'user-1',
    } as User);

    const result = await service.findByCpf('52998224725');

    expect(repository.findByCpf).toHaveBeenCalledWith('52998224725');
    expect(result?.id).toBe('user-1');
  });

  it('updates the stored password hash', async () => {
    repository.update.mockResolvedValue({ id: 'user-1' } as User);

    await service.updatePassword('user-1', 'new-hash');

    expect(repository.update).toHaveBeenCalledWith('user-1', {
      senhaHash: 'new-hash',
    });
  });

  it('returns the public profile for an existing user', async () => {
    repository.findById.mockResolvedValue({
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

  it('rejects profile lookup when user does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    const promise = service.getProfile('user-1');

    await expect(promise).rejects.toBeInstanceOf(ResourceNotFoundException);
    await expect(promise).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      message: 'Usuario nao encontrado.',
      statusCode: 404,
    });
  });

  it('updates the profile and normalizes cpf and cep', async () => {
    repository.findById
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
    repository.findByCpf.mockResolvedValueOnce(null);
    repository.update.mockResolvedValue({
      id: 'user-1',
    } as User);

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

  it('rejects profile update when user does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    const promise = service.updateProfile('user-1', {
      nome: 'Ana Maria',
    });

    await expect(promise).rejects.toBeInstanceOf(ResourceNotFoundException);
    await expect(promise).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      message: 'Usuario nao encontrado.',
      statusCode: 404,
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects profile update when email already belongs to another user', async () => {
    repository.findById.mockResolvedValue({
      email: 'ana@example.com',
      id: 'user-1',
    } as User);
    repository.findByEmail.mockResolvedValue({
      email: 'maria@example.com',
      id: 'user-2',
    } as User);

    const promise = service.updateProfile('user-1', {
      email: 'maria@example.com',
    });

    await expect(promise).rejects.toBeInstanceOf(AppConflictException);
    await expect(promise).rejects.toMatchObject({
      code: 'USER_EMAIL_ALREADY_EXISTS',
      field: 'email',
      message: 'E-mail ja cadastrado.',
      statusCode: 409,
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects profile update with an invalid cpf', async () => {
    repository.findById.mockResolvedValue({
      cpf: '52998224725',
      email: 'ana@example.com',
      id: 'user-1',
    } as User);

    const promise = service.updateProfile('user-1', {
      cpf: '123',
    });

    await expect(promise).rejects.toBeInstanceOf(ValidationAppException);
    await expect(promise).rejects.toMatchObject({
      code: 'USER_INVALID_CPF',
      field: 'cpf',
      message: 'CPF deve ter 11 digitos.',
      statusCode: 422,
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects profile update when cpf already belongs to another user', async () => {
    repository.findById.mockResolvedValue({
      cpf: '11144477735',
      email: 'ana@example.com',
      id: 'user-1',
    } as User);
    repository.findByCpf.mockResolvedValue({
      cpf: '52998224725',
      id: 'user-2',
    } as User);

    const promise = service.updateProfile('user-1', {
      cpf: '529.982.247-25',
    });

    await expect(promise).rejects.toBeInstanceOf(AppConflictException);
    await expect(promise).rejects.toMatchObject({
      code: 'USER_CPF_ALREADY_EXISTS',
      field: 'cpf',
      message: 'CPF ja cadastrado.',
      statusCode: 409,
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects profile update with an invalid cep', async () => {
    repository.findById.mockResolvedValue({
      cpf: '52998224725',
      email: 'ana@example.com',
      id: 'user-1',
    } as User);

    const promise = service.updateProfile('user-1', {
      cep: '123',
    });

    await expect(promise).rejects.toBeInstanceOf(ValidationAppException);
    await expect(promise).rejects.toMatchObject({
      code: 'USER_INVALID_CEP',
      field: 'cep',
      message: 'CEP invalido.',
      statusCode: 422,
    });
    expect(repository.update).not.toHaveBeenCalled();
  });
});
