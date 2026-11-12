# Implementación de calidad y CI — 11/11/2026

Actualizado: **12/11/2026**, America/Sao_Paulo.
Estado: **IMPLEMENTACIÓN LOCAL TERMINADA; CIERRE REMOTO PENDIENTE**.
Base `261c209d7856400ab95ecc229971ba009b4f92ea`.
Rama local `codex/calidad-ci-2026-11-11`.
Candidato de código/CI: `146cba8573130f19905b669cf52a7c8d41185675`.
[Resumen verificable](RESULTADOS_CALIDAD_CI_2026-11-12.json).

El [plan](../planejamento/PLAN_CALIDAD_CI_2026-11-11.md) se implementa en lotes.
Las pruebas del cierre de acceso se conservan con sus identidades anteriores.
La custodia privada `_calidad-20261111`, fuera del repositorio, contiene hashes
de 1.131 archivos y los logs/JSON por intento. No se publican logs privados.

## Q0: baseline

- Backend completo anterior: 1.555 errores y 140 advertencias.
- Comando CI backend anterior, reproducido sin cambiar reglas: **111 errores
  y dos advertencias**, 214 archivos. Excluía specs y rebajaba tres reglas.
- Frontend mantenido: 70 errores/78 advertencias; bundle histórico aparte.
- Entorno: Node portable 22.23.4. No hay Docker ni WSL instalado. El usuario
  eligió preparar Linux/PostgreSQL 16 en CI cuando esté listo el candidato.
- GitNexus estructural actualizado; FTS sigue deshabilitado.

## Resultado local

| Comprobación | Resultado |
| --- | --- |
| Lint backend mantenido, pruebas, CJS y declaraciones | 0 errores; 22 advertencias heredadas |
| Lint frontend mantenido | 0 errores; 78 advertencias heredadas |
| Jest backend | 1.094/1.094, 102 suites |
| Jest frontend | 884/884, 96 suites |
| Tipos completos de ambos paquetes | PASS |
| Tipos de build backend, Nest build y export web | PASS |
| E2E completo Windows/PostgreSQL 18.6 | 191 PASS; una omisión heredada |
| Concurrencia financiera antes fallida | 13/13 PASS dentro del E2E completo |
| Arneses portables | 123 PASS; casos Windows excluidos explícitamente |
| Windows Job, cancelación y descendientes | 2/2 PASS en copia de fuentes iguales |
| Sintaxis y expresiones de ambos workflows | PASS, actionlint 1.7.12 |
| Navegador real, última repetición | 6/6 PASS; 862 fuentes verificadas; cero drift y errores de limpieza |

Los JSON y logs originales de cada intento se conservan en la custodia privada,
incluidos los fallos iniciales. La revisión de advertencias backend comparó
archivo, regla y mensaje con la baseline: **cero advertencias nuevas**.
En frontend coinciden 77 advertencias exactamente y una conserva la deuda de
la dependencia `draft` al pasar de `useCallback` a `useEffect` en pagos: no
aumenta el total, pero su huella textual sí cambió y queda registrada.

El caso heredado desactivado es
`test/transfer-intent-concurrency.e2e-spec.ts`: contiene un `describe.skip`
preexistente y solicita fixtures RNF externos. Se conserva y se declara; no se
cuenta como PASS. Los tests activos de transferencias, idempotencia y concurrencia
mantienen sus comprobaciones. Esto es una limitación del cierre de pruebas.

## Q1: contrato de lint

Los dos verificadores del contrato de lint pasan: fuentes, tests y CJS se
analizan; código inválido provoca errores; las reglas bloqueantes permanecen
activas. El perfil nuevo distingue TypeScript tipado y configuración CJS/Node.
Los bundles `smoke-web`, `dist` y salidas `.dev-dist` verificadas se conservan y
quedan excluidos del análisis de fuentes.

El alcance backend ampliado detectó nueve errores CJS adicionales mantenidos,
que se incorporan al trabajo; los errores de JS compilado no se confunden con
deuda del producto. El primer perfil frontend pasó de 70 a 63 errores al
reconocer los globals Node de sus siete diagnósticos de `__dirname`.

Se mantienen las reglas bloqueantes de TypeScript y React; CI ejecuta los
scripts canónicos sin autofix, exclusiones de specs ni rebajas de reglas.
Los contratos de lint comprueban que una fuente inválida sigue provocando un
error y que los archivos mantenidos no quedan ignorados.

## Q2: frontend

Los borradores usan estado para renderizar y referencias operativas actualizadas
al confirmar el render. El alcance distingue A→B→A e impide que reviva un setter
antiguo. Se añadieron regresiones de ese recorrido y de escrituras consecutivas.
Planificación conserva generaciones, propietarios, permisos y respuestas tardías;
el menú conserva versiones de presentación y foco. Las cargas iniciales de sesión
y pagos quedan ligadas a sus operaciones asíncronas. Se conservan los recorridos
de acceso y registro atómico del cierre anterior.

GitNexus se consultó antes de modificar símbolos; se revisaron sus riesgos altos
y críticos. Los resultados amplios por propiedades genéricas se contrastaron con
consumidores y pruebas reales. `detect_changes` acompaña cada commit.

## Q3: backend y arneses

