# Plan para cerrar pruebas y recorridos de acceso

Fecha: **11 de noviembre de 2026**, America/Sao_Paulo.

Estado: **IMPLEMENTACIÓN EN CURSO**. Registro transaccional y correcciones de pruebas implementados; validación completa y recorridos de acceso en curso. Los resultados de cierre se documentarán con su candidato exacto.

Proyecto: `meu-sistema-financeiro`. Base revisada: `a2863da5c7eb1b8f76e39eba53c8587b3d58ae05`, rama `codex/consolidacion-2026-11-11`. La [consolidación previa](../validacao/CONSOLIDACION_2026-11-11.md) conserva el trabajo y permite comenzar desde una referencia recuperable.

## 1. Resultado esperado y prioridad

El registro debe confirmar una cuenta únicamente cuando usuario y categorías iniciales estén guardados en una misma transacción. El acceso debe conservar las garantías actuales de sesión y tener pruebas que representen sus contratos reales, desde el registro hasta el cierre de sesión.

**Comenzaría por demostrar y corregir el registro parcial.** Es un riesgo de integridad de datos. Después cerraría las pruebas de sesión y navegación, los fallos residuales de la baseline y los recorridos con PostgreSQL y navegador reales.

Esta entrega abarca registro, login, confirmación de sesión, renovación, rutas protegidas, expiración, recuperación/cambio de contraseña y logout. Incluye las pequeñas correcciones pendientes necesarias para conseguir Jest completo en verde. La limpieza global de lint, el rediseño de planificación, ML, publicación y despliegue conservan entregas propias.

## 2. Evidencia actual

La [baseline consolidada](../validacao/RESULTADOS_CONSOLIDACION_2026-11-11.json), ejecutada con Node 22.23.4, registra:

| Grupo | Fallos | Evidencia y tratamiento |
| --- | ---: | --- |
| Guard de rutas | 16 | `protected-routes.test.ts` falla con `stopObserving is not a function`: el mock automático no proporciona el cierre de `observeSessionLifecycle`. Además, sus fixtures solo preparan un token y no la autoridad de sesión actual. |
| Expectativas de limpieza por 401 | 13 | Doce pantallas y `usePlanejamentoDetailMutations` esperan que `resolveApiError` invoque `clearSession`. Actualmente clasifica el error; la coordinación de credenciales pertenece al transporte/storage. Mantener las comprobaciones de redirección y callbacks que siguen vigentes. |
| Validación de pagos | 6 | Las expectativas omiten `fieldErrors`, presente en el contrato actual de `validatePagoDividaForm`. |
| Perfil en formulario de gasto | 1 | `renderReady()` no encuentra `Salvar gasto` antes de comprobar el botón de perfil. Su causa exacta sigue por confirmar; revisar carga, borrador y estado listo, sin dar por hecho que sea solo un selector. |
| **Frontend** | **36** | **837 aprobados / 873 tests, 95 suites**. Los mismos 36 fallaron antes y después de declarar Skia. |
| Backend: ordenación de transacciones | 1 | La expectativa de `TransacaoRepository` omite el desempate por `id`. **1.079 aprobados / 1.080 tests, 100 suites**. |

Los 29 primeros fallos de frontend se concentran en acceso, pero su diagnóstico no demuestra por sí solo un defecto visible de sesión: hay desajustes concretos de mocks y expectativas. Cada modificación debe conservar una comprobación de comportamiento, no solamente eliminar la assertion que falla.

El problema de registro sí está presente en el código: [`AuthService.register`](../../backendnest/src/auth/auth.service.ts) guarda mediante `UsersService.create` y después llama a [`CategoriasService.seedDefaultCategories`](../../backendnest/src/categorias/categorias.service.ts). Ambos caminos utilizan repositorios independientes. La transacción interna de un `save` no incluye automáticamente la operación previa del otro repositorio. Si falla el seed, el usuario puede quedar persistido.

El contrato actual del registro devuelve `{ usuario }`, sin tokens; [`RegisterScreen`](../../frontend/src/modules/auth/screens/RegisterScreen.tsx) lleva después a `/login`. El plan mantiene ese comportamiento.

### Alcance preliminar de dependencias

Se actualizó el índice estructural GitNexus sobre la réplica de la base consolidada. La búsqueda FTS permanece deshabilitada. El análisis upstream, incluyendo tests y con profundidad tres, devuelve:

