# 📝 CHECKLIST INTERACTIVO: FASE 1 SEMANA 1

## ✅ PASO 1: Setup Global (30 min)

### 1.1 Instalar uuid
```bash
npm install uuid
npm install --save-dev @types/uuid
```
- [ ] Comando ejecutado
- [ ] `npm ls uuid` muestra el paquete

### 1.2 Actualizar `src/main.ts`
```typescript
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppExceptionFilter } from './common/filters/exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // AGREGAR ESTAS LÍNEAS:
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AppExceptionFilter());

  // ... resto del código
}
```
- [ ] Import agregado
- [ ] `useGlobalInterceptors` agregado
- [ ] `useGlobalFilters` agregado

### 1.3 Actualizar `src/app.module.ts`
```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  // ... tu configuración
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```
- [ ] NestModule implementado
- [ ] Middleware registrado
- [ ] Puerto 3000 inicia sin errores

---

## ✅ PASO 2: Crear UserRepository (45 min)

### 2.1 Crear archivo
**Archivo**: `src/users/repositories/user.repository.ts`
- [ ] Archivo creado
- [ ] Extiende `BaseRepository<User>`
- [ ] Constructor inyecta `@InjectRepository(User)`

### 2.2 Actualizar UsersModule
**Archivo**: `src/users/users.module.ts`
```typescript
providers: [UsersService, UserRepository], // ✅ Agregar UserRepository
```
- [ ] UserRepository agregado a providers
- [ ] TypeOrmModule.forFeature([User]) existe

### 2.3 Actualizar UsersService
**Archivo**: `src/users/users.service.ts`

Cambiar:
```typescript
// ANTES
constructor(@InjectRepository(User) private usersRepository: Repository<User>) {}

// DESPUÉS
constructor(private userRepository: UserRepository) {}
```
- [ ] Constructor actualizado
- [ ] Reemplazar todas las llamadas:
  - [ ] `this.usersRepository.findOne(...)` → `this.userRepository.findOne(...)`
  - [ ] `this.usersRepository.save(...)` → `this.userRepository.create(...)`
  - [ ] `this.usersRepository.update(...)` → `this.userRepository.update(...)`

---

## ✅ PASO 3: Agregar Excepciones (30 min)

### 3.1 Actualizar UsersService con excepciones tipificadas

Identificar estos patrones y cambiar:

```typescript
// PATRÓN: Recurso no encontrado
if (!user) {
  // ANTES: throw new Error('User not found')
  // DESPUÉS:
  throw new ResourceNotFoundException('Usuario', userId);
}

// PATRÓN: Email duplicado
if (existingUser) {
  // ANTES: throw new Error('Email already exists')
  // DESPUÉS:
  throw new ConflictException(
    'EMAIL_ALREADY_EXISTS',
    'Este email ya está registrado'
  );
}

// PATRÓN: Datos inválidos
if (!isValidEmail(email)) {
  // ANTES: throw new Error('Invalid email')
  // DESPUÉS:
  throw new ValidationException(
    'INVALID_EMAIL',
    'Email no es válido',
    'email'
  );
}
```

- [ ] `ResourceNotFoundException` importada
- [ ] `ConflictException` importada
- [ ] `ValidationException` importada
- [ ] Al menos 5 excepciones reemplazadas
- [ ] Tests de UsersService actualizados para esperar nuevas excepciones

---

## ✅ PASO 4: Tests (45 min)

### 4.1 Actualizar tests unitarios
**Archivo**: `src/users/users.service.spec.ts`

```typescript
// Crear mock repository
const mockRepository = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// En beforeEach:
const module = await Test.createTestingModule({
  providers: [
    UsersService,
    {
      provide: UserRepository,
      useValue: mockRepository,
    },
  ],
}).compile();
```

### 4.2 Actualizar expects para nuevas excepciones
```typescript
it('should throw ResourceNotFoundException when user not found', async () => {
  mockRepository.findById.mockResolvedValue(null);
  
  await expect(service.getProfile('999')).rejects.toThrow(
    ResourceNotFoundException
  );
});
```

- [ ] Mock repository creado
- [ ] Tests compilables (`npm run test -- users --no-coverage`)
- [ ] Al menos 80% de tests pasando
- [ ] Si algunos fallan, actualizar expects para nuevas excepciones

