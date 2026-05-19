import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { BaseRepository } from '../../common/abstract/base.repository';

/**
 * Repositorio de User
 * Extiende BaseRepository para tener CRUD automático
 * Agrega métodos específicos de negocio
 */
@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super(userRepository);
  }

  /**
   * Buscar usuario por email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Buscar usuario por CPF
   */
  async findByCpf(cpf: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { cpf },
    });
  }

  /**
   * Buscar usuarios activos (no eliminados)
   */
  async findActive(skip = 0, take = 100): Promise<User[]> {
    return this.userRepository.find({
      skip,
      take,
    });
  }

  /**
   * Contar usuarios activos
   */
  async countActive(): Promise<number> {
    return this.userRepository.count();
  }
}
