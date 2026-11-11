# Plan de implementación: calidad, reproducibilidad y CI

Fecha: **11/11/2026**, America/Sao_Paulo.
Estado: **IMPLEMENTACIÓN EN CURSO**. Baseline conservada en `codex/calidad-ci-2026-11-11`; contrato de lint definido y correcciones por lotes en progreso. [Seguimiento](../validacao/IMPLEMENTACION_CALIDAD_CI_2026-11-11.md).
Base: **`261c209d7856400ab95ecc229971ba009b4f92ea`**, rama
`codex/cierre-pruebas-acceso`. El código de acceso validado está en `631b187`.

Este plan continúa el [cierre local de acceso](../validacao/CIERRE_PRUEBAS_ACCESO_2026-11-11.md).
La planificación reutiliza sus resultados y el JSON de lint conservado; no
constituye una ejecución nueva de pruebas, PostgreSQL o CI.

## 1. Resultado esperado

Conseguir una instalación limpia y un conjunto de comprobaciones obligatorias
reproducibles en el entorno de CI, con cero errores de lint en fuentes mantenidas,
pruebas y builds aprobados, y evidencia remota vinculada al commit exacto.

Se implementará en una rama nueva, por ejemplo `codex/calidad-ci-2026-11-11`,
desde la base indicada. Antes de editar se conservarán los cambios concurrentes
y se actualizará la baseline si el HEAD ya es diferente.

El alcance comprende backend, frontend, arneses, workflows y el job ML existente.
Para declarar verde la CI general deben pasar todos sus jobs obligatorios,
incluido ML. Android/iOS, despliegue, reparaciones de datos históricos y nuevas
funcionalidades financieras conservan entregas propias.

## 2. Baseline y problemas concretos

| Superficie | Evidencia disponible | Pendiente |
| --- | --- | --- |
| Backend | Jest 1.089/1.089, tipos y build aprobados | Lint completo: 1.555 errores y 140 advertencias |
| Frontend | Jest 882/882, tipos y export web aprobados | Fuentes mantenidas: 70 errores y 78 advertencias |
| Acceso integrado | Seis casos PostgreSQL y seis recorridos Edge aprobados | PostgreSQL 16 y Chromium/Linux del workflow |
| Arneses | 101 casos aprobados, con el último ajuste de portabilidad comprobado por separado | Selección y cobertura explícitas por plataforma |
| ML | Job con Python 3.11 y requisitos por intervalos | Instalación/pruebas actuales y lock de CI sin verificar |
| CI | Cinco jobs automáticos; P4 manual separado | Ejecución remota del candidato actual |

El total recursivo frontend es 3.784 errores/2.564 advertencias porque incluye
el bundle histórico `frontend/smoke-web`. Ese bundle debe conservarse; no es
fuente mantenida ni sustituye la exportación nueva.

El lint backend local incluye specs y arneses. El workflow actual excluye
`*.spec.ts` y convierte tres reglas `no-unsafe-*` en advertencias. Por tanto,
**1.555 no es el número medido del comando CI**. Q0 registrará ambos perfiles
con sus comandos exactos antes de unificarlos. Un comentario del workflow
todavía afirma que `npm run lint` hace autofix, pero el script actual no lo hace.

### Inventario para ordenar el trabajo

| Grupo backend | Errores |
| --- | ---: |
| `no-unsafe-member-access` | 590 |
| `no-unsafe-call` | 509 |
| `no-unsafe-assignment` | 173 |
| `no-unsafe-return` | 65 |
| Prettier | 118 |
| Otras reglas | 100 |

ESLint marca 131 errores backend como potencialmente autocorregibles. No se
aplicará un fix global: cambios de tipos, asincronía y contratos requieren revisión.
`u5-browser.spec.ts` concentra 870 errores; `a8.spec.ts`, 243; `u5.ts`, 94;
`transferencias.service.ts`, 73. Se revisarán por separado producto y fixtures.

