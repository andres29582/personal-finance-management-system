# 🔧 GUÍA TÉCNICA - FASE 1: FUNDACIÓN ARQUITECTÓNICA
## Repository Pattern + Excepciones + API Wrapper

---

## 📌 RESUMEN EJECUTIVO

**Duración**: 2 meses  
**Equipo**: 3-4 developers  
**Riesgo**: Bajo (backward compatible)  
**Impacto**: Alto (base para todo lo demás)

### Objetivos
1. Crear capa de abstracción de persistencia
2. Tipificar excepciones de negocio
3. Estandarizar respuestas API
4. Mantener 100% funcionalidad existente

---

## 1️⃣ REPOSITORY PATTERN

### 1.1 Estructura Base

```typescript
// common/abstract/base.repository.ts
import { Repository, FindOptionsWhere } from 'typeorm';

export interface IRepository<T> {
  findById(id: string | number): Promise<T | null>;
  findOne(where: Partial<T>): Promise<T | null>;
  findAll(skip?: number, take?: number): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string | number, data: Partial<T>): Promise<T>;
  delete(id: string | number): Promise<boolean>;
  count(where?: FindOptionsWhere<T>): Promise<number>;
}

@Injectable()
export abstract class BaseRepository<T> implements IRepository<T> {
  constructor(protected repository: Repository<T>) {}

  async findById(id: string | number): Promise<T | null> {
    return this.repository.findOne({ where: { id } as any });
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
    await this.repository.update(id, data as any);
    return this.findById(id);
  }

  async delete(id: string | number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected > 0;
  }

  async count(where?: FindOptionsWhere<T>): Promise<number> {
    return this.repository.count({ where });
  }
}
```

### 1.2 Implementación por Módulo

```typescript
// contas/repositories/conta.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conta } from '../entities/conta.entity';
import { BaseRepository } from '../../common/abstract/base.repository';

@Injectable()
export class ContaRepository extends BaseRepository<Conta> {
  constructor(
    @InjectRepository(Conta)
    private contaRepository: Repository<Conta>,
  ) {
    super(contaRepository);
  }

  // Métodos específicos de negocio
  async findByUserId(userId: number): Promise<Conta[]> {
    return this.contaRepository.find({
      where: { usuario: { id: userId } },
      relations: ['usuario'],
    });
  }

  async findWithBalance(userId: number): Promise<Conta[]> {
    return this.contaRepository
      .createQueryBuilder('conta')
      .leftJoinAndSelect('conta.usuario', 'usuario')
      .leftJoinAndSelect('conta.transacoes', 'transacoes')
      .where('usuario.id = :userId', { userId })
      .select(['conta', 'SUM(transacoes.valor) as balance'])
      .groupBy('conta.id')
      .getRawAndEntities();
  }

  async findActive(userId: number): Promise<Conta[]> {
    return this.contaRepository.find({
      where: {
        usuario: { id: userId },
        deletedAt: null,
      },
    });
  }
}
```

### 1.3 Inyección en Servicio

```typescript
// contas/contas.service.ts (ANTES)
@Injectable()
export class ContasService {
  constructor(
    @InjectRepository(Conta)
    private contasRepository: Repository<Conta>,
  ) {}

  async create(createContaDto: CreateContaDto, userId: number) {
    return this.contasRepository.save({ ...createContaDto, usuario: userId });
  }
}

// contas/contas.service.ts (DESPUÉS)
@Injectable()
export class ContasService {
  constructor(private contasRepository: ContaRepository) {} // ✅ Repository inyectado

  async create(createContaDto: CreateContaDto, userId: number) {
    return this.contasRepository.create({ ...createContaDto, usuario: userId });
  }
}
```

### 1.4 Providers en Module

```typescript
// contas/contas.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conta } from './entities/conta.entity';
import { ContasService } from './contas.service';
import { ContasController } from './contas.controller';
import { ContaRepository } from './repositories/conta.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Conta])],
  controllers: [ContasController],
  providers: [ContasService, ContaRepository], // ✅ Registrar repository
  exports: [ContasService],
})
export class ContasModule {}
```

### 1.5 Transações

```typescript
// common/decorators/transactional.decorator.ts
import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export const Transactional = () => {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const result = await originalMethod.apply(this, args);
        await queryRunner.commitTransaction();
        return result;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    };

    return descriptor;
  };
};

// Uso:
@Transactional()
async transferir(contaOrigemId: number, contaDestinoId: number, valor: number) {
  // Si cualquier operación falla, todo se revierte
  await this.contasRepository.update(contaOrigemId, { saldo: -valor });
  await this.contasRepository.update(contaDestinoId, { saldo: +valor });
}
```