| Símbolo | Dependencias directas | Procesos afectados | Riesgo del grafo |
| --- | ---: | ---: | --- |
| `AuthService.register` | 2 | 0 resueltos | Bajo, con límite inferior: falta una llamada cuyo receptor no se resolvió |
| `CategoriasService.seedDefaultCategories` | 2 | 1 | Bajo |
| `RootLayout` | 0 resueltas | 0 resueltos | Desconocido: el grafo no cubre todas las referencias de React/router |
| `resolveApiError` | 60 | 70 | **Crítico** |

Son datos de alcance estático, no una valoración de integridad: el alta parcial sigue siendo prioritaria aunque el grafo de `register` sea pequeño. Sus consumidores revisados en fuente incluyen el controlador HTTP y el seed demo. `RootLayout` también se importa/reexporta desde la app y las fixtures de navegador; cero aristas resueltas no significa ausencia de consumidores.

El alcance crítico de `resolveApiError` justifica conservar su contrato y ajustar primero los tests obsoletos. Cualquier cambio semántico que se demuestre necesario requiere revisar esos consumidores. Repetir el análisis antes de implementar sobre otro candidato.

## 3. Contratos que deben quedar explícitos

| Situación | Comportamiento que se debe probar |
| --- | --- |
| Registro correcto | Una cuenta completa, catálogo inicial completo de ocho categorías del usuario y respuesta 201 sin contraseña/hash ni tokens. |
| Fallo de categorías antes del commit | Ningún usuario ni categoría de ese intento permanece; el mismo email/CPF puede volver a utilizarse en un intento posterior correcto. |
| Registro concurrente con email o CPF repetido | Una sola cuenta completa; la petición perdedora devuelve el conflicto correspondiente. |
| Respuesta perdida después de confirmar el registro | La cuenta puede existir completa. Tratar el resultado como desconocido y ofrecer acceso/recuperación; no afirmar que hubo rollback ni reintentar indefinidamente. |
| Sin sesión en ruta protegida | Redirección a login y ausencia de contenido protegido. |
| Token local pendiente de validación | Ocultar contenido protegido hasta confirmar autoridad con el servidor. Un token presente no basta. |
| Credenciales rechazadas en login o formulario público | Mostrar el error del formulario; no borrar por esa respuesta la sesión de otra operación o generación. |
| Fallo temporal de red o servidor | Conservar credenciales, ocultar datos cuando la autoridad no esté confirmada y permitir reintento o salida local. |
| Sesión terminal vigente | Invalidar únicamente el contexto propietario; mostrar login sin recuperar credenciales antiguas. |
| Respuesta tardía de sesión A después de login B | No borrar, redirigir ni autorizar la sesión B usando la respuesta de A. |
| Renovación concurrente | Mantener la coordinación existente y comprobar que una operación antigua no repita una escritura financiera. |
| Logout sin conexión | Completar la salida local y comunicar que la revocación remota no está confirmada. Recargar o volver atrás no debe recuperar el acceso. |
| Background/resume y expiración | Ocultar datos y reconfirmar autoridad; lecturas, polling o escritura de texto no renuevan por sí solos la inactividad. |

Conservar los códigos, rutas públicas, políticas de caducidad, validación de CPF/CEP, consentimiento y formato público existentes. El plan no introduce autologin, verificación de email ni un cambio de política de identidad.

## 4. Entregas y puertas de aceptación

### L0 — Fijar baseline y mapa de responsabilidades

1. Crear una rama local nueva desde la referencia consolidada, por ejemplo `codex/cierre-pruebas-acceso`; comprobar cambios concurrentes antes de editar.
2. Registrar el SHA y reutilizar los resultados existentes si las fuentes no cambiaron. Al comenzar la implementación, reproducir los fallos focalizados con Node 22, manifiestos/locks actuales y resultados JSON por candidato.
3. Vincular los 36 fallos frontend y el fallo backend a sus lotes. Si aparecen otros, conservar sus identidades y diagnosticar la diferencia antes de ampliar el trabajo.
4. Documentar responsabilidades actuales: API coordina respuestas y refresh; storage/coordinador modifica el contexto propietario; `resolveApiError` clasifica; pantallas/hooks conservan sus mensajes y navegación contractual; `RootLayout` verifica autoridad y protege el render.
5. Actualizar GitNexus sobre las fuentes del candidato y comprobar su vigencia antes de cambios de símbolos. La búsqueda FTS está deshabilitada en el entorno recuperado: usar contexto estructural y revisión de fuente cuando `query` informe esa limitación. Ejecutar `impact` antes de cada símbolo modificado y `detect_changes` antes de cada commit, como exige [AGENTS.md](../../AGENTS.md).

**G0:** baseline identificada por SHA, fallos clasificados, herramientas utilizables y matriz de contratos revisada. Un índice con advertencia de antigüedad no sirve para dar por cerrado el análisis de impacto de implementación.

