# Publicación P4: CI general aprobada; aceptación P4 abierta

Fecha: **2026-11-13**, America/Sao_Paulo.
Estado: **PUBLISHED / CI_GENERAL_PASS / P4_REMOTE_FAILED / OPEN**.
U6/etapa 2 continúa abierto y producción continúa bloqueada.

## Resultado comprobado

- El sistema está publicado en `codex/actualizacion-p4-2026-11-12` del repositorio
  público `andres29582/personal-finance-management-system`.
- El [PR #137](https://github.com/andres29582/personal-finance-management-system/pull/137)
  integró exclusivamente dos workflows en `main`; merge
  `55aebdbb167f1b3ae969524fe1caf1c7499d6507`.
- La [CI de main](https://github.com/andres29582/personal-finance-management-system/actions/runs/43433224971)
  pasó. El código completo del candidato no se fusionó con `main` ni se desplegó.
- La [CI del candidato 3dfcd84](https://github.com/andres29582/personal-finance-management-system/actions/runs/43433895461)
  aprobó sus seis jobs: frontend, backend, E2E PostgreSQL 16, acceso Chromium/Linux,
  propiedad Windows y ML con dos instalaciones limpias verificadas por hashes.
- La [primera ejecución P4](https://github.com/andres29582/personal-finance-management-system/actions/runs/43434466181)
  sobre `3dfcd84475252a4f2ed7fb09c737bec781f17c78`, attempt 1, falló en el driver.
  La instalación limpia de ambos paquetes pasó; upload, download y readback
  quedaron omitidos por el fallo. **No se publicó un artefacto P4 ni existe
  evidencia suficiente para cerrar su aceptación.**

## Correcciones surgidas de la CI real

| Problema | Corrección y evidencia |
| --- | --- |
| Checkout Windows sin `.tmp` | Crear el padre antes de `mkdtemp`; caso verificado también en árbol local nuevo |
| `SystemRoot` ausente en Linux | Construcción condicional de PATH; regresión sin variables Windows |
| Tests frontend dependientes del huso del host | Fijar São Paulo antes de crear los entornos Jest; regresiones pasan partiendo de UTC |
| Respuesta inicial de cuentas compitiendo con expiración A | Esperar el estado vacío cargado antes de expirar A; todas las assertions de B y logout entre pestañas se conservan; Chromium/Linux pasó |
| Arranque frío PowerShell/.NET en Windows hospedado | Preflight de compilación con salida privada y timeout de 55 s, antes del trabajo contenido; sin cambiar script guardián, handshake, casos de 60 s ni step de 3 min |
| `ubuntu-latest` sin paquete cliente PG16 para el bootstrap antiguo | Fijar su job E2E a Ubuntu 24.04; CI de bootstrap, PR y main aprobadas |

Las revisiones conservaron los commits y logs fallidos; no hubo force-push ni
reintentos automáticos del mismo SHA. La custodia completa está fuera del
repositorio, en `_p4-20261113/`. El guardián original y su metadata mantienen los
hashes registrados en el [informe local anterior](IMPLEMENTACION_P4_2026-11-12.md).

## Diagnóstico preparado para el siguiente P4

Revisión: **`88658d62c89cc1e470dbd3849dac8a4397cd4219`**.
[CI de esta revisión](https://github.com/andres29582/personal-finance-management-system/actions/runs/43436018983).
Resultado: **seis jobs aprobados** también para esta revisión.
[Resumen verificable](RESULTADO_PUBLICACION_P4_2026-11-13.json).

El primer workflow mantuvo el log completo privado, por lo que su salida pública
no identifica cuál de las fases internas falló. No se atribuye una causa que no
está demostrada. La revisión nueva emite START/PASS por check y una lista cerrada
de etapas internas. El workflow filtra exclusivamente esos códigos ante fallo:
no publica mensajes, paths, SQL, credenciales ni el contenido del log privado.
El job sigue fallando y sigue bloqueando artefactos ante cualquier error.

Validación local: **19/19** pruebas puras P4, lint de los archivos afectados y
actionlint aprobados. Incluye regresiones con entradas privadas que el filtro
debe rechazar. Schema, seis checks, aceptación sin skips, caps, permisos y
allowlist de dos archivos P4 permanecen intactos. Preparar diagnóstico no corrige
por sí solo el fallo nativo aún no identificado.

## Aceptación todavía necesaria

La retención real del repositorio se verificó por API: **90 días**. El artefacto
P4 conserva la política aprobada de **siete días**, público y bajo custodia del
propietario. La ejecución autorizada del paquete original ya fue utilizada;
ese paquete excluía reintentos automáticos. Un nuevo run manual requiere ampliar
esa autorización para el SHA concreto y su cap de 45 minutos.

Después del nuevo run deben aprobarse P4, descarga y readback independiente:
checksum, schema, commit, run/attempt, inventario Git y limpieza. Si vuelve a
fallar, conservar evidencia y diagnosticar la fase indicada; no declarar PASS.
El cierre P4 no cierra automáticamente U6/etapa 2 ni autoriza producción.
