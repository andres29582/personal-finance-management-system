# 🚀 GUÍA PASO A PASO: EMPEZAR FASE 1 ESTA SEMANA

## Estado Actual
Acabo de crear la base para Fase 1 en `src/common/`. Ya tienes:

```
src/common/
├── abstract/
│   └── base.repository.ts          ✅ Clase base con CRUD
├── exceptions/
│   ├── app.exception.ts            ✅ Exception base
│   └── index.ts                    ✅ 6 excepciones específicas
├── dto/
│   └── api-response.dto.ts         ✅ Estructura de respuestas
├── interceptors/
│   └── response.interceptor.ts     ✅ Envuelve respuestas
├── filters/
│   └── exception.filter.ts         ✅ Maneja excepciones
└── middleware/
    └── request-id.middleware.ts    ✅ Agrega request ID
```

Y un ejemplo:
```
src/users/repositories/
└── user.repository.ts              ✅ Ejemplo UserRepository
```

---

## SEMANA 1: 5 PASOS

### PASO 1: Registrar Interceptor, Filter y Middleware Globales (30 min)

**Archivo**: `src/main.ts`

**Cambio**:
```typescript
// AGREGAR estas líneas al inicio
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppExceptionFilter } from './common/filters/exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // AGREGAR estas líneas:
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AppExceptionFilter());

  // bootstrap() existente continúa...
}
```

**En app.module.ts**, agregar middleware:
```typescript
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  // ... tu configuración existente
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

**✅ Resultado**: Ahora todas las respuestas van a estar envueltas con `{ success: true, data, timestamp, requestId }`

---

### PASO 2: Actualizar Users Module (1 hora)

**Archivo**: `src/users/users.module.ts`

**Cambio**: Registrar UserRepository como provider
```typescript
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, UserRepository], // ✅ AGREGAR UserRepository
  exports: [UsersService],
})
export class UsersModule {}
```

**Archivo**: `src/users/users.service.ts`

**Cambio**: Reemplazar `@InjectRepository(User)` por `UserRepository`

```typescript
// ANTES:
constructor(
  @InjectRepository(User)
  private usersRepository: Repository<User>,
) {}

// DESPUÉS:
constructor(private userRepository: UserRepository) {}
```

Luego, en los métodos, cambiar:
```typescript
// ANTES:
this.usersRepository.findOne({ where: { id } })

// DESPUÉS:
this.userRepository.findById(id)
```

**Test**: Los tests deben seguir pasando. Si algo rompe, es señal de que Users.service tiene lógica que necesita ajustes.

---

### PASO 3: Agregar Excepciones Tipificadas en Users (1 hora)

**Archivo**: `src/users/users.service.ts`

Reemplazar excepciones genéricas por excepciones tipificadas:

```typescript
import {
  ResourceNotFoundException,
  ConflictException,
  UnauthorizedException,
} from '../common/exceptions';

@Injectable()
export class UsersService {
  constructor(private userRepository: UserRepository) {}

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    
    // ANTES: throw new Error('User not found')
    // DESPUÉS:
    if (!user) {
      throw new ResourceNotFoundException('Usuario', userId);
    }
    
    return user;
  }

  async register(email: string, password: string) {
    const existing = await this.userRepository.findByEmail(email);
    
    // ANTES: throw new Error('Email already exists')
    // DESPUÉS:
    if (existing) {
      throw new ConflictException(
        'EMAIL_ALREADY_EXISTS',
        'Este email ya está registrado',
      );
    }
    
    // crear nuevo usuario...
  }
}
```

**Test**: Ahora los tests deben esperar excepciones tipificadas:
```typescript
expect(() => service.getProfile(999)).rejects.toThrow(ResourceNotFoundException);
```

---

### PASO 4: Pruebas (30 min)

**En terminal**:
```bash
cd backendnest

# Ejecutar tests de Users
npm run test -- users

# Ejecutar todos los tests
npm run test

# Tests E2E (si existen)
npm run test:e2e
```

**Esperado**:
- ✅ Tests de Users deben pasar
- ✅ Otros servicios aún usan código viejo (tolerable por ahora)
- ✅ Respuestas en formato: `{ success: true, data, ... }`

---

### PASO 5: Testear manualmente en Postman/Insomnia (30 min)

**Crear request GET**: `http://localhost:3000/users/profile`

