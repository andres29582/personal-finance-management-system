# P4: correcciones locales verificadas; aceptación remota pendiente

**Actualización 2026-11-13:** publicación, bootstrap y CI general completados;
dos intentos P4 fallidos sin artefactos; último fallo localizado en `pg16-negative`.
El resultado local que sigue se conserva como
histórico. [Seguimiento remoto vigente](PUBLICACION_P4_2026-11-13.md).

Fecha: **2026-11-12**, America/Sao_Paulo.
Estado: **LOCAL_PASS_BOUNDED / REMOTE_NOT_TESTED / OPEN**.
U6/etapa 2 continúa abierto; producción continúa bloqueada.

Base: `ec97588cf3c234dd8cede526dab4359e766d9b0c`.
Commit de código: **`ef06512ac226bc97109050489f6c36456151dd19`**.
Rama: `codex/actualizacion-p4-2026-11-12`.
El SHA final, incluido este cierre documental, y su manifiesto se generan después
del commit en el recibo externo de custodia; así se evita un SHA autorreferente.

## Correcciones realizadas

1. Los dos casos nativos de Windows Job se trasladaron, conservando exactamente
   su cuerpo, de `u6-owned.spec.cjs` a `u6-windows.spec.cjs`. El primero conserva
   el contrato portable del entorno. Tanto el `u6-test` directo de P4 como el
   `u6-unit` interno de U6 cargan ahora la misma entrada portable `u6.spec.cjs`.
   `test:harness:windows` ejecuta explícitamente los dos casos Windows; el arnés
   portable comunica su no aplicabilidad y ya no necesita filtros por nombre.
2. La prueba de unicidad SQL usa el runner E2E con lease, confirmación de destino,
   owner confinado y migraciones estándar, además de usuario/cuentas propios.
   Confirma dos conexiones distintas y el bloqueo real del segundo INSERT por
   el primero antes de liberarlo. Comprueba un ganador, cero filas retornadas
   al perdedor y un único registro final. Los timeouts SQL son finitos; los
   errores de ejecución y limpieza se conservan. Se retiran las variables
   `RNF_TEST_*`, el guard débil de URL y `describe.skip`.
3. Una regresión registra la suite U6 con plataforma Linux simulada y comprueba
   que no registra casos Windows, mientras el archivo exclusivo conserva dos.
   Las pruebas del parser P4 también rechazan suites pendientes y fallos.
   El validador estricto de cero skips conserva su implementación.

No se modificaron módulos de producción, workflows ni sus límites en esta
continuación. No se cambió el schema público P4: su ámbito continúa siendo
`P4_PG16_ONLY`, sin acreditar Windows ni cerrar U6/etapa 2.

## Resultados de esta ejecución

Windows, Node **22.23.4**, PostgreSQL portátil **18.6**, clúster desechable propio.
Los archivos de código comprobados coinciden con el commit indicado.

| Comprobación | Resultado |
| --- | --- |
| P4 puro (`p4-proof.spec.cjs`) | 18/18, cero skips |
| Entrada U6 usada por P4 (`u6.spec.cjs`) | 37/37, cero skips |
| Arneses portables completos | 124/124, cero skips; incluye casos anteriores, no sumar como cobertura única |
| Windows Job real | 2/2, ejecutados en la réplica con los mismos bytes |
| U6 `OFFLINE_CHECKS` y checksum/readback | Seis checks PASS, dentro de sus caps |
| Unicidad SQL focalizada | 1/1; lectura posterior: cero usuarios de la fixture y cero transferencias |
| E2E completo con base nueva | **192/192 en 38 suites; cero fallos/omitidos** |
| `e2eSummary()` real sobre ese JSON | Aceptado: 38 suites, 192 tests/assertion results |
| Lint backend completo | 425 archivos, cero errores y 22 advertencias |
| Contrato de lint backend | PASS; severidades bloqueantes conservadas |
| Tipos completos y tipos de build | PASS mediante U6; build types también separado |
| Nest build | PASS |
| actionlint 1.7.12 | Ambos workflows válidos; shellcheck/pyflakes no ejecutados |

La ejecución local no repite frontend/browser/ML: sus fuentes no cambiaron aquí.
Sus resultados anteriores siguen vinculados al candidato de calidad anterior;
los jobs remotos obligatorios siguen pendientes para el candidato nuevo.

La primera invocación U6 dentro de la sandbox falló cerrada antes de producir
evidencia. La ejecución con acceso normal completó los seis checks. También se
conservaron los diagnósticos iniciales de tipos/lint corregidos; no son PASS.
La comprobación de registro Linux es simulada y no demuestra Linux nativo.

El script original de contención y su `Zone.Identifier` mantienen los SHA256
`8ae72f66e29c41591cfaccc79fb474ea7060629151eeacce494337cc7078cb83` y
`eacd09517ce90d34ba562171d15ac40d302f0e691b439f91be1b6406e25f5913`.
El clúster local terminó detenido; no se instaló un servicio global.

## Candidato y siguiente aceptación

Los logs completos, JSON Jest, checksum/readback U6, hashes de preservación,
recibos y manifiesto final quedan en `_p4-20261112/`, fuera del repositorio.
El [resumen público](RESULTADOS_P4_2026-11-12.json) contiene resultados acotados.
El manifiesto final distingue bytes de trabajo de identidad del árbol Git.
Los manifiestos de octubre conservan exclusivamente valor histórico.

La consulta remota de esta ejecución confirmó `main` en
`e9ee0db68bd318942a826cfee4fb0e36850a998a` y ausencia del workflow P4 allí.
Ese commit **no es ancestro** de la rama local; su merge-base es
`72cc0c242358d06e100e8546311040d1c0a45371`.
Publicar la rama incluye cambios previos, no solo los cinco paths de código P4.
La diferencia exacta se incluye en el paquete privado para revisión; no se
autoriza una actualización forzada ni un merge global de esa rama a `main`.

La propuesta separa la publicación del candidato en una rama propia del bootstrap
mínimo del workflow sobre el `main` remoto observado. El paquete incluye patch,
hashes y límites explícitos para los jobs antiguos sin cap, cuya aceptación
también forma parte de la decisión de publicación. El candidato general tiene
seis jobs con caps totales de 100 minutos de runner; P4 agrega como máximo 45.
Un push y un PR pueden disparar dos CI; concurrencia/cancelación no garantizan
que no haya gasto en ambas. No se calculan precios ni multiplicadores facturables.

Publicación, bootstrap y dispatch esperan revisión del paquete concreto según el
gate histórico de P4. Retención real de logs: **NO VERIFICADA**; artefacto P4:
siete días, custodia del propietario. No hubo push, PR, merge, dispatch ni upload.
El cierre exige CI obligatoria verde, P4 Ubuntu/PG16 del SHA aprobado y readback
independiente del artefacto descargado. Un resultado local o un run verde aislado
no sustituye esos requisitos. Ver [plan y criterios](../planejamento/PLAN_ACTUALIZACION_P4_2026-11-12.md).
