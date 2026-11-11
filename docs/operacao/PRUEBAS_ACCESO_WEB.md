# Pruebas de acceso web con recursos desechables

El comando `npm run test:access-browser`, desde `backendnest/`, construye la
aplicación Expo actual y recorre sus pantallas con Nest y PostgreSQL reales.
Complementa Jest y `registration-atomicity.e2e-spec.ts`; no sustituye las pruebas
Android/iOS ni cierra los gates históricos P4/U6 o de producción.

## Preparación y ejecución

Usar Node 22, dependencias instaladas con los locks de ambos paquetes y una base
nueva cuyo nombre y owner comiencen por `finance_e2e_`. El owner debe ser su
propietario exclusivo, sin privilegios elevados ni membresías; el comentario de
la base debe ser `finance-e2e-disposable`. No usar una base de la aplicación.

Definir explícitamente `E2E_DB_HOST`, `E2E_DB_PORT`, `E2E_DB_USERNAME`,
`E2E_DB_PASSWORD`, `E2E_DB_NAME` y `E2E_DB_RESET_CONFIRM` (igual al nombre).
Se aplican los mismos controles de identidad, marcador, lease, cuarentena y
timeouts de `backendnest/test/e2e-runtime.cjs`. No se cargan `.env` privados.

En Windows se usa Edge instalado; en Linux, instalar Chromium con
`npx playwright install --with-deps chromium` desde `frontend/`. Después:

```text
node --test test/access-browser-runner.spec.cjs
npm run test:access-browser
```

La integración del registro se ejecuta con **otra base nueva** y el mismo perfil:

```text
node test/e2e-runner.cjs --runInBand --runTestsByPath test/registration-atomicity.e2e-spec.ts
```

El ejecutor de acceso escucha exclusivamente en `127.0.0.1`, API 4319 y web 4189.
Rechaza puertos ocupados, iguales o privilegiados; se pueden elegir mediante
`ACCESS_API_PORT` y `ACCESS_WEB_PORT`. Solo termina sus procesos propios.
PostgreSQL se proporciona externamente y no se detiene mediante este comando.
No reutilizar una base que haya quedado en cuarentena tras un fallo.

## Cobertura y límites

`frontend/tests/access/access.spec.ts` usa registro, login, dashboard, perfil,
contas, recuperación y cambio de contraseña reales. Comprueba rollback mediante
un trigger confinado, pérdida de una respuesta de alta ya confirmada, reintento,
errores de credenciales, URL directa, atrás/recarga, salida local sin red,
reconexión, expiración real y respuestas antiguas entre dos pestañas.

La consulta auxiliar de CEP usa una respuesta sintética para no depender de un
servicio externo. Las peticiones de autenticación llegan al backend real; algunas
respuestas reales se retienen o pierden deliberadamente para probar carreras.
Las fechas de expiración se controlan únicamente dentro de la base desechable.

El perfil de pruebas eleva el límite **global** de solicitudes como el E2E
existente; conserva los límites específicos de los endpoints de autenticación.
Desactiva el worker de entrega y usa claves JWT sintéticas. El token de
recuperación se obtiene del contrato exclusivo de `NODE_ENV=test`; no se activa
su exposición en producción ni se guarda en capturas.

TypeScript se carga sin typecheck en los procesos de preparación/API, igual que
el arnés existente. Ejecutar por separado tipos completos de ambos paquetes.
La exportación es de producción, limpia la caché Metro y usa la URL del intento.

## Evidencia y diagnóstico

Cada intento crea `.tmp/access-<uuid>/`: `binding.json` con hashes de fuentes,
logs privados por proceso, `browser.json` de Playwright y `result.json` después
de la limpieza. No publicar ese directorio indiscriminadamente. No se generan
screenshots, video ni trazas. `PASS` exige que las pruebas y la limpieza terminen.
Los límites son finitos: preparación 60 s, arranque API 120 s, exportación 180 s,
navegador 600 s; Playwright aplica también límites de caso y ejecución global.

Para revisar posibles cuentas históricas incompletas, existe
[DIAGNOSTICO_ALTAS_PARCIALES.sql](DIAGNOSTICO_ALTAS_PARCIALES.sql). Es de solo
lectura y no se ejecuta automáticamente: cero categorías es una señal que exige
investigación, no una autorización para rellenar o modificar cuentas.