| Grupo frontend mantenido | Errores |
| --- | ---: |
| `react-hooks/refs` | 55 |
| `react-hooks/set-state-in-effect` | 7 |
| `no-undef` | 7 |
| `import/namespace` | 1 |

Los principales focos son `useFinancialDraft.ts`, los formularios de gasto y
participante de planificación, `QuickActionsMenu.tsx` y los hooks de detalle.
Estas reglas requieren revisar comportamiento y lifecycle, no solo formato.

P4 tiene dos incompatibilidades confirmadas en la fuente actual:

- `p4-ci.cjs` ejecuta `u6.spec.cjs` en Linux, que incluye dos casos de
  `u6-owned.spec.cjs` con `assert.equal(process.platform, 'win32')`.
- `u5-poll.spec.cjs` importa Playwright desde `frontend/node_modules`, mientras
  `p4-proof.yml` instala únicamente el backend.

Los PASS del candidato privado P4 de octubre no acreditan la rama actual.

## 3. Contratos de calidad

1. **Lint:** cero errores en todo el alcance mantenido acordado, incluyendo
   tests y arneses. Las advertencias inicialmente no bloquearán la CI, pero
   tendrán inventario por regla/archivo y no se admitirán advertencias nuevas
   en el diff. No convertir errores en warnings para alcanzar el resultado.
2. **Cobertura:** no retirar assertions, tests ni casos de concurrencia para
   superar lint. Un resultado no aplicable por plataforma debe quedar explícito
   y tener su plataforma requerida comprobada, sin sumarlo como PASS.
3. **Producto:** conservar autoridad de sesión, generación propietaria, logout,
   refresh, borradores, cancelaciones, foco y los contratos monetarios.
4. **Reproducibilidad:** dependencias Node desde los locks; versiones efectivas,
   plataforma, comandos y SHA registrados. Ningún check dependerá del
   `node_modules` del workspace ni de `.env` privados.
5. **CI:** los mismos comandos y reglas bloqueantes localmente y en remoto;
   sin autofix, `continue-on-error` ni `|| true` en checks obligatorios.
6. **Pruebas con DB:** owner, marcador, lease, límites y limpieza del arnés
   existente. Una base en cuarentena no se reutiliza.

## 4. Entregas y puertas de aceptación

### Q0 — Congelar el candidato e inventariar la deuda

- Crear la rama local; registrar SHA, estado Git, hashes de manifests/locks,
  reglas, scripts y workflows. Mantener la rama de acceso recuperable.
- Generar un inventario de lint en JSON por regla, archivo, severidad,
  fixabilidad y capa: producto, tests, configuración y generado.
- Registrar por separado el comando local completo y el comando CI actual.
  Las cifras anteriores sirven como referencia si las entradas siguen iguales.
- Revisar `eslint --print-config` de un archivo representativo por perfil.
- Actualizar GitNexus y ejecutar `impact` antes de modificar símbolos, reportando
  callers, procesos y riesgo. Los cambios HIGH/CRITICAL requieren advertencia
  previa y regresiones de los contratos afectados. Ejecutar `detect_changes`
  antes de cada commit, conforme a [AGENTS.md](../../AGENTS.md).

**GQ0:** inventario trazable al SHA, perfiles distinguidos y cada regla asignada
a un lote. No declarar defectos de negocio solo por un diagnóstico del linter.

### Q1 — Establecer un contrato común de lint

- Ajustar `frontend/eslint.config.js` y `backendnest/eslint.config.mjs` con
  perfiles explícitos para TypeScript de producto, tests y CJS/configuración.
- Usar globals Node solamente en los archivos que los necesitan. Resolver el
  lint CJS sin desactivar el análisis tipado de TypeScript del producto.
- Excluir globalmente solo salidas verificadas como generadas: `dist`, `.expo`
  y `smoke-web`, con patrones exactos y sin borrar archivos históricos.
- Verificar que los ignores no alcancen `src`, `app`, tests o arneses mantenidos.
  Añadir una prueba de configuración: código inválido mantenido debe fallar;
  la configuración no puede quedar verde por ignorar todas las fuentes.