### L1 — Registro atómico y conflictos concurrentes

**Diseño propuesto:** incorporar `AuthRegistrationRepository`, siguiendo el patrón transaccional específico que ya utiliza auth, y hacer que `AuthService.register` delegue en una operación `createWithDefaultCategories`.

- Mantener normalización, validación, preconsultas de duplicados y cálculo de bcrypt en la capa actual. Calcular el hash antes de abrir la transacción para evitar mantenerla abierta durante ese trabajo.
- Persistir usuario y todas sus categorías mediante el **mismo `EntityManager` recibido de `DataSource.transaction`**. No envolver en una transacción llamadas a servicios que sigan escribiendo con repositorios globales.
- Reutilizar `DEFAULT_CATEGORIAS` como fuente única del catálogo. La nueva operación actúa sobre un usuario nuevo y confirma el catálogo completo; el guard `count > 0` del seed existente no constituye una prueba de integridad de un alta parcial.
- Mantener el seed reutilizable y sus consumidores. Si resulta necesario extraer una construcción compartida de categorías, hacerlo junto con sus consumidores y analizar su impacto; no cambiar `BaseRepository` para todos los dominios.
- Registrar el nuevo provider en `AuthModule`; conservar `toPublicUser` y la respuesta actual. No emitir éxito ni efectos externos antes de confirmar la transacción.
- Las preconsultas actuales mejoran el mensaje, pero no evitan carreras. La unicidad de email y CPF existe en entidad/migraciones. Verificar el catálogo real en la DB de ensayo y traducir solo sus violaciones reconocidas a `AUTH_EMAIL_ALREADY_EXISTS` o `AUTH_CPF_ALREADY_EXISTS`, con campo y HTTP 409.
- Contemplar los nombres efectivos de constraints/índices de instalaciones existentes: la baseline declara unicidad y la migración 0003 añade `uq_usuario_cpf`. No convertir cualquier error de integridad de categorías en un conflicto de email ni publicar diagnósticos SQL.
- No se prevé migración de esquema para introducir la transacción. Añadirla únicamente si una comprobación demuestra que falta una garantía necesaria; no renombrar constraints por conveniencia del test.

**Pruebas obligatorias:**

1. Unitarias del servicio: validaciones, normalización, hash, delegación, respuesta pública y propagación/traducción de errores.
2. Unitarias del repositorio: uso del manager transaccional para ambas entidades y ausencia de escrituras en repositorios globales. Son complementarias a la prueba de rollback real.
3. Integración con PostgreSQL descartable: alta correcta; fallo inducido al guardar categorías; fallo después de una escritura parcial; reintento posterior; dos altas concurrentes con igual email normalizado; dos con igual CPF y emails distintos; independencia de usuarios diferentes.
4. Observar el resultado desde otra conexión después de finalizar cada transacción: contar usuarios y categorías y comprobar propietarios/catálogo. Un spy que solo confirma la llamada a `transaction()` no demuestra atomicidad.
5. Inducir fallos exclusivamente con fixtures/adaptadores o mecanismos confinados a la DB de prueba. No introducir flags de fallo en la API de producción ni sleeps para fabricar carreras.

**Archivos principales:** `auth.service.ts` y su spec, `auth.module.ts`, nuevo repositorio/spec, `categorias/default-categorias.ts` si hace falta compartir construcción, nuevo `test/registration-atomicity.e2e-spec.ts` y documentación de errores del contrato HTTP.

**G1:** rollback real demostrado y alta concurrente con un solo ganador completo. Sin PostgreSQL ejecutado, el lote puede quedar implementado con integración pendiente, pero no declarado cerrado.

### L2 — Cerrar los 29 fallos de sesión y navegación

- Preparar fixtures de sesión que incluyan generación, snapshot, identidad, autoridad, respuesta de `/auth/session` y cierres de suscripciones. Tomar como referencia las pruebas vigentes de `session-authority-root.test.tsx` y los helpers existentes, evitando un mock global que oculte fallos de otros tests.
- Actualizar los 16 tests de rutas para el ciclo real: sin credenciales, pendiente de confirmación, autoridad válida, indisponibilidad y árbol de navegación todavía no listo. Conservar el conjunto de rutas públicas y protegidas probado.
- Proporcionar funciones de cleanup reales en los dobles de `observeSessionLifecycle` y suscripciones. Aislar listeners, timers, estado de autoridad y almacenamiento por caso. No debilitar el cleanup del producto para tolerar mocks incompletos.
- En las doce pantallas y el hook, reemplazar la expectativa obsoleta de `clearSession` dentro de `resolveApiError` por pruebas de clasificación sin efectos secundarios. Mantener assertions de mensaje, `router.replace` u `onUnauthorized` donde sigan siendo el contrato de ese consumidor.
- Probar la limpieza de la sesión en el nivel propietario —interceptor/storage/coordinador— incluyendo una respuesta terminal vigente y otra obsoleta. Distinguir un 401 público de autenticación de una sesión terminal.
- Conservar y ampliar los tests de carreras ya aprobados: refresh/logout, logout local, tombstones, dos contextos, cambio de generación y retorno desde background. Las correcciones de tests no deben permitir que una respuesta de A afecte B.
- Cambiar código productivo únicamente cuando una prueba de comportamiento demuestre un defecto. Mantener esas correcciones separadas de los ajustes de fixtures y expectativas.

