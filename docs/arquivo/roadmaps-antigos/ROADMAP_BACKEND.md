# 🏗️ ROADMAP ARQUITECTÓNICO - Backend NestJS
## Plan de Implementación Gradual (12 Meses)

**Documento de Estrategia Arquitectónica**  
**Versión**: 1.0  
**Fecha**: Mayo 2026  
**Audience**: Tech Lead, Arquitecto, Team Lead

---

## 📊 ESTADO ACTUAL (Baseline)

### Fortalezas ✅
- Modularización correcta (feature modules)
- TypeScript strict mode
- Autenticación y autorización implementadas
- Testing unitarios + E2E
- Migrations SQL versionadas
- LGPD compliance (soft delete)
- Auditoría centralizada

### Debilidades ⚠️
- Sin abstracciones de persistencia (Repository Pattern)
- API inconsistente en respuestas
- Sin CQRS (crítico para auditoría)
- Documentación API manual (Swagger.yaml estático)
- Sin caché estratégico
- Excepciones sin tipificación clara
- Testing coverage desconocido
- Sin observabilidad (logs estructurados)
- Escalabilidad limitada (acoplamiento a repositorios)

### Riesgos Técnicos 🚨
1. **Alto acoplamiento a TypeORM**: Cambio de BD = reescritura masiva
2. **Sin transacciones explícitas**: Race conditions en operaciones financieras
3. **Performance**: Sin caché en queries frecuentes
4. **Maintainability**: DTOs no estratificados crean confusion
5. **Testing**: Difícil mockear repositories

---

## 🎯 VISIÓN ARQUITECTÓNICA A 12 MESES

### Objetivo Principal
**Transformar el backend en una arquitectura escalable, mantenible y resiliente**

```
MVP (Hoy)                      Producción (12 meses)
├── Monolito modular           ├── Modular + CQRS
├── DTOs básicos               ├── DTOs estratificados
├── Repos directos             ├── Repository Pattern
├── Logs simples               ├── Observabilidad completa
├── Sin caché                  ├── Redis multi-layer
├── Errores genéricos          ├── Excepciones tipificadas
└── Testing manual             └── 80%+ coverage automático
```

---

## 📅 FASES DE IMPLEMENTACIÓN

### FASE 1️⃣ (Meses 1-2): FUNDACIÓN
**Objetivo**: Establecer capas de abstracción y convenciones

#### 1.1 Repository Pattern + Dependency Injection
```
Dependencias: Ninguna
Duración: 3 semanas
Riesgo: Bajo (backward compatible)
Team: 2 developers
```

**Entregables**:
```
common/
├── abstract/
│   ├── base.repository.ts      # Clase abstracta con CRUD básico
│   ├── base.service.ts         # Clase base con DI
│   └── pagination.ts           # Paginación estándar
├── interfaces/
│   └── repository.interface.ts # Contrato de repositorio
└── decorators/
    └── transactional.decorator.ts # Para transacciones
```

**Cambios**:
- Crear interfaces de repositorio para cada entidad
- Implementar repositories en carpeta `repositories/`
- Inyectar repositories en servicios (no repos de TypeORM)
- Mantener código antiguo funcional (dual path)

**Criterios de éxito**:
- ✅ Todos los servicios usan inyección de repositorio
- ✅ Tests unitarios pasan con mocks
- ✅ Zero breaking changes en API

**Impacto arquitectónico**:
- Agnóstico de BD (podemos cambiar PostgreSQL → MongoDB sin afectar servicios)
- Testeable (mockear repository es trivial)
- Escalable (agregar caché en repository layer es transparente)

---

#### 1.2 Tipificación de Excepciones
```
Dependencias: Ninguna
Duración: 2 semanas
Riesgo: Muy Bajo
Team: 1 developer
```

**Estructura**:
```
common/exceptions/
├── base.exception.ts
├── business.exception.ts           # Errores de negocio (400)
├── validation.exception.ts         # Validación (422)
├── resource-not-found.exception.ts # (404)
├── unauthorized.exception.ts       # (401)
├── conflict.exception.ts           # (409)
└── internal-server.exception.ts    # (500)
```

**Beneficio**: 
- Frontend consume códigos de error predecibles
- Logs estructurados por tipo
- Testing más fácil

---

#### 1.3 API Response Wrapper
```
Dependencias: Tipificación de excepciones
Duración: 1 semana
Riesgo: Medio (cambio en contratos)
Team: 1 developer
```