---

## 2️⃣ TIPIFICACIÓN DE EXCEPCIONES

### 2.1 Excepciones Base

```typescript
// common/exceptions/app.exception.ts
export abstract class AppException extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number,
    public readonly field?: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppException.prototype);
  }
}
```

### 2.2 Excepciones Específicas

```typescript
// common/exceptions/business.exception.ts
export class BusinessException extends AppException {
  constructor(code: string, message: string, field?: string) {
    super(code, message, 400, field);
  }
}

// common/exceptions/validation.exception.ts
export class ValidationException extends AppException {
  constructor(code: string, message: string, field?: string) {
    super(code, message, 422, field);
  }
}

// common/exceptions/resource-not-found.exception.ts
export class ResourceNotFoundException extends AppException {
  constructor(resource: string, id: string | number) {
    super('RESOURCE_NOT_FOUND', `${resource} not found: ${id}`, 404);
  }
}

// common/exceptions/unauthorized.exception.ts
export class UnauthorizedException extends AppException {
  constructor(reason = 'Unauthorized') {
    super('UNAUTHORIZED', reason, 401);
  }
}

// common/exceptions/conflict.exception.ts
export class ConflictException extends AppException {
  constructor(code: string, message: string) {
    super(code, message, 409);
  }
}
```

### 2.3 Exception Filter Global

```typescript
// common/filters/exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { AppException } from '../exceptions/app.exception';

@Catch(AppException)
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: AppException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    response.status(exception.statusCode).json({
      success: false,
      error: {
        code: exception.code,
        message: exception.message,
        field: exception.field,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
```

### 2.4 Uso en Servicios

```typescript
// contas/contas.service.ts
@Injectable()
export class ContasService {
  constructor(private contasRepository: ContaRepository) {}

  async getConta(id: number, userId: number): Promise<Conta> {
    const conta = await this.contasRepository.findById(id);

    if (!conta) {
      throw new ResourceNotFoundException('Conta', id);
    }

    if (conta.usuario.id !== userId) {
      throw new UnauthorizedException('You cannot access this account');
    }

    return conta;
  }

  async transferir(
    contaOrigemId: number,
    contaDestinoId: number,
    valor: number,
    userId: number,
  ) {
    const contaOrigem = await this.getConta(contaOrigemId, userId);

    if (contaOrigem.saldo < valor) {
      throw new BusinessException(
        'INSUFFICIENT_BALANCE',
        'Saldo insuficiente para la transferencia',
        'valor',
      );
    }

    if (valor <= 0) {
      throw new ValidationException(
        'INVALID_AMOUNT',
        'Amount must be greater than 0',
        'valor',
      );
    }

    // ... hacer transferencia
  }
}
```

---

## 3️⃣ API RESPONSE WRAPPER

### 3.1 DTO de Respuesta

```typescript
// common/dto/api-response.dto.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    field?: string;
  };
  timestamp: Date;
  requestId: string;
}
```

### 3.2 Interceptor Global

```typescript
// common/interceptors/response.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = uuid();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date(),
        requestId,
      })),
    );
  }
}
```

### 3.3 Registrar en main.ts

```typescript
// main.ts
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppExceptionFilter } from './common/filters/exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Interceptors
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Filters
  app.useGlobalFilters(new AppExceptionFilter());

  await app.listen(3000);
}

bootstrap();
```

### 3.4 Ejemplo de Respuesta

```json
{
  "success": true,
  "data": {
    "id": 1,
    "nome": "Conta Corrente",
    "saldo": 1500.50,
    "tipo": "CORRENTE"
  },
  "timestamp": "2026-05-17T10:00:00.000Z",
  "requestId": "a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6"
}
```

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Saldo insuficiente para la transferencia",
    "field": "valor"
  },
  "timestamp": "2026-05-17T10:00:00.000Z",
  "requestId": "a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6"
}
```

---

## 🧪 TESTING CON REPOSITORY PATTERN

### 4.1 Mock Repository

```typescript
// contas/contas.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ContasService } from './contas.service';
import { ContaRepository } from './repositories/conta.repository';