**Archivos principales:** `__tests__/navigation/protected-routes.test.ts`, `session-authority-root.test.tsx`, helpers de sesión, tests de las doce pantallas, `usePlanejamentoDetailMutations.test.tsx`, tests de API/storage/coordinador y, si la evidencia lo requiere, sus implementaciones.

**G2:** los 29 casos pasan y también las suites de autoridad, refresh, logout y respuestas obsoletas; sin timers/listeners pendientes ni contaminación entre suites.

### L3 — Cerrar la baseline residual

- Ajustar los seis tests del validador de pagos al contrato completo `{ valid, message, fieldErrors }`. Comprobar campos, importes y fechas; no sustituir comparaciones por un matcher que ignore el feedback nuevo.
- Diagnosticar el caso del perfil desde su estado de carga/borrador y `renderReady()`. Corregir la causa y comprobar navegación accesible a `/usuario`; mantener habilitado el control de que el formulario llega al estado listo. Si hay una carrera, controlarla con promesas/eventos y esperas de estado, no con demoras arbitrarias.
- Actualizar la expectativa backend de ordenación para incluir el desempate estable por `id`, conservando filtros, límite y offset. No quitar el desempate del repositorio para satisfacer el test antiguo.

**G3:** Jest completo frontend y backend con **cero fallos**. Los totales pueden aumentar con las pruebas nuevas; cualquier retirada o consolidación de casos debe conservar trazabilidad de la cobertura de comportamiento.

### L4 — Probar los recorridos completos de acceso

Utilizar el harness mantenido y fuentes construidas desde el SHA candidato. U4 ya reutiliza `RootLayout` y `LoginScreen` reales, pero no cubre por sí solo todo el registro ni todas las rutas de la aplicación. Extender la cobertura con pantallas reales y una exportación nueva; no reutilizar `frontend/smoke-web` como evidencia del candidato.

| Caso | Observación mínima |
| --- | --- |
| Registro → login → dashboard | Usuario y categorías completos en DB; registro no autentica; login correcto; contenido protegido después de confirmar autoridad. |
| Alta rechazada o seed fallido | Error recuperable en el formulario, sin estado parcial previo al commit y sin redirección de éxito. |
| Email/CPF duplicado y doble envío | Mensaje del campo adecuado, una sola cuenta completa y estado del botón recuperado. |
| Credenciales incorrectas y recuperación | Error de login visible; forgot/reset conforme al contrato y posterior acceso; no mostrar tokens ni contraseñas. |
| Cambio de contraseña | Reautenticación y revocación según el contrato existente; comprobar el acceso posterior. |
| URL protegida directa, recarga y atrás | Sin exposición antes de confirmar sesión; tras logout no reaparece información protegida. |
| Red indisponible y reconexión | Credenciales retenidas cuando corresponde, datos ocultos y reintento explícito funcional. |
| Expiración inactiva y absoluta | Rechazo real del servidor y salida protegida. Usar fechas controladas en DB descartable, sin cambiar las políticas de producción. |
| Respuesta A retenida, login B | B permanece intacta y ninguna respuesta antigua reabre o cierra su contexto. |
| Dos pestañas y logout | Rotación coordinada, propagación del cierre y ausencia de resurrección después de recargar. |
| Background/resume | Contenido oculto hasta una confirmación nueva; un header antiguo no basta. |
| Logout con servidor inaccesible | Salida local efectiva y aviso de revocación remota no confirmada. |

La prueba debe arrancar PostgreSQL/Nest/Expo/browser como recursos propios y descartables, con puertos, owner, marcador, límites de tiempo y limpieza comprobables. Revisar las condiciones vigentes del [harness](../../backendnest/test/session-harness/README.md), identificando candidato y casos; las autorizaciones o resultados históricos no equivalen a una ejecución nueva.

