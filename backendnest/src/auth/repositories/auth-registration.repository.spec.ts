import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { Categoria } from '../../categorias/entities/categoria.entity';
import { DEFAULT_CATEGORIAS } from '../../categorias/default-categorias';
import { User } from '../../users/entities/user.entity';
import {
  AuthRegistrationRepository,
  RegistrationInput,
} from './auth-registration.repository';

describe('AuthRegistrationRepository', () => {
  const input: RegistrationInput = {
    id: '88c51f20-09da-45df-a70e-332311d6bfa1',
    nome: 'Registration fixture',
    email: 'registration@example.test',
    cpf: '12345678901',
    cep: '01001000',
    endereco: 'Synthetic address',
    numero: '1',
    cidade: 'Synthetic city',
    senhaHash: 'synthetic-hash',
    lgpdConsentimentoEm: new Date('2026-11-11T12:00:00Z'),
  };
  const user = Object.assign(new User(), input, { moedaPadrao: 'BRL' });
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    insert: jest.Mock;
  };
  let source: { transaction: jest.Mock; getRepository: jest.Mock };
  let repository: AuthRegistrationRepository;

  beforeEach(() => {
    manager = {
      create: jest.fn().mockReturnValue(user),
      save: jest.fn().mockResolvedValue(user),
      insert: jest.fn().mockResolvedValue({ identifiers: [] }),
    };
    source = {
      transaction: jest.fn((work: (value: EntityManager) => Promise<User>) =>
        work(manager as unknown as EntityManager),
      ),
      getRepository: jest.fn(),
    };
    repository = new AuthRegistrationRepository(
      source as unknown as DataSource,
    );
  });

  it('persists the new user and complete owned catalogue through the transaction manager', async () => {
    await expect(repository.createWithDefaultCategories(input)).resolves.toBe(
      user,
    );
    expect(source.transaction).toHaveBeenCalledTimes(1);
    expect(source.getRepository).not.toHaveBeenCalled();
    expect(manager.create).toHaveBeenCalledWith(User, input);
    expect(manager.save).toHaveBeenCalledWith(User, user);
    expect(manager.insert).toHaveBeenCalledWith(
      Categoria,
      DEFAULT_CATEGORIAS.map((category) => ({
        ...category,
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ) as string,
        usuarioId: input.id,
      })),
    );
    expect(manager.save.mock.invocationCallOrder[0]).toBeLessThan(
      manager.insert.mock.invocationCallOrder[0],
    );
  });

  function uniqueFailure(
    constraint: string,
    table = 'usuario',
    schema = 'public',
  ) {
    return new QueryFailedError(
      'INSERT synthetic registration',
      [],
      Object.assign(new Error('private diagnostic synthetic-hash'), {
        code: '23505',
        constraint,
        table,
        schema,
      }),
    );
  }

  it.each([
    ['usuario_email_key', 'AUTH_EMAIL_ALREADY_EXISTS', 'email'],
    ['usuario_cpf_key', 'AUTH_CPF_ALREADY_EXISTS', 'cpf'],
    ['uq_usuario_cpf', 'AUTH_CPF_ALREADY_EXISTS', 'cpf'],
  ])(
    'maps the recognized user uniqueness constraint %s',
    async (constraint, code, field) => {
      source.transaction.mockRejectedValue(uniqueFailure(constraint));
      await expect(
        repository.createWithDefaultCategories(input),
      ).rejects.toMatchObject({
        statusCode: 409,
        code,
        field,
      });
    },
  );

  it.each([
    uniqueFailure('another_constraint'),
    uniqueFailure('usuario_email_key', 'categoria'),
    uniqueFailure('usuario_email_key', 'usuario', 'another_schema'),
    new Error('private diagnostic synthetic-hash'),
  ])(
    'sanitizes unrecognized persistence errors without fabricating a user conflict',
    async (failure) => {
      source.transaction.mockRejectedValue(failure);
      await expect(
        repository.createWithDefaultCategories(input),
      ).rejects.toMatchObject({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Nao foi possivel criar a conta.',
      });
    },
  );

  it('does not resolve while category persistence is still pending', async () => {
    let release!: () => void;
    let inserted!: () => void;
    const started = new Promise<void>((resolve) => (inserted = resolve));
    manager.insert.mockImplementation(() => {
      inserted();
      return new Promise<void>((resolve) => (release = resolve));
    });
    let settled = false;
    const pending = repository
      .createWithDefaultCategories(input)
      .then((value) => {
        settled = true;
        return value;
      });
    await started;
    expect(settled).toBe(false);
    release();
    await expect(pending).resolves.toBe(user);
  });
});
