# Plan de preservación y consolidación del trabajo existente

Fecha: **10 de noviembre de 2026**, America/Sao_Paulo.

Estado: **IMPLEMENTADO EL 2026-11-11: CONSOLIDADO_CON_FALLOS_CONOCIDOS**. Consultar el [informe de ejecución y cierre](../validacao/CONSOLIDACION_2026-11-11.md), la [matriz definitiva](MATRIZ_CONSERVACION_2026-11-11.json) y el [procedimiento de recuperación](../operacao/RECUPERACION_LOCAL_2026-11-11.md). Las cifras y limitaciones siguientes describen la captura preliminar del plan; el informe concilia el inventario nativo y la validación posterior con Node 22.

Proyecto de referencia: `meu-sistema-financeiro`. Este plan implementa la primera prioridad de la [auditoría integral](../validacao/AUDITORIA_COMPLETA_2026-11-10.md).

## 1. Resultado que buscamos

Convertir el trabajo actual en una versión local recuperable y trazable: cada cambio tendrá un destino explícito, los cambios incorporados quedarán en commits comprensibles y la validación corresponderá al contenido de esos commits.

Se distinguen tres resultados para no confundir conservación con estabilidad:

| Estado | Condición |
| --- | --- |
| PRESERVADO | Se recuperan historia, índice, archivos pendientes y activos locales seleccionados desde un respaldo comprobado. |
| CONSOLIDADO | Cada cambio tiene decisión y trazabilidad; los cambios aceptados están en commits revisados. Los fallos conocidos pueden seguir documentados. |
| BASE_VERIFICADA | El candidato consolidado pasa los checks definidos para continuar el desarrollo. No equivale a autorización de producción. |

Las correcciones funcionales amplias de la auditoría —por ejemplo, rediseñar el alta o refactorizar planificación— tienen entregas propias. Este trabajo primero conserva y organiza el comportamiento existente. Cualquier ajuste necesario para cerrar la consolidación se registra en un commit separado.

## 2. Punto de partida comprobado

| Dato | Captura previa a crear este plan y su inventario |
| --- | --- |
| Rama | `codex/frontend-architecture-incremental` |
| HEAD | `43bcfac1817568d62ba7d1b0103468037cd4de6e` |
| Archivos del índice | 922 |
| Modificados respecto al índice | 159, normalizando CRLF cuando corresponde |
| Ausentes | 1: `frontend/src/modules/dashboard/components/DashboardShell.tsx` |
| Nuevos no ignorados dentro del inventario recorrido | 195 |
| Rutas de cambios inventariadas | **355** |
| Índice frente a HEAD | Coincide; no hay cambios staged en esta captura |
| Entradas en conflicto | Ninguna detectada |

El [inventario preliminar de 355 rutas](INVENTARIO_CONSOLIDACION_2026-11-10.json) contiene estado, área, blob del índice cuando existe, tamaño y SHA-256 de los bytes actuales. Cada fila está pendiente de revisión y asignación a un lote. **Este inventario no es una copia de seguridad.**

El inventario omite dependencias y otros directorios generados; aplica los `.gitignore` inspeccionados, pero no exclusiones globales de Git. La ejecución debe actualizarlo mediante Git y ampliar el censo de ignorados. Los dos documentos de planificación creados después de la captura también deben incorporarse al inventario de ejecución.

### Distribución preliminar, sin duplicar rutas

| Área | Rutas |
| --- | ---: |
| Frontend | 170 |
| Autenticación/seguridad backend | 39 |
| Otros cambios backend | 39 |
| Harness de sesiones | 33 |
| Documentación | 29 |
| Otros tests backend | 23 |
| Instrucciones y guías de agentes | 8 |
| Configuración/manifiestos | 7 |
| Migraciones | 5 |
| CI | 2 |
| **Total** | **355** |

Son áreas de inventario, no una propuesta de diez commits por carpeta. Los lotes funcionales cruzarán capas y podrán dividir un archivo por fragmentos.

### Particularidades que cambian el procedimiento

