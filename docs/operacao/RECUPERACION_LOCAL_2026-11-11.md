# Recuperación local de la consolidación

Este procedimiento utiliza el paquete privado `_preservacion/20261110-2bfda3599f1c`, situado junto a `meu-sistema-financeiro` en el workspace. Primero se restaura en un destino nuevo; la carpeta de trabajo se sustituye únicamente después de verificar la recuperación.

## Artefactos

| Artefacto privado | Uso |
| --- | --- |
| `snapshot/` | Estado físico original completo, incluidos `.git`, cambios pendientes, configuraciones locales e historia ignorada |
| `manifest.jsonl`, `verification.json` | Hashes originales y comprobación de todos los archivos; estado `VERIFIED` |
| `history.bundle` | Historia inicial y 183 referencias; no contiene por sí solo el trabajo que estaba pendiente |
| `restauracion-operativa/`, `restauracion-verificada.json` | Recuperación ensayada del índice, fuentes y estado pendiente inicial |
| `consolidado.bundle` | Historia con la rama consolidada y sus commits de cierre |
| `conservacion-final.json`, `estado-final.json` | Comparación explicada con el origen y recibo del commit final |
| `custodia-todos-archivos.jsonl` | Destino de cada archivo del snapshot, sin contenido de credenciales |

Las herramientas portables se encuentran en `_herramientas-consolidacion/runtime/`: `mingit-2.56.1/cmd/git.exe` y `node-v22.23.4-win-x64/node.exe`. Los verificadores utilizados se conservan también con la evidencia privada. Esta copia reside en el mismo disco; el propietario debe copiar el paquete a otro medio para cubrir la pérdida del disco.

## Recuperar las fuentes consolidadas

Desde el workspace, seleccionar un destino que todavía no exista:

```powershell
$workspace = (Get-Location).Path
$paquete = Join-Path $workspace '_preservacion\20261110-2bfda3599f1c'
$gitTool = Join-Path $workspace '_herramientas-consolidacion\runtime\mingit-2.56.1\cmd\git.exe'
$destino = Join-Path $workspace 'recuperacion-consolidada-nueva'
if (Test-Path -LiteralPath $destino) { throw 'El destino ya existe' }
& $gitTool -C (Join-Path $workspace 'meu-sistema-financeiro') bundle verify (Join-Path $paquete 'consolidado.bundle')
if ($LASTEXITCODE -ne 0) { throw 'Bundle no verificado' }
& $gitTool clone --branch codex/consolidacion-2026-11-11 (Join-Path $paquete 'consolidado.bundle') $destino
if ($LASTEXITCODE -ne 0) { throw 'Clonado incompleto' }
& $gitTool -c "safe.directory=$destino" -C $destino fsck --full
& $gitTool -c "safe.directory=$destino" -C $destino status --porcelain=v2
& $gitTool -c "safe.directory=$destino" -C $destino rev-parse HEAD
```

Comparar HEAD con `estado-final.json`. El estado de fuentes recuperadas debe estar limpio. Esta prueba recupera fuentes e historia versionadas; los archivos privados se recuperan separadamente desde el snapshot y no se incorporan a Git.

Para preparar dependencias, utilizar Node 22 y ejecutar `npm ci` en `backendnest` y `frontend`. El lockfile final del frontend incluye Skia 2.6.2. La instalación limpia no convierte los fallos de Jest/lint documentados en comprobaciones aprobadas.

## Recuperar exactamente el trabajo previo a los commits

1. Comprobar `verification.json`: debe indicar `VERIFIED`, cero fallos y el hash del manifiesto esperado.
2. Crear otro destino vacío. Copiar `snapshot/` completo conservando rutas y bytes; no aplicar exclusiones de dependencias, historia o archivos ocultos para una recuperación física completa.
3. Recalcular SHA-256 por archivo y compararlo con `manifest.jsonl`. El verificador de esta ejecución está en la evidencia privada; usar un archivo de resultados nuevo para no reemplazar el comprobante original.
4. Comprobar HEAD, índice y salida de Git frente a `estado-inicial.json`, `git-index.bin` y `git-status.bin`. El HEAD original es `43bcfac1817568d62ba7d1b0103468037cd4de6e`.
5. Conservar la ausencia original de `frontend/src/modules/dashboard/components/DashboardShell.tsx`; reconstruirlo desde HEAD alteraría el estado que se está recuperando.

La restauración operativa ya ensayada recuperó las fuentes, `.git`, dos configuraciones locales y las guías seleccionadas exclusivamente desde el snapshot, sin consultar los archivos originales. Sus dependencias se instalaron después para la validación. Para reproducir la evidencia original, partir siempre del snapshot verificado, no de una copia de ensayo modificada por herramientas.

Los `.env`, logs privados, metadata Git y evidencias históricas permanecen bajo custodia local. Al cerrar se detectó la desaparición de un registro de worktree y el acortamiento de reflogs durante las operaciones Git. Se restauró la metadata original sin sobrescribir nuevas entradas y se conservó el estado intermedio en `worktrees-post-operaciones/`. El recibo `worktree-metadata-recovery.json` contiene la comparación. El mantenimiento automático local quedó deshabilitado; la revisión manual de rutas antiguas sigue pendiente.
