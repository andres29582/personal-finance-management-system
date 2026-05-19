# 📚 EJEMPLO COMPLETO: Users Service Refactorizado

Este es un ejemplo de cómo quedaría `users.service.ts` después de refactorizar para Fase 1.

---

## ANTES (MVP)

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new Error('Email already exists'); // ❌ Excepción genérica
    }

    // ... validar datos...

    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }

  async findById(id: string) {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new Error('User not found'); // ❌ Excepción genérica
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new Error('User not found'); // ❌ Excepción genérica
    }

    await this.usersRepository.update(id, updateUserDto);
    return this.usersRepository.findOne({ where: { id } });
  }

  async delete(id: string) {
    const result = await this.usersRepository.delete(id);
    return result.affected > 0;
  }
}
```

---

## DESPUÉS (Fase 1)

```typescript
import { Injectable } from '@nestjs/common';
import { UserRepository } from './repositories/user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ResourceNotFoundException,
  ConflictException,
  ValidationException,
} from '../common/exceptions';

/**
 * Servicio de Usuarios
 * Lógica de negocio separada de persistencia (Repository Pattern)
 */
@Injectable()
export class UsersService {
  constructor(private userRepository: UserRepository) {} // ✅ Repository inyectado

  /**
   * Crear nuevo usuario
   * @throws ConflictException si email ya existe
   * @throws ValidationException si datos inválidos
   */
  async create(createUserDto: CreateUserDto) {
    // 1. Validar email no duplicado
    const existingUser = await this.userRepository.findByEmail(
      createUserDto.email,
    );

    if (existingUser) {
      // ✅ Excepción tipificada con código y mensaje
      throw new ConflictException(
        'EMAIL_ALREADY_EXISTS',
        'Este email ya está registrado',
      );
    }

    // 2. Validar CPF si se proporciona
    if (createUserDto.cpf) {
      const existingCpf = await this.userRepository.findByCpf(
        createUserDto.cpf,
      );
      if (existingCpf) {
        throw new ConflictException(
          'CPF_ALREADY_EXISTS',
          'Este CPF ya está registrado',
        );
      }

      // Validar formato de CPF (ejemplo)
      if (!this.isValidCpf(createUserDto.cpf)) {
        throw new ValidationException(
          'INVALID_CPF',
          'CPF no tiene un formato válido',
          'cpf',
        );
      }
    }

    // 3. Validar email
    if (!this.isValidEmail(createUserDto.email)) {
      throw new ValidationException(
        'INVALID_EMAIL',
        'Email no es válido',
        'email',
      );
    }

    // 4. Crear usuario (Repository maneja la persistencia)
    const user = await this.userRepository.create({
      ...createUserDto,
      dataRegistro: new Date(),
    });

    // 5. Retornar usuario (sin password hash)
    return this.sanitizeUser(user);
  }