describe('ContasService', () => {
  let service: ContasService;
  let repository: ContaRepository;

  // Mock del repository
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContasService,
        {
          provide: ContaRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ContasService>(ContasService);
    repository = module.get<ContaRepository>(ContaRepository);
  });

  it('should create a conta', async () => {
    const createDto = { nome: 'Test', tipo: 'CORRENTE' };
    const expectedConta = { id: 1, ...createDto };

    mockRepository.create.mockResolvedValue(expectedConta);

    const result = await service.create(createDto, 1);

    expect(result).toEqual(expectedConta);
    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining(createDto),
    );
  });

  it('should throw when conta not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    expect(service.getConta(999, 1)).rejects.toThrow(
      ResourceNotFoundException,
    );
  });
});
```

---

## 📋 IMPLEMENTACIÓN POR MÓDULO (Orden Recomendado)

### Semana 1-2: Infraestructura
1. Base classes (Repository, Service)
2. Excepciones
3. Decorators y Filters
4. Response Wrapper

### Semana 3-4: Módulos Core
1. **Users** (simple, requiere por otros)
2. **Auth** (dependencies: Users)
3. **Contas** (dependencies: Users)

### Semana 5-6: Módulos Financieros
1. **Categorias**
2. **Transações** (dependencies: Contas, Categorias)
3. **Contas Transferencias** (dependencies: Contas, Transações)

### Semana 7-8: Módulos Complejos
1. **Dívidas** (dependencies: Contas)
2. **Metas**
3. **Orçamentos**
4. Resto de módulos

---

## ✅ CHECKLIST POR MÓDULO

Template para cada módulo:
```
[ ] Crear ContaRepository extends BaseRepository
[ ] Actualizar ContasService para usar repository
[ ] Crear/actualizar métodos específicos en repository
[ ] Actualizar tests en ContasService.spec.ts
[ ] Reemplazar excepciones genéricas por específicas
[ ] Actualizar ContasController si necesario
[ ] Tests E2E pasan
[ ] Review de código
[ ] Deploy a staging
[ ] QA validation
```

---

## 🚀 ESTRATEGIA DE MIGRACIÓN

### Opción A: Big Bang (Riesgo Alto)
Cambiar todo en una PR grande
- ❌ Difícil de debuggear
- ❌ Difícil de revertir
- ❌ Riesgo de breaking changes

### Opción B: Gradual (Recomendada ✅)
```
Semana 1: User + Auth (módulos simples)
         ↓
Semana 2: Contas
         ↓
Semana 3: Transações
         ↓
Semana 4: Resto (en paralelo)
```

**Ventajas**:
- Aprendizaje del patrón más suave
- Detección de problemas temprana
- Fácil revertir si algo falla
- Menos conflictos de merge

---

## 🔍 VALIDACIÓN POST-IMPLEMENTACIÓN

**Antes de considerar Fase 1 completa**:

```
Métrica                          | Target | Validar
---------------------------------|--------|----------
Coverage de tests unitarios      | 70%+   | npm run test:cov
Tests E2E pasando                | 100%   | npm run test:e2e
Breaking changes en API          | 0      | Changelog
Excepciones sin tipificar        | 0      | Grep en código
API sin response wrapper          | 0      | Review manual
Modules con legacy code          | 0      | Code review
Documentación actualizada        | 100%   | README checks
```

---

## 📚 DOCUMENTACIÓN PARA EL EQUIPO

**Crear estos archivos en cada fase**:

```
docs/
├── PHASE_1_IMPLEMENTATION.md    (este archivo)
├── REPOSITORY_PATTERN.md        (guía rápida)
├── EXCEPTION_HANDLING.md        (códigos de error)
├── API_RESPONSE_FORMAT.md       (contrato API)
└── MIGRATION_GUIDE.md           (cómo migrar un módulo)
```

---

## 💬 FAQ

### P: ¿Qué pasa con el código antiguo?
R: Mantener legacy durante transición (2-3 sprints), luego deprecar

### P: ¿Cómo afecta al frontend?
R: API Response Wrapper sí afecta - coordinar release
Frontend necesita actualizar parsing de respuestas

### P: ¿Qué si algo rompe en producción?
R: Feature flag + rollback rápido
Tener script de rollback de migrations

### P: ¿Testing es obligatorio en Fase 1?
R: Sí - el 20% de refactor es testing
Coverage mínimo 70% en nuevos tests

---

**Siguiente**: Coordinar con el equipo y comenzar Week 1

