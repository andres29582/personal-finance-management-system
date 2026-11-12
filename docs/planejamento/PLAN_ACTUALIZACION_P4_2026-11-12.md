# Plan de implementación: actualizar y cerrar P4

Fecha: **2026-11-12**, America/Sao_Paulo.
Estado: **IMPLEMENTACIÓN LOCAL VERIFICADA; aceptación remota abierta**.
P4.1–P4.4 completados en el alcance local; P4.5 preparado para revisión de
publicación y ejecución; P4.6 pendiente de artefacto remoto.
Código: `ef06512ac226bc97109050489f6c36456151dd19`.
[Resultados y límites](../validacao/IMPLEMENTACION_P4_2026-11-12.md).
Base comprobada: `ec97588cf3c234dd8cede526dab4359e766d9b0c`, rama
`codex/calidad-ci-2026-11-11`. Último commit de código/CI:
`146cba8573130f19905b669cf52a7c8d41185675`.

La secuencia que sigue conserva el plan aprobado; su ejecución local y sus
resultados se documentan en el seguimiento. No acredita Linux/PostgreSQL 16. Continúa el
[P4 histórico](../validacao/SEGURANCA_SESSOES_ETAPA_2_P4_CI.md) y el
[cierre local de calidad](../validacao/IMPLEMENTACION_CALIDAD_CI_2026-11-11.md).

## 1. Objetivo y situación comprobada

Preparar un candidato reproducible que satisfaga el contrato estricto de P4,
actualizar su documentación y, tras la revisión del candidato concreto,
obtener y verificar evidencia remota del commit exacto.

| Área | Estado de partida | Trabajo pendiente |
| --- | --- | --- |
| Workflow P4 | Node 22.23.4 e instalación de ambos paquetes actualizados | Verificar cadena completa en Ubuntu 24.04/PG16 |
| Selección U6 | P4 llama directamente a `u6.spec.cjs`; U6 offline vuelve a llamarlo | Separar pruebas portables y propiedad de procesos Windows en ambas rutas |
| E2E | 191 aprobadas y una omitida; una suite omitida | Activar la prueba de unicidad SQL con fixtures confinadas |
| Contrato P4 | Rechaza cualquier test o suite pendiente | Conservar esta exigencia; el reporte actual es rechazado |
| Documentación | P4 conserva candidato/manifiestos de octubre | Identificar candidato nuevo sin reutilizar evidencia histórica como actual |
| Remoto | Consulta de auditoría: cero runs para ambos SHA anteriores; P4 ausente de `main` remoto | Publicación revisada, disponibilidad en default branch, ejecución y readback |

Los dos bloqueos están demostrados por la cadena de llamadas y el validador
real. La comprobación de callbacks con plataforma Linux simulada no equivale
a ejecutar Linux. La CI general ya separa plataformas, pero P4 no utiliza
automáticamente esa selección.

## 2. Secuencia de implementación

### P4.1 — Conservar la base y precisar el alcance

- Verificar HEAD, estado de trabajo y cambios concurrentes antes de comenzar;
  crear una rama de continuación desde la base comprobada.
- Registrar manifiesto inicial y referencias de evidencia. Mantener intactos
  los otros proyectos, worktrees, snapshots y pruebas anteriores.
- Actualizar/consultar GitNexus y ejecutar impacto antes de modificar símbolos;
  contrastar callers reales y comunicar riesgo HIGH/CRITICAL antes de editar.
- Confirmar los comandos efectivos de `p4-ci.cjs`, `u6.cjs`, `u6.spec.cjs`,
  `harness-offline.cjs` y ambos workflows. Revisar caps y contrato de evidencia.

Aceptación: base identificada y mapa de invocaciones que incluya tanto
`u6-test` como el `u6-unit` ejecutado dentro de `u6-check`.

### P4.2 — Corregir la selección por plataforma

- Establecer una selección explícita y compartida para pruebas U6 portables;
  utilizarla en las dos rutas de P4. Evitar duplicar listas divergentes.
- Conservar las pruebas reales de Windows Job en la ejecución Windows y el
  job correspondiente de CI general. No eliminar sus assertions ni alterar
  la protección/metadata del script original `u6-job.ps1`.
- Registrar Windows como no aplicable en Linux, sin contabilizarlo como PASS.
  Mantener las seis comprobaciones P4, sus límites y el fallo inmediato.
- Añadir regresiones que comprueben la selección de ambas rutas, que una
  prueba portable fallida impida PASS y que Windows siga ejecutando sus casos.
  Revisar si el contrato cerrado de evidencia necesita representar la
  aplicabilidad; cualquier cambio exige actualizar productor, consumidor y
  pruebas de rechazo, sin aceptar evidencia antigua de forma ambigua.

Aceptación: ninguna ruta Linux lanza pruebas exclusivas de Windows; no se pierde
cobertura portable; las pruebas Windows conservan una ejecución explícita.

### P4.3 — Activar la prueba de unicidad SQL

Archivo principal: `backendnest/test/transfer-intent-concurrency.e2e-spec.ts`.

- Sustituir `describe.skip` y las variables externas `RNF_TEST_*` por el ciclo
  estándar de E2E: base desechable migrada, lease, usuario y cuentas propios.
- Reutilizar los guards de aislamiento existentes. No aceptar una base por
  contener solamente la palabra `test` en su URL.