- `backendnest/.env` y `frontend/.env` son archivos locales ignorados. Su contenido no debe entrar en commits ni informes compartidos; su recuperación necesita un respaldo privado.
- Los modelos y el manifiesto ML están versionados; deben conservarse también como archivos binarios, no solamente mediante parches de texto.
- `.tmp` tiene **191 entradas de primer nivel** y contiene pruebas, snapshots y candidatos históricos. No se puede considerar desechable todo su contenido por estar ignorado.
- Hay **39 registros de worktrees**. Existen referencias antiguas a `C:\dev\...`; la limpieza de esos registros se hará después de preservar e identificar sus destinos.
- No se detectaron `objects/info/alternates`, `commondir`, repositorio shallow, `.gitmodules`, `.gitattributes` ni `index.lock` en esta inspección. Todos los modos del índice son `100644`. Hay que reconfirmarlo al ejecutar.
- Git, Node y npm no están disponibles como comandos normales; GitNexus tampoco está operativo. Esto no impide preparar una captura física, pero debe resolverse antes de la consolidación con Git.

## 3. Orden de ejecución y puertas de aceptación

### Fase 0 — Establecer una captura coherente

1. Resolver y comprobar la ruta absoluta del proyecto. Crear destinos nuevos, fuera del árbol del repositorio y dentro del workspace, con identificador único; comprobar espacio antes de copiar.
2. Acordar una ventana breve sin escrituras de editores, agentes, Git o herramientas que generen archivos. No cerrar aplicaciones del usuario ni detener servicios ajenos automáticamente.
3. Registrar HEAD, rama, refs, índice, conflictos, configuración relevante de finales de línea/filtros y situación de worktrees. Mantener privadas las configuraciones que puedan contener credenciales.
4. Obtener un inventario de fuentes y otro de archivos ignorados/locales, con tamaños y decisión provisional de preservación. Registrar también archivos ausentes: el snapshot debe reproducir su ausencia, no restaurarlos automáticamente desde HEAD.
5. Preparar un manifiesto de bytes antes y después de la captura. Si cambian las fuentes o la metadata Git durante la copia, marcar la tentativa como incompleta y abrir otra captura; no sobrescribir la anterior ni declararla válida.

**Entregable:** `estado-inicial.json` y manifiestos privados de captura, con las discrepancias explicadas frente al inventario preliminar.

**Puerta G0:** origen y destinos comprobados, espacio suficiente y fuentes estables. Los 355 cambios actuales son una referencia, no una cifra que deba imponerse a una captura posterior.

### Fase 1 — Preservar historia, trabajo pendiente y activos locales

Crear un paquete local privado, por ejemplo `New folder/_preservacion/<id>/`, con estos componentes:

| Componente | Contenido y tratamiento |
| --- | --- |
| Metadata Git original | Copia coherente de `.git`, incluyendo índice, objetos, refs, reflogs, configuración y metadata de worktrees. Conservarla antes de reparar rutas o reindexar. |
| Archivos de trabajo | Copia binaria de fuentes existentes, modificaciones y archivos nuevos. Conservar nombres, bytes y estructura; registrar ausencias. |
| Activos locales privados | `.env` y demás configuración local necesaria, con acceso restringido y cifrado cuando corresponda. Nunca incluir valores en el manifiesto compartible. |
| Evidencia histórica | Inventariar `.tmp`, `.atl`, logs y snapshots. Preservar lo único o no reproducible; no excluirlos por nombre de directorio. |
| Exclusiones justificadas | Dependencias/cachés/builds solamente cuando su regeneración esté comprobada y no contengan trabajo único. Registrar cada exclusión y su motivo. |
| Historia portable | Con Git operativo, añadir `git bundle create <destino> --all` y conservar su lista de refs. Es complementario a los archivos anteriores. |

