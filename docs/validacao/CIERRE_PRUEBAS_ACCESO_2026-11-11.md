# Cierre de pruebas y acceso web

Fecha: **11/11/2026**, America/Sao_Paulo. Estado: **CERRADO LOCALMENTE EN ESTE ALCANCE**.
Rama: `codex/cierre-pruebas-acceso`.

Base preservada: `a2863da5c7eb1b8f76e39eba53c8587b3d58ae05`.
Candidato de código: **`631b187f6ffd0776f8e99be7ba5596a7fb55cb0f`**.
Los commits posteriores de cierre modifican documentación y el contrato descriptivo.
No se hizo push, merge a main ni despliegue.

[Resultado estructurado](RESULTADOS_CIERRE_ACCESO_2026-11-11.json) y
[plan implementado](../planejamento/PLAN_CIERRE_PRUEBAS_ACCESO_2026-11-11.md).

## Cambios implementados

- El registro persiste usuario y ocho categorías mediante el mismo manager de
  `DataSource.transaction`. Bcrypt se calcula antes de abrir la transacción.
  Los conflictos concurrentes reconocidos de email/CPF conservan HTTP 409 y su
  código/campo; los errores imprevistos no exponen detalles SQL. No hay autologin.
- Se corrigieron los 36 fallos iniciales del frontend y el fallo de ordenación
  backend. Las fixtures incluyen autoridad y cleanup; `resolveApiError` conserva
  su clasificación sin borrar credenciales. El formulario de gasto espera su
  preparación asíncrona, y las expectativas de pagos incluyen `fieldErrors`.
- Los recorridos reales descubrieron que el cliente bloqueaba el CEP público
  sin sesión. Solo `/cep/<8 dígitos>` queda exento de credenciales y refresh;
  las rutas protegidas y el rechazo de generaciones antiguas se mantienen.
- El consentimiento expone `aria-checked` en web. Ante una respuesta de registro
  perdida, la pantalla explica que la cuenta puede existir y ofrece volver al
  login o recuperar la contraseña, sin reintentar automáticamente.
- `RootLayout` conserva la navegación cuando una actualización informativa del
  perfil pertenece a la misma generación con autoridad ya confirmada. Una
  generación nueva, autoridad suspendida o retorno del segundo plano conserva
  la validación con el servidor. El diff se revisó como **alto riesgo**, con
  once procesos afectados, y cuenta con regresiones y prueba web real.
- Se añadió un ejecutor confinado, seis recorridos de pantallas reales y un job
  CI dedicado. [Instrucciones operativas](../operacao/PRUEBAS_ACCESO_WEB.md).

## Resultados

Entorno: Node **22.23.4**, PostgreSQL portátil **18.6**, Edge headless y viewport
390 × 844. La CI preparada usa Chromium y PostgreSQL 16; esa ejecución remota
todavía no se ha realizado.

| Comprobación | Resultado |
| --- | --- |
| Jest backend | **1.089/1.089**, 101 suites |
| Jest frontend completo final | **882/882**, 96 suites |
| Registro con PostgreSQL real | **6/6** |
| Pruebas del arnés, incluidas tres nuevas de confinamiento | **101/101** |
| Tipos completos backend y frontend, sin emisión | **PASS** |
| Build Nest y exportación Expo web de producción | **PASS** |
| Recorridos reales Edge + Nest + PostgreSQL | **6/6**, cero retries, skips o flaky |
| Parseo del workflow y OpenAPI | **PASS** |

La integración demostró primero el defecto anterior: un fallo al insertar la
segunda categoría dejaba un usuario guardado. El código corregido demuestra
rollback observado desde otra conexión, reintento, catálogo completo, carreras
de email/CPF, independencia entre usuarios y consentimiento obligatorio.

Jest backend se ejecutó sobre L3 (`77253f1`); sus fuentes y tests en
`backendnest/src` permanecen idénticos. La integración L1 (`e57e776`) se conserva
con las fuentes productivas backend sin cambios posteriores. No se presentan
como ejecuciones nuevas. Tipos completos, build y recorridos actuales validan
las superficies añadidas. El readback del navegador comprobó **853 archivos
de entrada sin divergencias** respecto a la ejecución aprobada.

