# 📐 ARQUITECTURA: ANTES vs DESPUÉS
## Transformación Visual del Backend

---

## ARQUITECTURA ACTUAL (MVP)

```
┌─────────────────────────────────────────────────────────────┐
│                        API Controllers                       │
├──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ Users    │ Contas   │ Transac  │ Dividas  │ ... Outros       │
└──────────┴──────────┴──────────┴──────────┴──────────────────┘
           ↓             ↓           ↓            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Services (Lógica Negocio)                  │
├──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ Users    │ Contas   │ Transac  │ Dividas  │ ... Outros       │
└──────────┴──────────┴──────────┴──────────┴──────────────────┘
           ↓             ↓           ↓            ↓
┌─────────────────────────────────────────────────────────────┐
│          Inyección directa de Repository<T>                  │
│              (Acoplado a TypeORM)                            │
└─────────────────────────────────────────────────────────────┘
           ↓             ↓           ↓            ↓
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
└─────────────────────────────────────────────────────────────┘
```

### Problemas ⚠️
```
Controllers          Services           DB
    ↓                   ↓               ↓
    └─────────────────────────────────────→ Sin abstracción
                                       → Acoplado a TypeORM
    └─────────────────────────────────────→ Difícil de testear
    └─────────────────────────────────────→ Sin auditoría explícita
    └─────────────────────────────────────→ Excepciones sin tipificar
```

---

## ARQUITECTURA DESPUÉS (Fase 1)

```
┌─────────────────────────────────────────────────────────────┐
│              API Controllers (con Response)                  │
├──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ Users    │ Contas   │ Transac  │ Dividas  │ ... Otros        │
│ (DTO)    │ (DTO)    │ (DTO)    │ (DTO)    │                  │
└──────────┴──────────┴──────────┴──────────┴──────────────────┘
           ↓             ↓           ↓            ↓
┌─────────────────────────────────────────────────────────────┐
│      Services (Lógica de Negocio + Excepciones)             │
├──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ Users    │ Contas   │ Transac  │ Dividas  │ ... Otros        │
│ Service  │ Service  │ Service  │ Service  │                  │
└──────────┴──────────┴──────────┴──────────┴──────────────────┘
           ↓             ↓           ↓            ↓
┌─────────────────────────────────────────────────────────────┐
│     Repositories (Interfaz)  → Repository Pattern             │
│  ┌──────────┬──────────┬──────────┬──────────┐              │
│  │ Users    │ Contas   │ Transac  │ Dividas  │              │
│  │Repository│Repository│Repository│Repository│              │
│  └──────────┴──────────┴──────────┴──────────┘              │
└─────────────────────────────────────────────────────────────┘
           ↓             ↓           ↓            ↓
┌─────────────────────────────────────────────────────────────┐
│          TypeORM Repository Implementation                    │
│          (Agnóstico - puede cambiar a Prisma)               │
└─────────────────────────────────────────────────────────────┘
           ↓             ↓           ↓            ↓
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
└─────────────────────────────────────────────────────────────┘
```

### Mejoras ✅
```
Agnóstico de BD:
Controllers → Services → Repository Interface → {TypeORM/Prisma/MongoDB}
                                             → Cambio sin afectar arriba

Testeable:
Controllers → Services (inyectado mock)
             → Mock Repository (sin BD)

Auditoría:
Services lanzan excepciones tipificadas → Logs estructurados
```

---

## ARQUITECTURA EN FASE 2 (CQRS)