Un bundle transporta objetos e historia alcanzable desde referencias; no sustituye el respaldo del índice, archivos pendientes y configuración local. Git también advierte del riesgo de copiar un repositorio mientras está siendo escrito. Por eso el paquete combina captura estable de archivos y herramientas Git. [Documentación de git-bundle](https://git-scm.com/docs/git-bundle).

Para copia se usarán rutas literales y destinos nuevos. No se usará sincronización con borrado del destino, ni se seguirán enlaces fuera del origen sin inventariarlos. Una copia en el mismo disco sirve para recuperación local; no constituye por sí sola recuperación ante pérdida del disco.

**Entregable:** paquete privado y manifiestos SHA-256; ninguna exclusión sin justificar.

**Puerta G1:** todos los archivos seleccionados coinciden byte a byte entre origen estable y copia; no hay errores de lectura pendientes. Un ZIP creado sin readback no satisface esta puerta.

### Fase 2 — Demostrar recuperación y habilitar herramientas

1. Restablecer Git y las herramientas necesarias con versiones identificadas, después de la captura inicial. Mantener estables las políticas de CRLF/LF y filtros del repositorio.
2. Verificar el bundle y restaurar su historia en un directorio nuevo. Comprobar HEAD, referencias esperadas y objetos con Git; interpretar objetos dangling como hallazgos a conservar, no como permiso para eliminarlos.
3. Restaurar el estado de archivos y el índice en una copia independiente. Comparar hashes, archivos nuevos y ausentes, y la separación entre staged/unstaged. Reubicar rutas absolutas únicamente en la copia de ensayo, conservando la metadata original respaldada.
4. Comprobar que esa recuperación funciona sin depender de los archivos de la carpeta original. No ejecutar automáticamente hooks o scripts de la copia sin inspeccionarlos.
5. Registrar el estado real con Git. Para consulta automatizada se usará `git --no-optional-locks status --porcelain=v2 -z --untracked-files=all`, capturando stdout como bytes. Revisar también ignorados y worktrees con comandos específicos.
6. Restablecer GitNexus y actualizar su índice después del respaldo; registrar cualquier cambio generado en `AGENTS.md`/`CLAUDE.md` como cambio de tooling separado.

`--no-optional-locks` evita la actualización opcional del índice que puede realizar `status`. La salida NUL permite tratar rutas con espacios y caracteres especiales. [Documentación de git-status](https://git-scm.com/docs/git-status).

**Entregable:** `restauracion-verificada.json`, con contadores, hashes, comandos, versiones y discrepancias resueltas.

**Puerta G2:** historia y trabajo pendiente recuperados con coincidencia demostrada. Ninguna reorganización de la fuente original comienza antes de esta prueba.

### Fase 3 — Clasificar cada cambio y resolver dependencias

Cada ruta o fragmento debe tener:

- propósito funcional;
- destino: `VERSIONAR`, `CONSERVAR_LOCAL_PRIVADO`, `ARCHIVAR_COMO_EVIDENCIA` o `REGENERABLE_COMPROBADO`;
- lote principal y dependencias;
- archivos/fragmentos compartidos con otros lotes;
- impacto esperado, pruebas y decisión sobre su incorporación.

Una ruta sin clasificación sigue preservada y pendiente. No se descarta trabajo por parecer antiguo. La eliminación de `DashboardShell.tsx` se revisará junto con sus reemplazos, imports y documentación; no se revertirá automáticamente.

Manifiesto y lockfile se revisan juntos. Migración y consumidores deben quedar trazables en la misma entrega. Los documentos de cada función acompañan su lote, y los resultados históricos conservan fecha y candidato.

**Entregable:** matriz completa de cambios y grafo de dependencias de lotes.

**Puerta G3:** cero rutas sin destino explícito; ningún archivo mezclado se incorpora completo a un lote sin revisar sus responsabilidades.

## 4. Propuesta de lotes funcionales

El orden definitivo depende del diff y la validación. Estos lotes identifican trabajos concretos; no se garantiza que cada uno termine siendo un solo commit.

| Lote | Contenido observado | Dependencias y aceptación |
| --- | --- | --- |
| L0 — Entorno y reglas de trabajo | Manifiestos/locks, scripts existentes, ignore y guías compartidas necesarias. Upgrade del cliente Expo/React Native. | Revisar compatibilidad con consumidores. No mezclar guías personales, cachés ni modificaciones globales del entorno. |
| L1 — Credenciales backend | Cambios de contraseña/reset, locks de credenciales, notificación/outbox y privacidad asociada. Migraciones **0014–0015**. | Contratos, repositorios, logs y pruebas pertenecientes a este recorrido. No atribuir envío real de correo a un adaptador de desarrollo. |
| L2 — Política de sesiones backend | Autoridad persistida, caducidad/inactividad, sesiones propias y presupuesto de reautenticación. Migraciones **0016–0017**. | Depende de L1 y de contratos compartidos de auth/logs. Verificar compatibilidad del cliente L3. |
| L3 — Sesión del cliente | Storage, API/refresh, autoridad, logout, RootLayout y consumidores; fixtures, navegación y pruebas de carreras. | Requiere los contratos de L2 y versiones de L0. Revisar hunks en pantallas de todos los dominios. |
| L4 — Contratos financieros y consultas | Límites monetarios/DTO, validación de formularios, paginación, filtros e historial. | Incluir pruebas y documentación afectadas. Conservar el desempate estable por ID; distinguir cambios ya presentes en HEAD del WIP. |
| L5 — Intención de transferencia | Clave/fingerprint, conflicto/repetición de creación, cliente y migración **0018**. | Depende de contratos de L4 y del manejo de sesión relevante. No declarar aplicada la migración por incorporarla al repo. |
| L6 — Presentación y formularios | AppShell, componentes compartidos, feedback de campos, hooks de interacción y migración de pantallas. | Separar hunks de sesión/finanzas o agruparlos si el corte resulta artificial. Revisar junto con la eliminación del shell anterior. |
| L7 — Infraestructura de pruebas | Harness E2E y de sesiones, runners, confinamiento, pruebas puras y navegador. | Cada helper imprescindible para otro lote debe acompañarlo; evitar commits que dependan de helpers aún sin versionar. |
| L8 — CI y prueba P4 | Workflow general, workflow P4 y adaptadores de prueba correspondientes. | Depende de scripts/manifiestos/harness incluidos. Versionar un workflow no prueba su ejecución remota. Revisar triggers antes de cualquier futura publicación. |
| L9 — Estado actual y documentación | Auditoría, requisitos, runbooks y cierre de la consolidación. | Documentación específica junto a L1–L8; aquí se concilia el estado global y lo pendiente. |

Archivos especialmente compartidos: `app.module.ts`, `auth.service.ts`, `logs.service.ts`, `swagger.yaml`, ambos `package.json`/lockfiles, `RootLayout.tsx`, el cliente API, storage, fixtures y `docs/README.md`. Tendrán una secuencia de hunks explícita o una entrega conjunta razonada.

Si dos lotes no pueden separarse manteniendo un contrato coherente, se agrupan. La cantidad de commits es una consecuencia de las dependencias; no un objetivo por sí misma.

## 5. Crear una historia revisable

1. Tras G2 y G3, crear una rama local nueva, por ejemplo `codex/consolidacion-2026-11-10`, desde el HEAD identificado. Rechazar colisiones de nombre; no forzar una rama existente.
2. Mantener la primera carpeta como proyecto de trabajo. La rama original permanece como referencia y el respaldo conserva el estado previo.
3. Preparar cada commit mediante listas explícitas de rutas o hunks revisados. Usar `git --literal-pathspecs add --pathspec-from-file=<lista> --pathspec-file-nul` para listas de archivos, y staging parcial cuando sea necesario. Evitar staging global de todo el repositorio.
4. Revisar diff staged, eliminaciones, binarios, archivos sensibles y dependencias. Incluir únicamente el lote y los helpers indispensables.
5. Ejecutar los controles del proyecto: [AGENTS.md](../../AGENTS.md) exige **"MUST run detect_changes() before committing"** y análisis de impacto antes de editar símbolos. Restaurar esas capacidades antes de los commits; su indisponibilidad no impide completar preservación e inventario.
6. Incorporar el lote y registrar SHA, propósito, rutas/hunks, checks y pendientes. Un commit documental no requiere repetir todas las pruebas funcionales si no cambia comportamiento.
7. Validar el contenido del SHA en una copia temporal aislada. El directorio original aún tendrá WIP restante; ejecutar pruebas allí no valida por sí solo el commit recién creado.

Git permite staging parcial y listas de rutas; esas capacidades se usarán para preservar límites revisables. [Documentación de git-add](https://git-scm.com/docs/git-add).

Las copias de recuperación/verificación tendrán nombres y responsables temporales. No se convertirán en otra carpeta permanente de frontend. Cualquier creación y retirada de worktrees se hará con su registro de Git y después de comprobar su contenido; los 39 registros preexistentes se conservarán hasta resolver su inventario. [Documentación de git-worktree](https://git-scm.com/docs/git-worktree).

## 6. Validación y tratamiento de fallos conocidos

Antes de comparar lotes, reproducir el snapshot inicial bajo el runtime elegido para consolidación —preferentemente el mismo Node 22 de CI— y registrar sus resultados. Los resultados anteriores bajo Node 24 son evidencia histórica para esa comparación, no una baseline automáticamente equivalente.

| Tipo de lote | Validación mínima propuesta |
| --- | --- |
| Manifiestos/locks | Instalación desde lock en copia limpia y checks de tipos/compilación afectados. |
| Credenciales/sesiones | Pruebas focalizadas, contratos y checks puros de harness; DB/navegador descartables cuando estén preparados. |
| Finanzas/transferencias | Pruebas de importes, ordenación, intención y conflictos; migraciones/E2E en DB descartable para afirmar integración. |
| Presentación/formularios | Tipos, pruebas de componentes/validadores y export web; native permanece pendiente sin ejecución propia. |
| CI/harness | Sintaxis, comandos/fixtures presentes y tests puros; resultado remoto separado. |
| Documentación | Enlaces, cifras y correspondencia con el lote/candidato. |

La ejecución anterior registró **1 fallo backend y 35 frontend**, además de lint fallando en ambas capas. Comparar identidades de pruebas, no solamente contadores: cambiar tres fallos por otros tres no mantiene la misma regresión.

La incorporación puede cerrar como `CONSOLIDADO_CON_FALLOS_CONOCIDOS` si preserva el trabajo y registra exactamente lo pendiente. Para declararla `BASE_VERIFICADA` se requieren los checks acordados en verde. Los ajustes de mocks/expectativas o del comportamiento necesarios para conseguirlo serán commits posteriores identificados; no se desactivarán assertions o reglas para ocultar fallos.

## 7. Cierre y comprobación de conservación

La consolidación se cierra cuando:

- todos los cambios del inventario inicial tienen destino, lote/commit o custodia local;
- el candidato final contiene las fuentes aceptadas y sus migraciones/contratos;
- la comparación con el snapshot inicial explica **cada** diferencia adicional, incluyendo ajustes y documentación creados durante el trabajo;
- los hashes de los respaldos y su restauración siguen verificables;
- no quedan archivos pendientes desconocidos; los locales privados/ignorados siguen identificados y conservados;
- el estado final de Git y las pruebas corresponde al SHA señalado, con sus fallos o límites explícitos;
- se puede continuar desde la primera carpeta y existe un procedimiento de vuelta comprobado.

**Entregables finales:** informe de recuperación, matriz de conservación, rama local de consolidación, secuencia de commits, resultados por candidato y backlog de estabilización.

La integración con `main`, publicación y ejecución remota de workflows son entregas posteriores. Deben partir de una comparación actual de ramas y del candidato exacto, sin incorporar todo el WIP incidentalmente.

## 8. Reversión y condiciones de parada

Ante una discrepancia, conservar los artefactos y anotar el último punto válido. La primera opción de recuperación es restaurar en un directorio nuevo y verificarlo antes de sustituir cualquier contenido original. Los commits de consolidación quedan identificados para una reversión por dependencias cuando corresponda.

Se detiene el avance dependiente si hay cambios concurrentes, archivos ilegibles, hashes distintos, espacio insuficiente, objetos Git ausentes, secretos en el staging, conflictos sin comprender o dependencias que hacen incoherente un lote. El inventario y demás trabajo no afectado puede continuar.

No forman parte del procedimiento un reset destructivo, limpieza global, renormalización masiva, rebase de la rama de trabajo ni poda de worktrees para conseguir un estado visualmente limpio. La limpieza física de respaldos, evidencia o la segunda carpeta requiere su propia decisión después de la recuperación verificada.

## 9. Primera entrega de implementación

**Comenzar por Fases 0–2: obtener una captura estable, un paquete privado y una restauración comprobada.** Esa entrega protege el trabajo antes de que la clasificación o la creación de commits puedan introducir errores. Después se confirma la matriz de lotes y comienza la consolidación local.