**Respuesta estándar**:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-05-17T10:00:00Z",
  "requestId": "uuid"
}

// Error
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Saldo insuficiente",
    "field": "amount"
  },
  "timestamp": "2026-05-17T10:00:00Z",
  "requestId": "uuid"
}
```

**Implementación**:
```typescript
// interceptor global
@Injectable()
export class ResponseInterceptor implements NestInterceptor { }

// en main.ts
app.useGlobalInterceptors(new ResponseInterceptor());
```

**Nota**: Frontend necesita actualizar parsing de respuestas

---

### FASE 2️⃣ (Meses 3-5): ESCALABILIDAD
**Objetivo**: Implementar CQRS y caché para operaciones complejas

#### 2.1 CQRS Core Infrastructure
```
Dependencias: Repository Pattern (Fase 1)
Duración: 4 semanas
Riesgo: Medio (requiere refactor de servicios)
Team: 2 developers
```

**Estructura**:
```
cqrs/
├── commands/
│   └── [module]/
│       ├── create-conta.command.ts
│       ├── update-conta.command.ts
│       └── delete-conta.command.ts
├── queries/
│   └── [module]/
│       ├── get-conta-by-id.query.ts
│       ├── list-contas.query.ts
│       └── get-conta-balance.query.ts
├── handlers/
│   ├── command/
│   │   └── [module]/
│   │       └── create-conta.handler.ts
│   └── query/
│       └── [module]/
│           └── get-conta-by-id.handler.ts
└── events/
    └── [module]/
        ├── conta-created.event.ts
        └── conta-deleted.event.ts
```

**Implementación gradual**:
- Fase 2.1a: Crear CommandBus + QueryBus (lib)
- Fase 2.1b: Implementar Queries en 3 módulos críticos (Dashboard, Transações, Contas)
- Fase 2.1c: Implementar Commands en módulos de escritura
- Fase 2.1d: Mantener métodos de servicio legacy (dual support)

**Beneficios**:
- Trazabilidad completa de cambios
- Facilita auditoría
- Permite event sourcing futuro
- Escalable a Event-Driven Architecture

---

#### 2.2 Redis Cache Layer
```
Dependencias: CQRS (parcial)
Duración: 3 semanas
Riesgo: Bajo (cache es opcional)
Team: 1 developer
```

**Implementación**:
```
npm install @nestjs/cache-manager cache-manager redis
```

**Estrategia de caché**:
```typescript
// 1. Queries frecuentes (TTL: 5-15 min)
@QueryHandler(GetDashboardSummaryQuery)
@Cacheable({ key: 'dashboard:{{userId}}', ttl: 600 })
async handle(query: GetDashboardSummaryQuery) { }

// 2. Datos de referencia (TTL: 1 hora)
@QueryHandler(ListCategoriasQuery)
@Cacheable({ key: 'categorias:{{locale}}', ttl: 3600 })
async handle() { }

// 3. User profile (TTL: 30 min con invalidación)
@CommandHandler(UpdateUserProfileCommand)
async handle(command: UpdateUserProfileCommand) {
  await this.userService.update(command);
  await this.cache.del(`user:${command.userId}`);
}
```

**Capas de caché**:
1. **L1**: In-memory (NestJS cache-manager) - operaciones rápidas
2. **L2**: Redis - datos compartidos entre instancias
3. **L3**: Database - fuente de verdad

---

### FASE 3️⃣ (Meses 6-8): OBSERVABILIDAD
**Objetivo**: Monitoreo, trazabilidad, debugging mejorado

#### 3.1 Structured Logging
```
Dependencias: Ninguna (paralelo)
Duración: 2 semanas
Riesgo: Bajo
Team: 1 developer
```

**Migración**: Simple → Winston/Pino

```typescript
npm install pino pino-pretty @nestjs/pino
```

**Estructura de logs**:
```json
{
  "timestamp": "2026-05-17T10:00:00Z",
  "level": "info",
  "context": "ContasService",
  "message": "Conta created",
  "userId": 123,
  "contaId": 456,
  "duration": "45ms",
  "requestId": "uuid",
  "metadata": { }
}
```

---

#### 3.2 Distributed Tracing (OpenTelemetry)
```
Dependencias: Structured Logging
Duración: 3 semanas
Riesgo: Medio (requiere setup de infraestructura)
Team: 1 developer + DevOps
```

**Objetivo**: Rastrear requests a través de múltiples servicios

```
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto
```

**Beneficios**:
- Visualizar latencia por módulo
- Identificar cuellos de botella
- Debugging de requests lentas
- Compliance (auditoría completa)

---

#### 3.3 Observability Dashboard (Prometheus + Grafana)
```
Dependencias: Structured Logging
Duración: 2 semanas
Riesgo: Bajo
Team: 1 developer + DevOps
```

**Métricas clave**:
```
- Request latency (p50, p95, p99)
- Error rate por endpoint
- Database query time
- Cache hit rate
- Active users
- Business metrics (transações/día, etc)
```

---

### FASE 4️⃣ (Meses 9-12): MADUREZ
**Objetivo**: Testing, documentación, performance optimization

#### 4.1 Test Coverage Improvement
```
Dependencias: Repository Pattern
Duración: 6 semanas
Riesgo: Bajo
Team: 1-2 developers (en paralelo con features)
```

**Meta**: 80% coverage global

**Estrategia**:
```
test/
├── unit/
│   ├── [module]/
│   │   ├── [service].spec.ts     (80% min)
│   │   └── [controller].spec.ts
│   └── common/
├── integration/
│   └── [module]/
│       └── [feature].integration.spec.ts
└── e2e/
    └── [module]/
        ├── create-conta.e2e.spec.ts
        └── transfer-money.e2e.spec.ts