- Acordar scripts oficiales usados también por CI. Conservar `lint:fix` como
  herramienta local explícita; el comando verificador no escribe fuentes.
- Eliminar las diferencias ad hoc de reglas del workflow cuando el perfil
  acordado esté implementado. Corregir sus comentarios desactualizados.

**GQ1:** alcance y reglas equivalentes local/CI; `smoke-web` identificado como
generado y conservado; las fuentes reales siguen siendo analizadas. El alcance
corregido puede seguir fallando hasta Q2/Q3: eso no constituye un cierre.

### Q2 — Corregir frontend por contratos de comportamiento

Orden de lotes:

1. `useFinancialDraft`: separar el estado necesario para renderizar de refs
   operativas. Preservar identidad de borrador, intención de transferencia,
   resultado incierto, generaciones y rechazo de respuestas antiguas.
2. Formularios y hooks de planificación: inicialización, carga, edición,
   guardado y cancelación. Evitar que una respuesta A sobrescriba una edición B.
3. `QuickActionsMenu` y efectos compartidos: apertura/cierre, foco y cleanup.
4. `RootLayout` y otros efectos: revisar estado derivado y suscripciones sin
   introducir microtasks o timers destinados únicamente a ocultar el warning.
5. CJS/globals e imports: resolver los siete `no-undef` y el `import/namespace`
   con el entorno y la API real del módulo instalado.

Reutilizar las suites de borradores, carreras, formularios, foco, sesión y
navegación. Añadir una regresión de comportamiento cuando se cambie lógica.
Formato y correcciones semánticas deben tener diffs separados.

**GQ2:** lint frontend mantenido con cero errores; sin nuevas advertencias en
el diff; Jest y tipos completos aprobados. Los 882 casos de la baseline deben
seguir pasando; cualquier sustitución exige trazabilidad de su contrato.

### Q3 — Corregir tipos y lint backend/arneses

- Producto primero: revisar `transferencias.service.ts` y los restantes archivos
  runtime. Tipar consultas y fronteras `unknown` con validación real; conservar
  aislamiento por usuario, transacciones, centavos e idempotencia.
- En `u5-browser.spec.ts`, `a8.spec.ts`, `u5.ts` y demás fixtures, introducir
  tipos de respuestas, filas, mensajes y dobles coherentes con los contratos.
  No sustituir errores por casts amplios, `any` o desactivaciones globales.
- Revisar `require-await`, métodos no enlazados y errores lanzados respetando
  cuándo una función devuelve, resuelve o rechaza. No quitar `async` en masa.
- Aplicar formato solamente a listas revisadas de archivos y en commits propios.
  No mezclar formateo amplio con cambios de autenticación o dinero.
- Mantener los casos negativos, de cancelación, rollback y propietarios del
  arnés; sus datos y errores sintéticos siguen siendo sintéticos.

**GQ3:** lint backend completo acordado con cero errores; sin nuevas advertencias
en el diff; tipos completos, build y Jest aprobados. Conservar los 1.089 casos
de la baseline y ejecutar las integraciones realmente afectadas.

### Q4 — Reproducir el entorno de CI y cerrar el job ML

- Preparar un checkout limpio y aislado del candidato en Linux Ubuntu 24.04,
  Node 22, PostgreSQL 16 y Chromium. Fijar la versión Node ensayada; la referencia
  inicial es 22.23.4. Registrar también npm, browser, servidor y clientes PG.
- Instalar backend y frontend con `npm ci`. No copiar dependencias desde Windows.
- El entorno local documentado no acredita Linux/PG16 ni Python 3.11 funcional.
  Comprobar disponibilidad de un entorno Linux desechable antes de iniciar este
  lote. Si falta, preparar los scripts desde Windows y dejar **LINUX_PENDIENTE**;
  acordar su provisión sin instalar servicios globales por suposición.