### 4.3 Correr tests
```bash
npm run test -- users
```
- [ ] `npm run test -- users` pasa
- [ ] 0 errores de compilación
- [ ] Cobertura visible

---

## ✅ PASO 5: Validación Manual (30 min)

### 5.1 Testear respuesta exitosa

**Request**:
```bash
curl -X GET http://localhost:3000/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nome": "André",
    "email": "andre@example.com"
  },
  "timestamp": "2026-05-17T10:30:00.000Z",
  "requestId": "uuid-request-id"
}
```

- [ ] Status code: 200 ✅
- [ ] `success: true`
- [ ] `data` contiene usuario
- [ ] `timestamp` presente
- [ ] `requestId` presente

### 5.2 Testear respuesta de error (usuario no encontrado)

**Request**:
```bash
curl -X GET http://localhost:3000/users/999 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Respuesta esperada**:
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Usuario con ID 999 no encontrado"
  },
  "timestamp": "2026-05-17T10:30:00.000Z",
  "requestId": "uuid-request-id"
}
```

- [ ] Status code: 404 ✅
- [ ] `success: false`
- [ ] `error.code` es "RESOURCE_NOT_FOUND"
- [ ] `error.message` descriptivo

### 5.3 Testear validación (email duplicado si existe endpoint)

Si existe endpoint de registro:

**Request**:
```bash
curl -X POST http://localhost:3000/users/register \
  -H "Content-Type: application/json" \
  -d '{"email": "andre@example.com", "password": "..."}'
```

**Respuesta esperada** (si email existe):
```json
{
  "success": false,
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "Este email ya está registrado"
  },
  "timestamp": "2026-05-17T10:30:00.000Z",
  "requestId": "uuid"
}
```

- [ ] Status code: 409 ✅
- [ ] `error.code` es código específico
- [ ] `error.message` descriptivo

---

## 🎯 RESUMEN FINAL

### Archivos Creados ✅
- [ ] `src/common/abstract/base.repository.ts`
- [ ] `src/common/exceptions/app.exception.ts`
- [ ] `src/common/exceptions/index.ts`
- [ ] `src/common/dto/api-response.dto.ts`
- [ ] `src/common/interceptors/response.interceptor.ts`
- [ ] `src/common/filters/exception.filter.ts`
- [ ] `src/common/middleware/request-id.middleware.ts`
- [ ] `src/users/repositories/user.repository.ts`

### Archivos Modificados ✅
- [ ] `src/main.ts` - Interceptor + Filter
- [ ] `src/app.module.ts` - Middleware
- [ ] `src/users/users.module.ts` - UserRepository provider
- [ ] `src/users/users.service.ts` - Inyección y excepciones
- [ ] `src/users/users.service.spec.ts` - Mock repository + tests

### Tests ✅
- [ ] `npm run test -- users` pasa
- [ ] `npm run test` (todos) pasa sin errores fatales
- [ ] Postman: Respuesta exitosa tiene `success: true`
- [ ] Postman: Respuesta error tiene `success: false` + código

### Documentación ✅
- [ ] README actualizado (si aplica)
- [ ] Commits a git con mensajes claros

---

## 📊 TIEMPO TOTAL ESTIMADO
- Setup global: 30 min ⏱️
- UserRepository: 45 min ⏱️
- Excepciones: 30 min ⏱️
- Tests: 45 min ⏱️
- Validación manual: 30 min ⏱️

**TOTAL: ~3 horas** (una persona, si todo sale bien)

Con 2 personas en paralelo: ~2 horas

---

## 🆘 BLOQUEADORES COMUNES

| Problema | Solución |
|----------|----------|
| "uuid no está instalado" | `npm install uuid @types/uuid` |
| "ResponseInterceptor no se aplica" | Revisar que `app.useGlobalInterceptors()` en main.ts |
| "Excepciones no se capturan" | Revisar que `app.useGlobalFilters()` en main.ts |
| "Tests fallan con mock" | Asegurarse que `UserRepository` está en providers del TestModule |
| "Respuesta no tiene formato" | Verificar que ResponseInterceptor se registró |

---

**Una vez completado este checklist, estarás listo para Semana 2: Migrar Auth y Contas**