  /**
   * Obtener perfil de usuario
   * @throws ResourceNotFoundException si usuario no existe
   */
  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      // ✅ Excepción tipificada con status 404
      throw new ResourceNotFoundException('Usuario', userId);
    }

    return this.sanitizeUser(user);
  }

  /**
   * Listar usuarios (con paginación)
   */
  async list(skip = 0, take = 10) {
    const [users, total] = await Promise.all([
      this.userRepository.findActive(skip, take), // ✅ Método específico del repo
      this.userRepository.countActive(), // ✅ Reutilizar lógica
    ]);

    return {
      data: users.map((u) => this.sanitizeUser(u)),
      total,
      skip,
      take,
    };
  }

  /**
   * Actualizar perfil
   * @throws ResourceNotFoundException si usuario no existe
   * @throws ValidationException si datos inválidos
   * @throws ConflictException si email/cpf ya existe
   */
  async updateProfile(userId: string, updateUserDto: UpdateUserDto) {
    // 1. Verificar que usuario existe
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new ResourceNotFoundException('Usuario', userId);
    }

    // 2. Si actualiza email, verificar que no exista otro
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.userRepository.findByEmail(
        updateUserDto.email,
      );

      if (existingEmail) {
        throw new ConflictException(
          'EMAIL_ALREADY_EXISTS',
          'Este email ya está en uso',
        );
      }

      if (!this.isValidEmail(updateUserDto.email)) {
        throw new ValidationException(
          'INVALID_EMAIL',
          'Email no es válido',
          'email',
        );
      }
    }

    // 3. Si actualiza CPF, verificar validez
    if (updateUserDto.cpf && updateUserDto.cpf !== user.cpf) {
      if (!this.isValidCpf(updateUserDto.cpf)) {
        throw new ValidationException(
          'INVALID_CPF',
          'CPF no tiene un formato válido',
          'cpf',
        );
      }

      const existingCpf = await this.userRepository.findByCpf(
        updateUserDto.cpf,
      );

      if (existingCpf) {
        throw new ConflictException(
          'CPF_ALREADY_EXISTS',
          'Este CPF ya está en uso',
        );
      }
    }

    // 4. Actualizar (Repository maneja)
    const updated = await this.userRepository.update(userId, updateUserDto);

    return this.sanitizeUser(updated);
  }

  /**
   * Obtener por email (para login, por ejemplo)
   * @throws ResourceNotFoundException si usuario no existe
   */
  async findByEmail(email: string) {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new ResourceNotFoundException('Usuario', email);
    }

    return user; // Retornar completo (se usa en auth internamente)
  }

  /**
   * Eliminar usuario (soft delete)
   * @throws ResourceNotFoundException si usuario no existe
   */
  async delete(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new ResourceNotFoundException('Usuario', userId);
    }

    await this.userRepository.delete(userId);
    return { success: true };
  }

  /**
   * Utilidad: Limpiar datos sensibles
   */
  private sanitizeUser(user: User) {
    const { senhaHash, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Utilidad: Validar formato email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Utilidad: Validar CPF (simplificado)
   * En producción, usar librería como 'cpf-cnpj-validator'
   */
  private isValidCpf(cpf: string): boolean {
    // Remover caracteres especiales
    const cleanCpf = cpf.replace(/\D/g, '');

    // CPF debe tener 11 dígitos
    if (cleanCpf.length !== 11) {
      return false;
    }

    // Validar si no es secuencia repetida
    if (/^(\d)\1{10}$/.test(cleanCpf)) {
      return false;
    }

    // Aquí iría validación de dígito verificador
    return true;
  }
}
```

---

## CAMBIOS CLAVE EXPLICADOS

### 1. **Constructor: Repository Pattern**
```typescript
// ❌ ANTES
constructor(
  @InjectRepository(User)
  private usersRepository: Repository<User>
) {}

// ✅ DESPUÉS
constructor(private userRepository: UserRepository) {}
```
**Por qué**: Agnóstico de BD. Si mañana cambias a Prisma, solo cambias UserRepository.

---

### 2. **Excepciones Tipificadas**
```typescript
// ❌ ANTES
if (!user) throw new Error('User not found');

// ✅ DESPUÉS
if (!user) throw new ResourceNotFoundException('Usuario', userId);
```
**Por qué**: El frontend sabe qué código de error esperar. Logs estructurados. Testing más fácil.

---

### 3. **Métodos de Repository Específicos**
```typescript
// ✅ USAR métodos específicos del repo
await this.userRepository.findByEmail(email);
await this.userRepository.findActive(skip, take);
await this.userRepository.countActive();

// ❌ NO hacer queries complejas en el servicio
// El repository encapsula la lógica de persistencia
```
**Por qué**: El servicio solo piensa en lógica de negocio, no en SQL.

---

### 4. **Separación de Concerns**
```typescript
// 1. Validar reglas de negocio
// 2. Persistir (Repository lo maneja)
// 3. Retornar datos limpios (sin senhas)
```
**Por qué**: Código más testeable y mantenible.

---

## TESTS PARA EL NUEVO SERVICIO

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserRepository } from './repositories/user.repository';
import { ConflictException, ResourceNotFoundException } from '../common/exceptions';

describe('UsersService', () => {
  let service: UsersService;
  let repository: UserRepository;

  // ✅ Mock repository
  const mockRepository = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByCpf: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findActive: jest.fn(),
    countActive: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UserRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<UserRepository>(UserRepository);
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createDto = {
        nome: 'André',
        email: 'andre@example.com',
        senha: 'password123',
      };

      const expectedUser = { id: '1', ...createDto };

      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedUser);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(mockRepository.findByEmail).toHaveBeenCalledWith(
        createDto.email,
      );
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      const createDto = {
        nome: 'André',
        email: 'andre@example.com',
        senha: 'password123',
      };

      mockRepository.findByEmail.mockResolvedValue({ id: '1' });

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const userId = '1';
      const user = { id: userId, nome: 'André', email: 'andre@example.com' };

      mockRepository.findById.mockResolvedValue(user);

      const result = await service.getProfile(userId);

      expect(result).toBeDefined();
      expect(mockRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should throw ResourceNotFoundException if user not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getProfile('999')).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });
});
```

---

## CONTROLLER (SIN CAMBIOS)

El controller NO necesita cambiar mucho:

```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req: AuthenticatedRequest) {
    // ✅ Service ahora lanza excepciones tipificadas
    // ✅ ResponseInterceptor envuelve la respuesta
    // ✅ ExceptionFilter maneja las excepciones
    return this.usersService.getProfile(req.user.id);
  }
}
```

**Todo lo demás es automático**:
1. Si service lanza excepción tipificada → `AppExceptionFilter` la captura
2. Si es exitosa → `ResponseInterceptor` la envuelve
3. Cliente siempre recibe `{ success, data|error, timestamp, requestId }`

---

## RESUMEN

| Aspecto | Antes | Después |
|--------|-------|---------|
| **Dependencia** | `Repository<User>` de TypeORM | `UserRepository` custom |
| **Agnóstico BD** | ❌ | ✅ |
| **Excepciones** | `Error` genérico | Tipificadas con código |
| **Testing** | Mocking de Repository<User> complicado | Mock repository simple |
| **Código** | ~80 líneas | ~200 líneas (con métodos utilities) |
| **Mantenibilidad** | Difícil | Fácil |
| **Testing coverage** | Difícil | Fácil |

**La inversión ahora ahorra tiempo después.** 🚀