- Para ML, usar un venv limpio Python 3.11, fijar la versión efectiva y generar
  `ml-finance-tcc/requirements-ci.lock` con versiones directas/transitivas y
  hashes para el objetivo Linux. Conservar `requirements.txt` como declaración
  de compatibilidad; verificar una segunda instalación desde el lock antes de
  cambiar el job. No actualizar modelos, datos ni librerías como objetivo lateral.
- Ejecutar todos los checks de la matriz siguiente. Un fallo ML o Linux mantiene
  abierto el cierre general aunque frontend/backend ya estén aprobados.

**GQ4:** instalación desde cero, sin cambios en los locks, y todos los checks
aplicables aprobados en Linux/PG16. Un PASS Windows/PG18.6 sigue siendo evidencia
complementaria, no sustitución de este gate.

### Q5 — Actualizar CI y P4 para el candidato actual

- En `ci.yml`, usar los scripts de Q1 y completar los límites explícitos de los
  jobs. Conservar frontend, backend, E2E, acceso web y ML como obligatorios.
- Incorporar una selección Windows acotada para las pruebas reales de Windows
  Job; los checks portables también deben pasar en Linux. No omitir toda U6
  ni sumar los dos casos Windows como aprobados en Linux.
- En P4, resolver la dependencia de Playwright con los manifests/locks actuales
  y revisar la selección completa del driver/offline. No copiar el frontend
  congelado de octubre ni reutilizar sus hashes como candidato actual.
- Registrar qué casos son portables, Linux nativos o Windows nativos, sus
  conteos y las razones de no aplicabilidad. Si cambia el esquema de prueba,
  versionarlo y probar que rechaza omisiones, mezcla de plataformas y SHA ajeno.
- Preservar propietario de recursos, fail-fast, caps, captura privada, checksum,
  allowlist de exportación y readback. Cambios en schema/exporter requieren sus
  pruebas negativas antes de ejecutar P4.
- Mantener `contents: read`, sin credenciales de producción ni ampliaciones de
  permisos. Medir antes de congelar los presupuestos; un timeout no autoriza
  aumentar caps o reintentar automáticamente hasta obtener verde.

**GQ5:** YAML válido, selección y dependencias comprobadas, pruebas del arnés
aprobadas en su plataforma, y comandos locales iguales a los del workflow.
Todavía no equivale a una ejecución remota.

### Q6 — Preparar y ejecutar la validación remota

Preparar primero un candidato concreto y revisable:

- Commit exacto, manifiesto de paths, locks, comandos, jobs, caps y rollback.
- Comprobar en lectura el repositorio destino: visibilidad, default branch,
  protecciones, permisos y retención. La documentación P4 describe un remoto
  público en octubre; no se presupone que esas condiciones sigan vigentes.
- Revisar qué fuentes y logs se publicarían y excluir evidencia privada,
  `.env`, dumps, datos y capturas fuera de la política elegida.
- Distinguir el push/PR que activa la CI general de `workflow_dispatch` de P4.
  La autorización histórica P4 no cubre por sí sola el nuevo SHA ni los jobs
  incidentales. No desactivar protecciones o checks para evitar esta revisión.
- Si P4 aún no está en el default branch, preparar una incorporación mínima
  revisable antes del dispatch, sin hacer un merge automático por ese requisito.
- Solo con la publicación/ejecución exactas autorizadas, publicar el candidato,
  ejecutar los jobs acordados y registrar SHA, run ID, attempt y conclusiones.
  La política actual P4 exige `approved_commit` y `evidence_policy` exactos.
- Para P4, descargar por artifact ID y comprobar checksum, esquema, commit/run/
  attempt, conteos y cleanup. Conservar su política propia de custodia/expiración.

La implementación local y las evidencias revisables se completan antes de pedir
la aprobación final que corresponda. Este plan no solicita esa aprobación ahora.

**GQ6:** jobs obligatorios remotos y P4 acordado aprobados sobre el mismo candidato;
artefacto P4 descargado y verificado. Cancelación o limpieza inconclusa no es PASS.

### Q7 — Cierre y continuidad

- Publicar en el repositorio el informe de implementación con resultados reales,
  SHA, entorno, comandos, lint residual, ejecución por plataforma y límites.
