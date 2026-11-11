# Preservación y consolidación del sistema

Fecha de ejecución y cierre: **11 de noviembre de 2026**, America/Sao_Paulo.

Resultado: **CONSOLIDADO_CON_FALLOS_CONOCIDOS**. El trabajo pendiente quedó preservado y distribuido en commits locales. El sistema todavía no cumple `BASE_VERIFICADA`: Jest y lint conservan fallos. Este cierre no acredita despliegue, pruebas nativas ni integración con PostgreSQL.

## Proyecto y candidato

- Proyecto de trabajo: la primera carpeta, `meu-sistema-financeiro`.
- Rama local: `codex/consolidacion-2026-11-11`.
- Punto original: `43bcfac1817568d62ba7d1b0103468037cd4de6e`, conservado en `codex/frontend-architecture-incremental`.
- Candidato de código validado: `f8e2168df2f4135b1b11dddc7da4585d7ae048d8`. El commit de cierre posterior incorpora documentación, inventarios y exclusiones de evidencia.
- La carpeta `meu-sistema-financeiro-frontend` y los registros de worktrees preexistentes se conservaron. Una incidencia de metadata detectada al cerrar se recuperó desde el snapshot, como se explica más abajo. No se publicó la rama ni se ejecutaron workflows remotos.

## Recuperación demostrada

El paquete privado está fuera del repositorio, en `_preservacion/20261110-2bfda3599f1c`, dentro del workspace. Su ACL restringe el acceso al propietario, la cuenta de ejecución, SYSTEM y administradores.

| Evidencia | Resultado |
| --- | --- |
| Captura física completa | 587.903 archivos, 87.180 directorios, 8.636.871.173 bytes; sin exclusiones ni enlaces |
| Lectura de comprobación | SHA-256 de cada archivo de origen y snapshot coincide con el manifiesto; cero fallos y origen estable durante la captura |
| Historia inicial portable | `history.bundle`, 12.885.396 bytes, 183 referencias, verificación correcta |
| Restauración operativa independiente | 6.405 archivos y 65.795.518 bytes recuperados únicamente desde el snapshot |
| Estado recuperado | Índice y salida nativa de Git iguales a la captura inicial; ausencia de `DashboardShell.tsx` conservada |
| Integridad Git | `git fsck --full` correcto en la restauración y en la prueba independiente del bundle |
| Custodia completa | Cada uno de los 587.903 archivos tiene destino registrado en `custodia-todos-archivos.jsonl` privado |

El snapshot conserva también `.git` completo, reflogs, configuración, activos ML binarios, los `.env`, dependencias, cachés, `.tmp`, `.atl` e historia de navegación. Ningún contenido ignorado fue eliminado ni declarado regenerable sin comprobarlo. La restauración operativa selecciona fuentes y metadata; los demás archivos siguen disponibles en el snapshot completo.

Una copia en el mismo disco permite recuperación local; la pérdida del disco requiere además una copia externa bajo custodia del propietario. El [procedimiento de recuperación](../operacao/RECUPERACION_LOCAL_2026-11-11.md) indica cómo utilizar los artefactos sin sobrescribir el proyecto.

## Inventario y decisiones

Git nativo encontró **752 rutas pendientes**: 167 rastreadas y 585 nuevas. De ellas, 394 pertenecían al snapshot histórico `navigation-delivery-piho88bu/`. Quedaron 358 rutas activas. Se añadieron a la revisión seis guías que Git excluye globalmente.

| Destino de las 758 rutas revisadas | Rutas |
| --- | ---: |
| Versionar el trabajo activo | 351 |
| Archivar snapshot histórico, conservando todos sus bytes | 394 |
| Conservar bytes locales con diferencia únicamente CRLF/LF | 7 |
| Conservar guías locales excluidas globalmente | 6 |
| Sin clasificar | **0** |

