import { Repository, FindOptionsWhere, ObjectLiteral } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

/**
 * Interfaz que define el contrato de cualquier repositorio
 * Esto permite cambiar de TypeORM a Prisma sin afectar servicios
 */
export interface IRepository<T extends ObjectLiteral> {
  findById(id: string | number): Promise<T | null>;
  findOne(where: Partial<T>): Promise<T | null>;
  findAll(skip?: number, take?: number): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string | number, data: Partial<T>): Promise<T>;
  delete(id: string | number): Promise<boolean>;
  count(where?: FindOptionsWhere<T>): Promise<number>;
}

/**
 * Clase base abstracta que implementa CRUD genérico
 * Extiende esta clase para agregar métodos específicos
 */
export abstract class BaseRepository<
  T extends ObjectLiteral,
> implements IRepository<T> {
  constructor(protected repository: Repository<T>) {}

  async findById(id: string | number): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
    });
  }

  async findOne(where: Partial<T>): Promise<T | null> {
    return this.repository.findOne({ where: where as FindOptionsWhere<T> });
  }

  async findAll(skip = 0, take = 100): Promise<T[]> {
    return this.repository.find({ skip, take });
  }

  async create(data: Partial<T>): Promise<T> {
    return this.repository.save(data as T);
  }

  async update(id: string | number, data: Partial<T>): Promise<T> {
    await this.repository.update(id, data as QueryDeepPartialEntity<T>);
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Entity with id ${id} not found after update`);
    }
    return updated;
  }

  async delete(id: string | number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async count(where?: FindOptionsWhere<T>): Promise<number> {
    return this.repository.count({ where });
  }
}