Probar sin leer los `.env` privados de la aplicación ni conectar con su base de datos. Respetar el throttling: fixtures aisladas y alcance controlado, sin retirar protecciones globales. Registrar resultados y limpieza por intento. Los screenshots/trazas, si se requieren, usarán datos sintéticos y custodia definida.

**G4:** los recorridos seleccionados pasan con PostgreSQL y navegador reales y evidencia del SHA. Si solo pasan mocks, mantener `RECORRIDOS_PENDIENTES`. El resultado web no acredita Android/iOS; los recorridos nativos deben quedar identificados como pendientes hasta ejecutarse.

### L5 — Cierre, CI y continuidad

- Ejecutar tipos completos, Jest completo, build Nest, export web y pruebas del harness afectado sobre el candidato exacto, fuera del árbol que aún tenga cambios de otros lotes.
- Ejecutar lint sin autofix. Los archivos nuevos deben quedar sin errores; registrar y corregir los errores introducidos en el diff. El lint global conserva una deuda grande: identificar los preexistentes que queden fuera del alcance y no presentar la CI general como verde mientras siga fallando.
- Incorporar los casos nuevos a los runners/jobs correspondientes, conservando confinamiento, límites y permisos. No confundir un workflow versionado con una ejecución remota aprobada.
- Actualizar `docs/desenvolvimento/TESTES.md`, trazabilidad frontend y contrato HTTP si los errores de concurrencia requerían documentación. Mantener los informes históricos de consolidación intactos.
- Crear un informe final con SHA, comandos, entorno, casos, resultados, fallos restantes y límites. Registrar por separado cierre unitario, acceso web con integración y estado de Android/iOS, CI remota y deuda global de lint.

**G5:** integridad del alta demostrada, Jest completo en verde, tipos/builds correctos, recorridos web reales comprobados y ningún fallo nuevo de lint sin resolver. Solo entonces declarar cerrada esta entrega de acceso web y pruebas. Esto no cierra automáticamente P4/U6, preparación de producción ni validación nativa.

## 5. Datos que ya podrían estar incompletos

La transacción protege las altas futuras; no repara por sí sola cuentas anteriores.

Preparar una consulta de diagnóstico de solo lectura para localizar usuarios sin categorías y contrastarlos con evidencias de creación, migraciones y uso. Esa condición es una señal para revisar, no prueba de un registro fallido. No ejecutar un seed masivo: podría duplicar categorías, alterar decisiones del usuario o considerar completa una inicialización parcial.

Si aparecen casos confirmados, diseñar una reparación idempotente y específica, con inventario previo, preservación de categorías personalizadas, transacción y verificación posterior. Su ejecución debe partir de datos y alcance concretos; no forma parte de la corrección automática del nuevo registro.

## 6. Secuencia de commits y comprobaciones

| Entrega | Corte propuesto | Comprobación de aceptación |
| --- | --- | --- |
| L0 | Contratos y fixtures necesarios | Reproducción focalizada y mapa de fallos por SHA. |
| L1 | Registro transaccional + unitarias + integración de rollback/concurrencia | Fallo reproducido antes, ausencia de estado parcial después y contratos HTTP preservados. |
| L2 | Mocks/expectativas de acceso; defectos productivos en commits separados si aparecen | 29 casos corregidos y regresiones de seguridad vigentes aprobadas. |
| L3 | Validadores, perfil y expectativa de ordenación, en cortes pequeños | Jest completo frontend/backend sin fallos. |
| L4 | Pruebas de recorridos y adaptación mínima del harness | Ejecución real con fuentes del candidato y limpieza demostrada. |
| L5 | CI/documentación/evidencia del candidato | Cierre con alcance y pendientes explícitos. |

Desde el directorio de cada paquete, con Node 22 en PATH, las comprobaciones de código usan los entrypoints ya instalados:

```text
# Backend
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/jest/bin/jest.js --runInBand
node node_modules/@nestjs/cli/bin/nest.js build

# Frontend
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/jest/bin/jest.js --runInBand
node node_modules/expo/bin/cli export --platform web
```

Para integración, utilizar el runner E2E mantenido con un perfil descartable verificado y seleccionar explícitamente el nuevo spec de registro; preparar el comando concreto junto con el entorno, no apuntarlo a una DB disponible por defecto. Conservar stdout/JSON fuera de los fuentes y vincular cada resultado al SHA probado.

La reversión se hará por commits y dependencias, preservando la rama consolidada, los respaldos, los worktrees y los cambios ajenos. Mantener deshabilitado el mantenimiento automático local mientras se preservan los registros históricos; no limpiar el repositorio para ocultar una baseline fallida.