La diferencia con el inventario preliminar de 355 rutas se explica por 394 archivos históricos, siete diferencias únicamente de finales de línea, dos documentos de planificación posteriores y seis guías ignoradas globalmente. La [matriz definitiva](../planejamento/MATRIZ_CONSERVACION_2026-11-11.json) identifica destino, propósito y commit de cada ruta. Los cuatro documentos de cierre añadidos durante la ejecución se identifican aparte.

Las siete diferencias CRLF/LF tenían el mismo texto canónico que HEAD. Se actualizaron sus entradas del índice sin cambiar los bytes físicos ni introducir un commit de formato. La eliminación de `DashboardShell.tsx` acompaña a `AppShell`; no quedan imports del componente eliminado en las fuentes activas.

## Commits y dependencias

| Lote | Commit | Contenido |
| --- | --- | --- |
| B1 | `232ee1191935e538bfcd1bf17ab97d615ce00989` | Credenciales, outbox, sesiones, reautenticación, migraciones 0014–0017 y harness necesario |
| B2 | `2200af33abf50ffce531f3c1d3579781db34d893` | Límites monetarios, historial estable, intención de transferencia y migración 0018; runner de migraciones |
| B3 | `1251529930b198b55b5a4d3b7b47ec1a990b66e1` | Contratos de sesión del cliente, consumidores, shell, formularios, borradores y prototipo existente |
| B4 | `2d85f1dcb84d55722464d37cd753cb2f025fef4e` | CI confinada y workflow manual P4 |
| B6 | `f8e2168df2f4135b1b11dddc7da4585d7ae048d8` | Dependencia Skia ya utilizada, ahora declarada con versión exacta y lockfile |
| B5 | Este cierre documental | Auditorías, arquitectura, runbooks, plan ejecutado, matriz y resultados |

La revisión del primer candidato detectó una dependencia real: el helper de concurrencia cambió su firma a `PendingRequest`; sus tres consumidores existentes se incorporaron juntos en B1. El runner de migraciones y sus tests requieren el catálogo completo hasta 0018, por lo que se incorporaron en B2. `backendnest/package.json` se preparó por fragmentos para acompañar cada consumidor, manteniendo manifiesto y lockfile coherentes.

En el cliente se agruparon sesión, formularios y presentación porque las mismas pantallas consumen sus nuevos contratos. La prueba limpia detectó que el prototipo importaba `@shopify/react-native-skia`, instalado localmente como **2.6.2** pero ausente del manifiesto. B6 declara exactamente esa versión; no modifica funciones del producto.

## Herramientas y alcance de GitNexus

Se habilitaron herramientas portables dentro del workspace, sin instalación global: Git 2.56.1.windows.1, Node 22.23.4 y npm 10.9.9. La identidad de commits se configuró únicamente en el repositorio, con autorización del propietario.

GitNexus 1.6.12 produjo un índice estructural de 846 archivos, 10.939 nodos, 28.501 relaciones y 780 procesos. El análisis inicial del árbol completo falló con un error nativo; la ejecución reproducible utilizó una réplica de las fuentes y su orquestador publicado, con almacenamiento externo y sin regenerar `AGENTS.md` ni `CLAUDE.md`.

Antes de cada commit se ejecutó `detect_changes` sobre la réplica y se comprobó que su árbol staged fuera idéntico al original. B1 y B3 resultaron críticos por su alcance compartido; B2, alto. Los flujos afectados corresponden a los contratos preservados. La búsqueda FTS quedó deshabilitada: `query` informó esa limitación y se utilizó contexto estructural y revisión de diffs. No se editaron símbolos del producto durante la consolidación.

## Validación ligada al contenido

Las comprobaciones se ejecutaron en copias aisladas. El árbol de B1 se exportó desde el índice: tipos correctos y **351/351** tests focalizados. Los 446 archivos backend coinciden byte a byte con la restauración validada bajo Node 22. El cliente se comparó con la copia de pruebas antes de registrar su commit. El cambio de dependencia se comprobó con instalación limpia, tipos y exportación web.