```

**Herramientas**:
```bash
npm install --save-dev jest @types/jest ts-jest
npm install --save-dev @nestjs/testing
npm run test:cov  # Reports coverage
```

---

#### 4.2 Swagger Automático
```
Dependencias: DTOs estratificados (ver abajo)
Duración: 2 semanas
Riesgo: Muy Bajo
Team: 1 developer
```

**Setup**:
```bash
npm install @nestjs/swagger swagger-ui-express
```

```typescript
// main.ts
const config = new DocumentBuilder()
  .setTitle('Sistema Financeiro API')
  .setDescription('API documentation')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

---

#### 4.3 DTOs Estratificados
```
Dependencias: Response Wrapper (Fase 1)
Duración: 3 semanas
Riesgo: Medio (refactor de controllers)
Team: 1 developer
```

**Patrón**:
```
dtos/
├── requests/          # Input validation
│   └── create-conta.request.dto.ts
├── responses/         # Salida controlada (sin datos sensibles)
│   └── conta.response.dto.ts
└── internal/          # Uso interno entre servicios
    └── conta.internal.dto.ts
```

---

#### 4.4 Performance Optimization
```
Duración: 4 semanas
Riesgo: Bajo
Team: 1 developer + Database specialist
```

**Optimizaciones**:
1. **Database**:
   - Índices en columnas frecuentes
   - Query analysis y EXPLAIN PLAN
   - Connection pooling

2. **API**:
   - Paginación obligatoria en listados
   - GraphQL alternativo (opcional)
   - Compresión gzip

3. **Caching** (leveraging Redis):
   - Invalidación inteligente
   - Warming de cache

---

## 🔄 TIMELINE VISUAL

```
Mes  1  2  3  4  5  6  7  8  9 10 11 12
     |  |  |  |  |  |  |  |  |  |  |  |
1.1  [========]                          Repository Pattern
1.2  [====]                              Excepciones
1.3       [====]                         Response Wrapper
2.1          [==========]                CQRS
2.2              [========]              Redis
3.1  [====] (paralelo)                   Structured Logging
3.2              [========]              Distributed Tracing
3.3                   [====]             Observability
4.1        [==================================] Test Coverage
4.2                        [====]        Swagger
4.3                             [====]   DTOs
4.4                                 [========] Performance
```

---

## 👥 DISTRIBUCIÓN DE EQUIPO

### Escenario: 3-4 developers

**Mes 1-2**:
- Dev 1 + Dev 2: Repository Pattern
- Dev 3: Excepciones + Response Wrapper
- Dev 4: Structured Logging (paralelo)

**Mes 3-5**:
- Dev 1 + Dev 2: CQRS
- Dev 3: Redis
- Dev 4: Structured Logging + Tests

**Mes 6+**:
- Todo el team: Features nuevas + Testing/Observability

---

