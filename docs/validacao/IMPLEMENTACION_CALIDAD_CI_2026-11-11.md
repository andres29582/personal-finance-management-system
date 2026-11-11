# Implementación de calidad y CI — 11/11/2026

Estado: **EN CURSO**. Base `261c209d7856400ab95ecc229971ba009b4f92ea`.
Rama local `codex/calidad-ci-2026-11-11`.

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

## Q1 y correcciones en preparación

Los dos verificadores del contrato de lint pasan: fuentes, tests y CJS se
analizan; código inválido provoca errores; las reglas bloqueantes permanecen
activas. El perfil nuevo distingue TypeScript tipado y configuración CJS/Node.
Los bundles `smoke-web`, `dist` y salidas `.dev-dist` verificadas se conservan y
quedan excluidos del análisis de fuentes.

El alcance backend ampliado detectó nueve errores CJS adicionales mantenidos,
que se incorporan al trabajo; los errores de JS compilado no se confunden con
deuda del producto. El primer perfil frontend pasó de 70 a 63 errores al
reconocer los globals Node de sus siete diagnósticos de `__dirname`.

El cambio de borradores se revisó como **CRITICAL**: 13 consumidores directos
del hook, con métodos compartidos de alcance mayor. Sus regresiones se están
validando antes de continuar con formularios y navegación.

## Gates pendientes

Q2/Q3: lint de fuentes mantenidas y regresiones completas. Q4/Q5: entorno limpio,
ML y compatibilidad CI/P4 por plataforma. Q6: revisión del candidato exacto y
ejecución remota. Q7: cierre con resultados reales, sin equiparar preparación
local con CI remota o validación nativa.