```
┌──────────────────────────────────────────────────────────────┐
│                    Controllers (HTTP/REST)                   │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Create Conta │ List Contas  │ Transfer $   │ ... Otros      │
│ (Comando)    │ (Query)      │ (Comando)    │                │
└──────────────┴──────────────┴──────────────┴────────────────┘
        ↓                    ↓                    ↓
    Command Bus          Query Bus          Command Bus
        ↓                    ↓                    ↓
┌──────────────┬──────────────┬──────────────────────────────┐
│ Commands     │  Queries     │        Event Bus             │
│              │              │                              │
│ CreateConta  │ GetConta     │ ContaCreatedEvent            │
│ UpdateConta  │ ListContas   │ ContaUpdatedEvent            │
│ DeleteConta  │ GetBalance   │ ContaDeletedEvent            │
└──────────────┴──────────────┴──────────────────────────────┘
        ↓                    ↓                    ↓
┌──────────────────────────────────────────────────────────┐
│           Handlers (Lógica de negocio)                   │
├──────────────┬──────────────┬──────────────────────────┤
│ CommandHandlers              │ QueryHandlers           │
│                              │                         │
│ • Validación                 │ • Sin side effects      │
│ • Persistencia               │ • Cacheable             │
│ • Event publishing           │ • Read-optimized        │
└──────────────┴──────────────┴──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────┐
│     Repository Layer (con Caché Redis L2)               │
└──────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────┐
│              PostgreSQL Database                          │
└──────────────────────────────────────────────────────────┘
```

### Flujo Comando (Escritura)
```
HTTP POST /contas/transfer
         ↓
   Controller
         ↓
   TransferContaCommand (datos)
         ↓
   CommandBus.execute()
         ↓
   TransferContaHandler
    • Validar
    • Actualizar DB
    • Publicar ContaTransferredEvent
    • Invalidar caché
         ↓
   Event Subscribers (auditoría, notificaciones)
```

### Flujo Query (Lectura)
```
HTTP GET /contas/balance?id=123
         ↓
   Controller
         ↓
   GetContaBalanceQuery (id)
         ↓
   QueryBus.execute()
         ↓
   Cache Hit? → Return datos cached
         ↓
   GetContaBalanceHandler
    • Ejecutar query optimizada
    • Cachear resultado
    • Return
```

---

## ARQUITECTURA EN FASE 3 (OBSERVABILIDAD)

```
┌────────────────────────────────────────────────────────────┐
│              Controllers + Structured Logging               │
└────────────────────────────────────────────────────────────┘
        ↓
┌────────────────────────────────────────────────────────────┐
│  RequestContextMiddleware (request ID, user, timestamp)    │
└────────────────────────────────────────────────────────────┘
        ↓
┌────────────────────────────────────────────────────────────┐
│         Pino Logger (Structured Logging)                   │
│  {timestamp, level, context, message, userId, ...}        │
└────────────────────────────────────────────────────────────┘
        ↓            ↓              ↓
    Console      File System    OpenTelemetry
        ↓            ↓              ↓
    Console      logs.json      Jaeger/Zipkin
                                (Distributed Tracing)
                                    ↓
                              Trace visualization
                              Latency analysis
```

### Distributed Tracing Flow
```
Client HTTP Request
         ↓
┌────────────────────────────────────────────────┐
│ Controller (Span: HTTP Handler)                │
│  tracingId: uuid-123                           │
│  startTime: 2026-05-17T10:00:00Z               │
└────────────────────────────────────────────────┘
         ↓ (propagate traceId)
┌────────────────────────────────────────────────┐
│ Service (Span: Business Logic)                 │
│  - Validation: 5ms                             │
│  - Repository call: 15ms                       │
│  - Event publishing: 2ms                       │
└────────────────────────────────────────────────┘
         ↓ (propagate traceId)
┌────────────────────────────────────────────────┐
│ Repository (Span: Database Query)              │
│  - Query time: 12ms                            │
│  - Rows: 1                                     │
└────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────┐
│ Jaeger Backend                                 │
│  Waterfall diagram:                            │
│  HTTP [0-40ms]                                 │
│  ├─ Business Logic [2-20ms]                    │
│  │  ├─ Validation [2-7ms]                      │
│  │  └─ Repository [10-20ms]                    │
│  │     ├─ Query [10-18ms]                      │
│  │     └─ Transform [18-20ms]                  │
│  └─ Serialization [20-40ms]                    │
└────────────────────────────────────────────────┘
```

---

## COMPARATIVO: MONOLITO vs CQRS-READY

| Aspecto | MVP | CQRS | Beneficio |
|---------|-----|------|----------|
| **Commands/Queries** | Mezclados en Service | Separados | Auditoría explícita |
| **Side effects** | Implícitos | Explícitos | Debugging fácil |
| **Caché** | Manual | Automático en QueryHandler | Hit rate 60%+ |
| **Escalabilidad** | Service monolítico | Handlers independientes | Escalar solo reads |
| **Testing** | Mock repository | Mock command bus | Más aislado |
| **Eventos** | Publicación manual | CommandBus automático | Event sourcing ready |
| **Auditoría** | Logs manuales | Automática | 100% coverage |