## ⚠️ RIESGOS Y MITIGACIÓN

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|--------|-----------|
| **Refactor rompe features** | Media | Alto | Feature flags, tests E2E, staging |
| **Performance degrada** | Baja | Muy Alto | Benchmarks antes/después, load testing |
| **Team no entiende CQRS** | Alta | Medio | Training session, documentación, pairing |
| **Cambios rompen SDK frontend** | Media | Alto | Versioning de API, changelog, coordinación |
| **Time overrun** | Media | Medio | Buffer del 20%, priorización clara |

---

## 📊 MÉTRICAS DE ÉXITO

### Después de Fase 1 (Mes 2)
- ✅ 100% servicios usan Repository Pattern
- ✅ 0 nuevas excepciones sin tipificar
- ✅ API 100% con response wrapper
- ✅ 0 breaking changes en producción

### Después de Fase 2 (Mes 5)
- ✅ 5+ módulos con CQRS implementado
- ✅ Cache hit rate > 60% en queries frecuentes
- ✅ Latencia p95 reducida 30%
- ✅ 0 race conditions reportadas

### Después de Fase 3 (Mes 8)
- ✅ 100% requests con distributed tracing
- ✅ Dashboard de métricas operativo
- ✅ Logs searchable en 500ms
- ✅ Auditoría completa habilitada

### Después de Fase 4 (Mes 12)
- ✅ 80%+ test coverage
- ✅ Swagger automático actualizado
- ✅ 0 queries sin índice
- ✅ p99 latency < 500ms

---

## 🚀 QUICK WINS (Implementar ya)

Si quieres rápidas victorias antes de Mes 1:

1. **Swagger automático** (1 semana)
   - Bajo esfuerzo, alto valor visible
   - Frontend/QA lo ve inmediatamente

2. **Response Wrapper** (1 semana)
   - Coordinación clara con frontend
   - Mejora UX significativamente

3. **Excepciones tipificadas** (1 semana)
   - Refactor mínimo
   - Tests más robustos

**Esfuerzo total**: 3 semanas antes de Fase 1 formal

---

## 📚 DEPENDENCIAS TÉCNICAS

```
    (Ninguna)
        ↓
    Fase 1: Repository
    ├── Fase 2.1: CQRS
    │   └── Fase 3.2: Distributed Tracing
    ├── Fase 2.2: Redis Cache
    └── Fase 1: API Wrapper
        └── Fase 4.2: Swagger
    
    (Paralelo)
    ├── Fase 3.1: Structured Logging
    ├── Fase 4.1: Test Coverage
    └── Fase 4.3: DTO Strategy
```

---

## 💡 NOTAS ARQUITECTÓNICAS

### Por qué este orden?

1. **Repository Pattern primero**: Base para todo lo demás
2. **CQRS antes de caché**: Separación clara de concerns
3. **Observabilidad paralela**: No bloquea features
4. **Testing continuo**: 20% del esfuerzo siempre en testing
5. **DTOs al final**: Después de estabilizar respuestas

### Extensibilidad futura

Estas decisiones habilitan:
- **Event Sourcing**: CQRS ya está (solo agregar event store)
- **Microservicios**: Repository Pattern desacopla BD
- **GraphQL**: QueryBus se traduce fácil a GraphQL resolvers
- **API Gateway**: Response wrapper estandariza contratos
- **Real-time**: CQRS events → WebSocket broadcasts

---

## 📝 DOCUMENTACIÓN POR FASE

```
Fase 1:
├── README: "Repository Pattern Setup"
├── EXAMPLE: "Cómo migrar un servicio existente"
└── TESTING: "Mocking repositories en tests"

Fase 2:
├── README: "CQRS Guidelines"
├── EXAMPLE: "Command vs Query examples"
└── TESTING: "Testing handlers"

Fase 3:
├── README: "Logging best practices"
├── README: "Distributed tracing guide"
└── EXAMPLE: "Interpretar traces"

Fase 4:
├── README: "Test coverage strategy"
├── README: "Swagger automation"
└── CHECKLIST: "Pre-release audit"
```

---

## ✅ CHECKLIST INICIAL (Semana 1)

- [ ] Presentar roadmap a stakeholders
- [ ] Validar que no hay features bloqueadas
- [ ] Crear feature branches para cada fase
- [ ] Setup de monitoreo baseline (metrics before)
- [ ] Documentación de estado actual
- [ ] Training session sobre nuevos patrones
- [ ] Crear issues en GitHub/JIRA
- [ ] Asignar code reviewers
- [ ] Coordinar con frontend sobre API changes

---

**Próximo paso**: Comenzar Fase 1 - Week 1 con Repository Pattern