Se valida la forma de las filas `RETURNING` de TypeORM conservando el arbitraje
de idempotencia por usuario/clave. Los errores nativos de autenticación conservan
su identidad; los valores lanzados que no son `Error` se encapsulan con su causa.
Los contratos CJS, Playwright, JSON y SQL sustituyen accesos inseguros; los
validadores siguen recibiendo casos negativos. La limpieza del runner conserva
el fallo original y ejecuta también los readbacks cuando falla otra etapa.

La suite E2E completa descubrió 13 fallos de coordinación que no aparecían en
Jest: una transacción financiera pausada podía retener una clave foránea de
usuario y bloquear la autenticación de su competidora. Una admisión **solo de
prueba**, posterior a los guards reales, permite autenticar ambas peticiones
antes de ordenar sus handlers financieros. Se mantienen los SQL de bloqueo y
todas las comprobaciones de saldo, estados, auditoría y ownership. Las pruebas
son dueñas de un listener compartido para que Supertest no lo cierre mientras
otra petición sigue activa. Cinco regresiones cubren liberación, autenticación,
tokens desconocidos, desconexión y cancelación.

El runtime de producción no incorpora esta admisión ni interpreta su header.
Se conservaron las 1.089 pruebas unitarias anteriores. El formato general se
separó del lote funcional en un commit con igualdad de árboles sintácticos.

## Q4/Q5: reproducibilidad y CI preparada

El usuario eligió preparar Linux/PostgreSQL 16 en CI. Este equipo dispone de
Windows y PostgreSQL 18.6 portátil; sus resultados no acreditan Linux/PG16.
El [lock de ML](../../ml-finance-tcc/README-ci.md) fija 47 paquetes con hashes,
resueltos con uv 0.13.7 para Linux x86_64/Python 3.11.18. La instalación y pytest
se prepararon en **dos venv independientes**; todavía no se ejecutaron en Linux.

| Job | Plataforma | Límite |
| --- | --- | --- |
| Frontend: instalación, contrato/lint, tipos, Jest, export | Ubuntu 24.04, Node 22.23.4 | 20 min |
| Backend: ambos locks, contrato/lint completo, ambos tipos, arneses, Jest, build | Ubuntu 24.04, Node 22.23.4 | 15 min |
| E2E backend con base confinada y migraciones | Ubuntu 24.04, PostgreSQL 16 | 15 min |
| Acceso web real con Chromium y base confinada | Ubuntu 24.04, PostgreSQL 16 | 20 min |
| Ownership y cancelación de Windows Job | Windows 2025, Node 22.23.4 | 10 min |
| ML: dos instalaciones con hashes, pip check y pytest | Ubuntu 24.04, Python 3.11.18 | 20 min |
| P4 manual, prueba cerrada y readback | Ubuntu 24.04, PostgreSQL 16 | 45 min |

Los jobs que comprueban tipos completos instalan también el frontend, necesario
para los tipos Playwright del arnés. P4 mantiene sus seis checks, política
`P4_PUBLIC_7D_OWNER_CUSTODY`, SHA exacto, permisos de lectura, cuatro actions
fijadas por SHA y sus dos únicos archivos públicos con retención de siete días.
La partición portable/Windows es explícita; un caso no ejecutado no se presenta
como prueba Windows aprobada. La fuente conserva su `Zone.Identifier`; las
pruebas Windows usan una copia de bytes iguales sin modificar esos metadatos.

## Destino remoto y aprobación pendiente

Lectura realizada el 12/11/2026: el repositorio
`andres29582/personal-finance-management-system` sigue siendo público y su rama
predeterminada es `main`, en `e9ee0db68bd318942a826cfee4fb0e36850a998a`.
La API de rama informa `protected: false` y la lista visible de rulesets está
vacía. El endpoint de detalle de protecciones devuelve 403 para la integración;
la retención global del repositorio no está expuesta por el conector disponible.
Estas limitaciones de lectura no se sustituyen por supuestos.

P4 no existe aún en `main` (404). Su incorporación al default branch y el
dispatch necesitan la revisión del candidato concreto descrita en Q6 del
[plan](../planejamento/PLAN_CALIDAD_CI_2026-11-11.md). No se fusiona por ese
requisito. La preparación local no registra ningún run remoto como aprobado.

La comparación requerida con `main` **local** (`20f88b41abd0026fc9407bcf706dc60de9fef6a2`)
abarca 472 archivos y GitNexus la clasifica como crítica: incluye también la
consolidación y el cierre de acceso anteriores. No equivale al diff de este
lote de calidad ni al diff con el `main` remoto observado. La revisión de
publicación debe considerar todo ese trabajo heredado.

## Conservación y rollback

Los 39 registros de worktrees antiguos y sus 301 archivos de metadatos se
compararon byte a byte con la preservación: sin diferencias. Se mantienen
`gc.auto=0` y `maintenance.auto=false`, el historial anterior y las evidencias
privadas. Los cambios se revierten por commits de la rama; no se descarta ni
resetea el trabajo consolidado.

## Gates pendientes

**LOCAL_PASS** confirmado para las comprobaciones locales aplicables.
La última exportación fría y los seis recorridos se ejecutaron con permisos
del ejecutor Windows suficientes para resolver dependencias; conservan el
límite temporal original. Los intentos anteriores que agotaron ese límite
permanecen como FAIL en la evidencia y no se reutilizan.
**LINUX_PG16_PASS**, **CI_REMOTE_PASS** y **P4_REMOTE_PASS** siguen pendientes.
También queda explícita la prueba RNF heredada desactivada. El cierre general
de CI y la certificación de producción o Android/iOS no se derivan de estos
resultados locales.