Después del pase completo del arnés, el ajuste final de rutas estáticas volvió
a aprobar sus tres pruebas afectadas y se comprobó con implementaciones de
ruta Windows y POSIX. Las otras 98 entradas del arnés permanecen sin cambios.

Los seis recorridos finales comprueban:

1. Registro sin autologin, doble envío, CPF duplicado, credenciales incorrectas,
   acceso, perfil, logout, atrás y recarga.
2. Fallo de categorías con rollback; respuesta 201 real perdida; reintento con
   conflicto y una sola cuenta completa que permite login.
3. Reconfirmación sin red, datos ocultos, recuperación explícita y logout local
   offline con aviso de revocación remota no confirmada; recarga sin resurrección.
4. Respuesta terminal de A retenida durante el login de B y logout propagado
   entre dos pestañas.
5. Expiración inactiva y absoluta con rechazo real del servidor.
6. Recuperación y cambio autenticado de contraseña, con login posterior.

Solo el CEP auxiliar usa una respuesta sintética. Auth llega al backend real;
las respuestas retenidas/perdidas se obtienen del servidor real. Las fechas y
los fallos inducidos se limitan a una base desechable. Las pruebas de lifecycle
web usan los eventos de la aplicación; no acreditan un dispositivo nativo.

## Lint y límites

No se ejecutó autofix global. Los totales de deuda permanecen iguales a la
baseline, aunque se incorporaron archivos de pruebas:

| Alcance | Errores | Advertencias |
| --- | ---: | ---: |
| Backend mantenido | 1.555 | 140 |
| Frontend mantenido | 70 | 78 |
| Frontend completo, incluido el bundle histórico `smoke-web` | 3.784 | 2.564 |

Los archivos nuevos no tienen errores de lint; CJS se comprobó además con las
reglas JS recomendadas porque el lint tipado del paquete cubre TypeScript.
`RootLayout` conserva un error previo de `set-state-in-effect` en
`setSecondsLeft(null)`, fuera del cambio de este lote. No se declara verde la
CI general mientras esa deuda persista.

Permanecen pendientes Android/iOS, CI remota, PostgreSQL 16 en CI y los gates
históricos P4/U6 o de producción. Esta entrega no certifica los dominios
financieros o ML completos. La transacción protege altas futuras; la consulta
[de diagnóstico histórico](../operacao/DIAGNOSTICO_ALTAS_PARCIALES.sql) es de
solo lectura, no se ejecutó sobre datos del usuario ni repara cuentas.

## Evidencia y conservación

Evidencia privada local: `_acceso-20261111` en el directorio padre del repositorio.
Intento final: `.tmp/access-1faebbd5-07af-4de2-bdd3-443da11db4fe/`.
El digest de sus fuentes es
`f2bf9fbe9db20138168f4a55ce2d95a3cd9009ffd4c9a8cf9881bd48298bda87`.
`result.json` registra **PASS**, `childrenStopped: true` y cero errores de
limpieza. PostgreSQL propio quedó detenido y los puertos 4319/4189/55439 libres.
No se afirma una inspección individual de todos los PIDs internos de Edge.

Los intentos fallidos y los ajustes de fixtures permanecen conservados. Un
comando falló al respaldar la marca de descarga Windows del guardián de pruebas:
la metadata se recuperó byte por byte desde el snapshot histórico, con código
idéntico. `guardian-metadata-recovery-final.json` documenta la recuperación y
desautoriza el recibo intermedio inválido. No se cambió la política global de
Windows ni el código del guardián. Las 101 pruebas pasaron durante el intento
sin esa marca, y esta quedó restaurada al concluir.

Los informes de consolidación anteriores, sus respaldos y las ramas históricas
se conservan. El mantenimiento automático Git permanece deshabilitado. La
reversión de esta entrega se realiza por sus commits locales y dependencias,
sin borrar worktrees ni descartar trabajo ajeno.

La verificación final conserva **39 registros de worktree y sus 301 archivos**
idénticos al snapshot, además de **1.084 archivos fuera del cambio sin drift**.
La rama consolidada permanece en `a2863da5c7eb1b8f76e39eba53c8587b3d58ae05`.
GitNexus se actualizó al candidato de código; FTS permanece deshabilitado. La
comparación amplia contra `main` es **crítica** e incluye el sistema consolidado
anterior, por lo que no representa únicamente el diff de esta entrega. Cada
commit de acceso se comprobó también por separado mediante `detect_changes`.
