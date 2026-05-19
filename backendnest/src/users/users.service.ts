import { Injectable } from '@nestjs/common';
import {
  isValidCep,
  isValidCpf,
  normalizeDigits,
} from '../common/br-documents.util';
import {
  AppConflictException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';
import { LogsService } from '../logs/logs.service';
import { User } from './entities/user.entity';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserRepository } from './repositories/user.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly logsService: LogsService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async findByCpf(cpf: string): Promise<User | null> {
    return this.userRepository.findByCpf(cpf);
  }

  async create(user: Partial<User>): Promise<User> {
    return this.userRepository.create(user);
  }

  async findById(userId: string): Promise<User | null> {
    return this.userRepository.findById(userId);
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);

    if (!user) {
      throw new ResourceNotFoundException(
        'USER_NOT_FOUND',
        'Usuario nao encontrado.',
      );
    }

    return this.toPublicProfile(user);
  }

  async updateProfile(userId: string, dto: UpdateUserProfileDto) {
    const user = await this.findById(userId);

    if (!user) {
      throw new ResourceNotFoundException(
        'USER_NOT_FOUND',
        'Usuario nao encontrado.',
      );
    }

    const nextEmail = dto.email?.trim().toLowerCase();
    if (nextEmail && nextEmail !== user.email) {
      const existingByEmail = await this.findByEmail(nextEmail);
      if (existingByEmail && existingByEmail.id !== userId) {
        throw new AppConflictException(
          'USER_EMAIL_ALREADY_EXISTS',
          'E-mail ja cadastrado.',
          { field: 'email' },
        );
      }
    }

    const nextCpf = dto.cpf ? normalizeDigits(dto.cpf) : undefined;
    if (nextCpf !== undefined) {
      if (!isValidCpf(nextCpf)) {
        throw new ValidationAppException(
          'USER_INVALID_CPF',
          'CPF deve ter 11 digitos.',
          { field: 'cpf' },
        );
      }

      if (nextCpf !== user.cpf) {
        const existingByCpf = await this.findByCpf(nextCpf);
        if (existingByCpf && existingByCpf.id !== userId) {
          throw new AppConflictException(
            'USER_CPF_ALREADY_EXISTS',
            'CPF ja cadastrado.',
            { field: 'cpf' },
          );
        }
      }
    }

    const nextCep = dto.cep ? normalizeDigits(dto.cep) : undefined;
    if (nextCep !== undefined && !isValidCep(nextCep)) {
      throw new ValidationAppException('USER_INVALID_CEP', 'CEP invalido.', {
        field: 'cep',
      });
    }

    await this.userRepository.update(userId, {
      nome: dto.nome?.trim(),
      email: nextEmail,
      cpf: nextCpf,
      cep: nextCep,
      endereco: dto.endereco?.trim(),
      numero: dto.numero?.trim(),
      cidade: dto.cidade?.trim(),
    });

    const camposAlterados = (
      Object.keys(dto) as Array<keyof typeof dto>
    ).filter((key) => dto[key] !== undefined);

    await this.logsService.logEntityEvent({
      event: 'PROFILE_UPDATED',
      module: 'users',
      action: 'update',
      userId,
      entity: 'usuario',
      entityId: userId,
      message: 'Perfil do usuario atualizado.',
      details: { camposAlterados },
    });

    return this.getProfile(userId);
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    await this.userRepository.update(userId, {
      senhaHash: newPasswordHash,
    });
  }

  private toPublicProfile(user: User) {
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      cpf: user.cpf,
      cep: user.cep,
      endereco: user.endereco,
      numero: user.numero,
      cidade: user.cidade,
      moedaPadrao: user.moedaPadrao,
      dataRegistro: user.dataRegistro,
    };
  }
}