- Separar estados: `LOCAL_PASS`, `LINUX_PG16_PASS`, `CI_REMOTE_PASS` y
  `P4_REMOTE_PASS`. No usar uno como sinónimo de los otros.
- Conservar los informes anteriores. Si cambia el candidato, volver a evaluar
  qué entradas/checks deben repetirse; no trasladar recibos a otro SHA.
- Comprobar repositorio limpio, recursos propios cerrados y preservación del
  historial/worktrees. Mantener `gc.auto=0` y `maintenance.auto=false` durante
  esta conservación. Revertir por commits, sin resetear trabajo ajeno.

**GQ7:** informe y evidencia remota verificables, cero errores de lint mantenido,
advertencias controladas y todos los checks obligatorios aprobados. La salida
local puede quedar implementada con remoto pendiente, pero no declararse cierre
general de CI. Esto tampoco certifica Android/iOS o producción.

## 5. Matriz mínima de verificación y presupuestos

| Job/superficie | Comprobaciones | Cap inicial propuesto |
| --- | --- | --- |
| Frontend | Instalación limpia, lint acordado, tipos, Jest completo, export web | 20 min |
| Backend | Instalación limpia, lint completo acordado, tipos completos/build, Jest, Nest build | 15 min |
| Backend E2E | Migraciones y selección completa mantenida, incluido registro atómico, con PG16 | 15 min, existente |
| Acceso web | Confinamiento y seis recorridos con Chromium/Nest/PG16 | 20 min, existente |
| ML | Instalación limpia desde lock Linux/Python 3.11 y pytest completo | 20 min |
| Windows ownership | Casos Windows Job y regresiones portables necesarias | 10 min |
| P4 manual | Tipos, U6 aplicable, negativo PG16, E2E, cleanup y readback | 45 min, existente |

Los caps nuevos son objetivos de preparación, no mediciones ni autorización de
ejecución. Los presupuestos internos P4 existentes se conservan hasta justificar
y revisar un cambio específico. Las instalaciones y subprocessos tendrán también
timeouts finitos dentro del cap del job. No usar producción para medirlos.

## 6. Cortes de commits y orden recomendado

| Corte | Contenido revisable | Gate |
| --- | --- | --- |
| Q0 | Inventario y baseline del candidato | GQ0 |
| Q1 | Perfiles/scripts de lint y sus pruebas | GQ1 |
| Q2a… | Un contrato frontend por lote, empezando por borradores | GQ2 progresivo |
| Q3a… | Runtime backend, tipos de arneses y formato en cortes separados | GQ3 progresivo |
| Q4 | Entorno reproducible, lock ML y ensayos Linux | GQ4 |
| Q5a/Q5b | CI general y adaptación P4 por separado | GQ5 |
| Q6 | Candidato autorizado y ejecución remota registrada | GQ6 |
| Q7 | Resultado de cierre y documentación | GQ7 |

Comenzaría por **Q0 y Q1**, y después el primer lote de `useFinancialDraft`.
Q2/Q3 no necesitan esperar a la publicación remota. Q6 depende de los gates
locales, del ensayo Linux y del candidato exacto ya preparado.

## 7. Referencias

- [Resultado base y límites actuales](../validacao/RESULTADOS_CIERRE_ACCESO_2026-11-11.json).
- [P4 histórico y política de evidencia](../validacao/SEGURANCA_SESSOES_ETAPA_2_P4_CI.md).
- [CI general](../../.github/workflows/ci.yml) y [P4 manual](../../.github/workflows/p4-proof.yml).
- ESLint documenta la diferencia entre ignores globales y por configuración:
  [Ignore Files](https://eslint.org/docs/latest/use/configure/ignore). La
  implementación usará la API admitida por la versión instalada, sin actualizar
  ESLint para aplicar este plan.
- GitHub exige que un workflow manual esté en el default branch:
  [Manually running a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
  Permisos, triggers y límites se revisan contra la
  [sintaxis oficial de workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).
