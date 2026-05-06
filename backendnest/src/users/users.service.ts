import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  isValidCep,
  isValidCpf,
  normalizeDigits,
} from '../common/br-documents.util';
import { LogsService } from '../logs/logs.service';
import { User } from './entities/user.entity';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly logsService: LogsService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  async findByCpf(cpf: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ cpf });
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.usersRepository.create(user);
    return this.usersRepository.save(newUser);
  }

  async findById(userId: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id: userId });
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    return this.toPublicProfile(user);
  }

  async updateProfile(userId: string, dto: UpdateUserProfileDto) {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    const nextEmail = dto.email?.trim().toLowerCase();
    if (nextEmail && nextEmail !== user.email) {
      const existingByEmail = await this.findByEmail(nextEmail);
      if (existingByEmail && existingByEmail.id !== userId) {
        throw new ConflictException('E-mail ja cadastrado.');
      }
    }

    const nextCpf = dto.cpf ? normalizeDigits(dto.cpf) : undefined;
    if (nextCpf !== undefined) {
      if (!isValidCpf(nextCpf)) {
        throw new BadRequestException('CPF deve ter 11 digitos.');
      }

      if (nextCpf !== user.cpf) {
        const existingByCpf = await this.findByCpf(nextCpf);
        if (existingByCpf && existingByCpf.id !== userId) {
          throw new ConflictException('CPF ja cadastrado.');
        }
      }
    }

    const nextCep = dto.cep ? normalizeDigits(dto.cep) : undefined;
    if (nextCep !== undefined && !isValidCep(nextCep)) {
      throw new BadRequestException('CEP invalido.');
    }

    await this.usersRepository.update(userId, {
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
    await this.usersRepository.update(userId, {
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