---

## STACK TECNOLÓGICO POR FASE

### Fase 1
```
├── NestJS 11 (sin cambios)
├── TypeORM (sin cambios)
├── Jest (sin cambios)
└── NEW:
    ├── @nestjs/common (BaseRepository)
    ├── Custom interceptors/filters
    └── uuid (para requestId)
```

### Fase 2
```
├── TODO: @nestjs/cqrs
├── TODO: redis + ioredis
├── TODO: @nestjs/cache-manager
└── TODO: event-emitter2
```

### Fase 3
```
├── TODO: pino + pino-pretty
├── TODO: @opentelemetry/api
├── TODO: @opentelemetry/sdk-node
└── TODO: Jaeger (infraestructura)
```

### Fase 4
```
├── TODO: @nestjs/swagger
├── TODO: swagger-ui-express
└── (testing tools ya incluidos)
```

---

## DEPLOYMENT STRATEGY

### Pre-Fase 1
```
Staging (copy of production)
   ↓
Smoke tests (sanity check)
   ↓
Production (gradual rollout 10% → 50% → 100%)
```

### Durante Fases
```
Feature branches (1 rama por componente)
   ↓
PR with tests (80%+ coverage)
   ↓
Code review (2+ devs)
   ↓
Staging deployment
   ↓
QA validation
   ↓
Merge a main
   ↓
Production (con rollback plan)
```

---

## MÉTRICAS ANTES / DESPUÉS

### Performance

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| **p50 latencia** | 100ms | 80ms | -20% |
| **p95 latencia** | 300ms | 210ms | -30% |
| **p99 latencia** | 800ms | 400ms | -50% |
| **DB queries** | Direct | Via Repository | Abstracto |
| **Cache hit** | N/A | 60%+ | N/A |

### Código

| Métrica | Antes | Después |
|---------|-------|---------|
| **Test coverage** | 45% | 80% |
| **Cyclomatic complexity** | High | Medium |
| **Technical debt** | Alto | Bajo |
| **Code duplication** | Medium | Bajo |

### Operacional

| Métrica | Antes | Después |
|---------|-------|---------|
| **MTTR (Mean Time To Repair)** | 60 min | 15 min |
| **Bugs por release** | 8-10 | 2-3 |
| **Breaking changes** | 3-4/quarter | 0-1/quarter |

---

## DIAGRAMA DE DEPENDENCIAS

```
Fase 4
  │
  ├─ Test Coverage (independiente)
  ├─ Swagger (depende de DTOs)
  ├─ DTOs (depende de Fase 1)
  └─ Database Optimization (depende de Fase 1)
    
Fase 3
  │
  ├─ Structured Logging (independiente)
  ├─ Distributed Tracing (depende de Logging)
  └─ Observability Dashboard (depende de Prometheus)

Fase 2
  │
  ├─ CQRS (depende de Fase 1)
  └─ Redis Cache (depende de Fase 1)

Fase 1 (Foundation)
  │
  ├─ Repository Pattern
  ├─ Excepciones Tipificadas
  └─ API Response Wrapper
```

---

## CONFIGURACIÓN RECOMENDADA (docker-compose)

```yaml
version: '3.8'

services:
  # Backend NestJS
  api:
    build: ./backendnest
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgres://user:pass@postgres:5432/financeiro
      REDIS_URL: redis://redis:6379
    depends_on: [postgres, redis]

  # PostgreSQL
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: financeiro
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Redis (Fase 2+)
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  # Jaeger (Fase 3+)
  jaeger:
    image: jaegertracing/all-in-one
    ports: ["6831:6831/udp", "16686:16686"]

  # Prometheus (Fase 3+)
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports: ["9090:9090"]

  # Grafana (Fase 3+)
  grafana:
    image: grafana/grafana
    ports: ["3001:3000"]
    depends_on: [prometheus]

volumes:
  postgres_data:
```

---

**Esta arquitectura es escalable, mantenible y preparada para crecer con el producto.**