- Mantener dos transacciones/conexiones independientes y coordinación acotada
  que pruebe la competencia real por la misma clave de idempotencia.
- Comprobar un único ganador, ausencia de segunda inserción y estado final
  consistente; liberar conexiones y fixtures también ante error/timeout.
- Ejecutar primero el caso focalizado y después la suite E2E completa en una
  base nueva. Pasar el JSON real al `e2eSummary()` de P4.
- Conservar pruebas negativas que rechacen tests/suites omitidos, failures,
  interrupción o resultados incompletos. Mantener la exigencia de cero skips.

Aceptación: cero tests y suites omitidos/fallidos; el reporte real completo es
aceptado por P4. Registrar las cantidades medidas, sin fijarlas artificialmente
en 192 si se añaden regresiones.

### P4.4 — Validación local y candidato documentado

- Ejecutar pruebas puras de P4, U6 offline, selección portable y pruebas Windows
  pertinentes; lint, contratos, tipos completos/build y validación de workflows.
- Ejecutar las regresiones afectadas y la E2E completa. Ampliar a otros checks
  solo cuando el impacto o un fallo lo justifique.
- Mantener caps, captura privada, limpieza verificada y allowlist de artefactos.
  Si un límite falla, investigar y registrar la causa; no aumentarlo por defecto.
- Actualizar el documento P4, el seguimiento de calidad y su JSON de resultados:
  bloqueos resueltos, comandos, entorno, resultados, límites y pendiente remoto.
- Generar un manifiesto actual con hashes e inventario de fuentes y revisar el
  contenido publicable. Conservar octubre como evidencia histórica fechada.
- Ejecutar `detect_changes` antes de cada commit y revisión comparada con `main`;
  distinguir cambios de esta entrega de la consolidación previa y distinguir
  `main` local del remoto. Crear commits acotados por corrección y documentación.
- Tras el commit final, comprobar árbol limpio y fijar el SHA candidato. Guardar
  su identidad en un recibo externo al árbol para evitar autorreferencia del SHA;
  cualquier cambio posterior obliga a recalcular candidato/manifiesto.

Aceptación: candidato local verificable, sin ninguno de los dos bloqueos,
con resultados atribuibles al árbol correcto. PG18 local no acredita PG16.

### P4.5 — Preparar y ejecutar CI del candidato exacto

No instalar WSL/Docker: Linux/PostgreSQL 16 se validarán en CI, según la decisión
del usuario. Antes de la publicación, preparar para revisión:

- Rama, SHA completo, diff publicable y manifiesto final; comprobar de nuevo
  estado remoto y ausencia de secretos/datos privados en el alcance publicado.
- Propuesta concreta para incorporar el workflow al default branch, requisito
  de `workflow_dispatch`, y seleccionar la referencia con el candidato aprobado.
- CI automática que activaría el push/PR, presupuesto y límites; P4 conserva
  su job de 45 minutos y permisos mínimos.
- Inputs `approved_commit=<SHA de 40 caracteres>` y
  `evidence_policy=P4_PUBLIC_7D_OWNER_CUSTODY`; artefacto de siete días, custodia
  del propietario y verificación de la retención real de logs. La referencia
  histórica a 90 días no demuestra la configuración actual del repositorio.

La política histórica de evidencia no autoriza por sí sola publicar este nuevo
candidato, incorporar cambios en `main` o disparar el run. Solicitar esa decisión
solo cuando el paquete anterior sea concreto y revisable; no antes del trabajo
local. No despachar una referencia cuyo SHA difiera del aprobado.

Aceptación: CI general obligatoria verde, incluidos Linux, Windows y ML, y P4
completado en Ubuntu/PG16 para el SHA aprobado, sin omisiones encubiertas.

### P4.6 — Descargar, verificar y cerrar

- Descargar el artefacto del run/attempt correcto antes de su expiración.
- Validar de forma independiente checksum, schema cerrado, archivos permitidos,
  commit, run, attempt, inventario y resultados. Rechazar discrepancias.
- Verificar evidencia de limpieza y ausencia de exportaciones privadas.
- Registrar URL del run, identidad del artefacto, hashes, fecha y custodia.
- Declarar P4 cerrado únicamente si todas las comprobaciones son satisfactorias.
  Un run verde sin readback no cierra P4; tampoco acredita despliegue a producción
  ni cierra automáticamente otros requisitos de U6/etapa 2.

## 3. Entregas y tratamiento de fallos

Orden: **P4.1 → P4.2 → P4.3 → P4.4 → P4.5 → P4.6**.
Entregas sugeridas: corrección de plataforma; E2E de unicidad; documentación y
candidato; recibo de aceptación remota después de ejecutarla.

Si falla una etapa, conservar logs privados y diagnóstico, corregir la causa y
repetir los checks afectados. Un cambio de código genera un nuevo candidato y
requiere nueva evidencia; no reutilizar PASS de otro SHA como aceptación actual.
La reversión se hará mediante cambios/commits acotados, preservando trabajo ajeno,
sin reset destructivo, limpieza de worktrees ni eliminación de evidencia.

El usuario solicitó implementar el plan. Los dos bloqueos locales están
corregidos y verificados. El siguiente paso es revisar el candidato y el
bootstrap propuesto antes de publicar y obtener la evidencia remota.
