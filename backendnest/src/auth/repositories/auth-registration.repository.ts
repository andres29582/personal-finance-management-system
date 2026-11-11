import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import { DEFAULT_CATEGORIAS } from '../../categorias/default-categorias';
import { Categoria } from '../../categorias/entities/categoria.entity';
import {
  AppConflictException,
  InternalServerAppException,
} from '../../common/exceptions';
import { User } from '../../users/entities/user.entity';

export type RegistrationInput = Pick<
  User,
  | 'id'
  | 'nome'
  | 'email'
  | 'cpf'
  | 'cep'
  | 'endereco'
  | 'numero'
  | 'cidade'
  | 'senhaHash'
  | 'lgpdConsentimentoEm'
>;

type RegistrationDriverError = {
  code?: unknown;
  schema?: unknown;
  table?: unknown;
  constraint?: unknown;
};

@Injectable()
export class AuthRegistrationRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createWithDefaultCategories(input: RegistrationInput): Promise<User> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const user = await manager.save(User, manager.create(User, input));
        await manager.insert(
          Categoria,
          DEFAULT_CATEGORIAS.map((category) => ({
            ...category,
            id: randomUUID(),
            usuarioId: user.id,
          })),
        );
        return user;
      });
    } catch (error: unknown) {
      const driver: RegistrationDriverError | undefined =
        error instanceof QueryFailedError
          ? (error.driverError as RegistrationDriverError)
          : undefined;
      if (
        driver?.code === '23505' &&
        driver.schema === 'public' &&
        driver.table === 'usuario'
      ) {
        if (driver.constraint === 'usuario_email_key') {
          throw new AppConflictException(
            'AUTH_EMAIL_ALREADY_EXISTS',
            'E-mail ja cadastrado',
            { field: 'email' },
          );
        }
        if (
          driver.constraint === 'usuario_cpf_key' ||
          driver.constraint === 'uq_usuario_cpf'
        ) {
          throw new AppConflictException(
            'AUTH_CPF_ALREADY_EXISTS',
            'CPF ja cadastrado',
            { field: 'cpf' },
          );
        }
      }
      // Driver diagnostics may contain the password hash and personal data.
      throw new InternalServerAppException('Nao foi possivel criar a conta.');
    }
  }
}