| Comprobación con Node 22.23.4 | Resultado |
| --- | --- |
| Instalación backend desde lock | Correcta, 780 paquetes |
| Instalación frontend inicial desde lock | Correcta tras repetir el primer intento interrumpido por red |
| Instalación limpia del lockfile frontend final | Correcta, `npm ci --offline`, 1.101 paquetes |
| Tipos completos backend y frontend | Correctos |
| Build Nest y exportación web Expo | Correctos |
| Jest backend | 1.079 aprobados, 1 fallo, 100 suites |
| Jest frontend final | 837 aprobados, 36 fallos, 95 suites |
| Comparación frontend antes/después | Mismas 36 identidades de fallo; cero introducidas y cero desaparecidas |
| Harness local, sin DB ni navegador real | 98 aprobados, cero fallos |
| Lint backend, incluyendo tests | 1.555 errores y 140 advertencias |
| Lint frontend, excluyendo el bundle histórico `smoke-web` | 70 errores y 78 advertencias |

El lint recursivo de todo el frontend incluyó además el bundle histórico versionado `smoke-web`: total 3.784 errores y 2.564 advertencias. Se conservan ambos alcances; no se modificaron reglas ni fuentes para esconder resultados. La auditoría anterior con Node 24 había contado 35 fallos frontend; la nueva baseline limpia con Node 22 registró 36, y la comparación de esta ejecución utiliza las identidades exactas de esos 36.

El fallo backend es la expectativa de ordenación de `TransacaoRepository`, que no contempla el desempate por ID. Los fallos frontend incluyen mocks antiguos de navegación y sesión, expectativas de validadores y el caso del perfil del formulario de gasto. Los nombres completos están en [resultados de validación](RESULTADOS_CONSOLIDACION_2026-11-11.json).

Las migraciones se versionaron; no se aplicaron a ninguna base. PostgreSQL real, pruebas de navegador/E2E, Android/iOS, ML y ejecución remota permanecen pendientes. El entorno Python existente sigue sin un intérprete funcional. No se desactivaron assertions, tests ni reglas de lint.

## Conservación y continuación

La ejecución conserva los bytes del código existente y los activos locales. Los cambios adicionales se limitan a las exclusiones de snapshots en `.gitignore`, los dos manifiestos del frontend para Skia, la actualización del estado del plan, el enlace en `docs/README.md` y los cuatro documentos de cierre. La configuración Git registra la rama, los commits y la identidad aprobada. Las pruebas y herramientas generaron sus archivos fuera del proyecto de trabajo.

La comparación de referencias entre bundles detectó la desaparición de un registro antiguo de worktree y el acortamiento de 38 reflogs durante las operaciones Git. El mantenimiento automático es la causa probable; no se trazó su ejecución directamente. Se recuperaron el registro y los reflogs desde el snapshot, después de comprobar que no había nuevas entradas que pudieran perderse. Se conservaron también sus estados intermedios como evidencia. Los 39 registros y todos sus archivos de metadata volvieron a coincidir byte a byte con la captura. Se deshabilitaron `gc.auto` y `maintenance.auto` únicamente en este repositorio para evitar otra limpieza automática; la revisión manual de registros antiguos sigue pendiente.

El paquete privado contiene los manifiestos originales, la matriz detallada, listas de staging, árboles revisados, resultados completos, evidencias de GitNexus y recibos de cada commit. El cierre añade la comprobación final de conservación, estado Git y bundle consolidado. Las carpetas `_validacion-*` son copias de ensayo; la primera carpeta sigue siendo el único proyecto de desarrollo.

El siguiente trabajo es estabilizar las pruebas y lint por sus causas, comprobar migraciones y concurrencia en PostgreSQL descartable y validar sesiones en navegador. Después se puede evaluar la integración con `main` y una copia externa del respaldo. La auditoría funcional y arquitectónica conserva su backlog propio.