**Respuesta esperada (exitosa)**:
```json
{
  "success": true,
  "data": {
    "id": "123",
    "nome": "André",
    "email": "andre@example.com"
  },
  "timestamp": "2026-05-17T10:30:00.000Z",
  "requestId": "uuid-123"
}
```

**Respuesta esperada (error)**:
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Usuario con ID 999 no encontrado",
    "field": null
  },
  "timestamp": "2026-05-17T10:30:00.000Z",
  "requestId": "uuid-456"
}
```

---

## SEMANA 2: CONTINUAR CON OTROS MÓDULOS

**Prioridad** (orden recomendado):
1. **Auth** (depende de Users)
2. **Contas** (modulo crítico)
3. **Transações** (depende de Contas)
4. **Resto de módulos** (en paralelo)

Para cada módulo, repetir:
1. Crear `[Module]Repository` extendiendo `BaseRepository`
2. Registrar como provider en module
3. Inyectar en service en lugar de `@InjectRepository`
4. Reemplazar excepciones genéricas
5. Tests pasen ✅

**Template para cada módulo**:
```typescript
// repositories/[module].repository.ts
@Injectable()
export class [Module]Repository extends BaseRepository<[Entity]> {
  constructor(
    @InjectRepository([Entity])
    private [entity]Repository: Repository<[Entity]>,
  ) {
    super([entity]Repository);
  }

  // Métodos específicos de negocio aquí
}
```

---

## INSTALACIÓN DE DEPENDENCIAS

Necesitas `uuid` para requestId:
```bash
npm install uuid
npm install --save-dev @types/uuid
```

---

## ✅ CHECKLIST PARA MARCAR COMO HECHO

- [ ] `main.ts` actualizado con interceptor + filter
- [ ] `app.module.ts` con middleware
- [ ] Todos los archivos en `src/common/` creados
- [ ] `src/users/repositories/user.repository.ts` creado
- [ ] `src/users/users.module.ts` actualizado
- [ ] `src/users/users.service.ts` refactorizado
- [ ] `npm run test -- users` pasa ✅
- [ ] Postman test exitoso ✅
- [ ] Postman test con error (404) funciona ✅
- [ ] **Commit a git**: "Fase 1: Base classes, excepciones, API wrapper"

---

## 🚨 PROBLEMAS COMUNES

### "No compile porque uuid no está instalado"
```bash
npm install uuid @types/uuid
```

### "Tests rompen después de cambiar UsersService"
```
Esto es normal. Los tests ahora necesitan inyectar UserRepository mock:

const mockRepository = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  // ... otros métodos
};

const module = await Test.createTestingModule({
  providers: [
    UsersService,
    { provide: UserRepository, useValue: mockRepository },
  ],
}).compile();
```

### "ResponseInterceptor duplica respuesta"
Si ves `{ success: true, data: { success: true, data: ... } }`, es que hay un interceptor anterior. Revisar `main.ts` por otros interceptors.

---

## 📊 PROGRESO ESPERADO

**Al final de Semana 1**:
```
✅ Base clases creadas
✅ Users module refactorizado
✅ API wrapper funcional
✅ Excepciones tipificadas
✅ Tests pasando
✅ 1/17 módulos completado
```

**Al final de Semana 2**:
```
✅ Auth module
✅ Contas module
✅ Transações module
✅ ~5-6 módulos refactorizados
```

**Al final de Mes 1**:
```
✅ 100% módulos refactorizados
✅ Fase 1 COMPLETA ✨
```

---

## PRÓXIMO: Semana 3-4 (Rest de módulos + validación)

Mientras tanto, cualquier duda en implementación:
1. Revisar `src/users/repositories/user.repository.ts` como referencia
2. Revisar `src/users/users.service.ts` como ejemplo de integración
3. Comparar con `PHASE_1_TECHNICAL_GUIDE.md` si necesitas más detalles

---

**¡Mucho éxito! Esto es lo emocionante de la arquitectura. 🚀**

