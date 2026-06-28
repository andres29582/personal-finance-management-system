# Runbook Operacional Local

Checklist para preparar una entrega local confiable del sistema financiero.

## 1. Variables y base de datos

1. Copiar `backendnest/.env.example` a `backendnest/.env` si todavia no existe.
2. Confirmar PostgreSQL activo con la base indicada en `DB_NAME`.
3. Copiar `frontend/.env.example` a `frontend/.env` si todavia no existe.
4. Confirmar que `EXPO_PUBLIC_API_URL=http://localhost:3000`.

## 2. Datos demo

El camino oficial para cargar datos demo es:

```powershell
cd backendnest
npm run seed:demo
```

El seed recrea el usuario demo si ya existe, por lo que no es destructivo para otros usuarios.

Credenciales demo:

```text
Email: demo.financeiro@exemplo.com
Senha: Demo@123456
```

El seed deja datos para dashboard, contas, transacoes, categorias, orcamentos, relatorios, metas, alertas, transferencias, dividas y previsao.

## 3. Checks antes de levantar localhost

O comando principal desde a raiz executa testes do backend, build do backend e testes do frontend:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\verify-all.ps1 -SkipLocalhost
```

Tambien se puede ejecutar paso a paso:

```powershell
cd backendnest
npm test -- --runInBand
npm run build

cd ..\frontend
npm test -- --runInBand
```

Si `npm run build` falla con `EPERM` al intentar borrar archivos en `backendnest/dist`, cerrar procesos locales de Node/Nest que puedan estar usando el build anterior y repetir el comando. El flujo oficial de este checklist usa el build estandar.

## 4. Orden recomendado para demo

1. Confirmar PostgreSQL activo con la base configurada en `backendnest/.env`.
2. Levantar backend y validar `GET /health`.
3. Levantar frontend y validar HTTP 200 en `http://localhost:8081`.
4. Levantar ML solo si la demo incluye previsao de deficit.

## 5. Levantar servicios locales

Terminal 1:

```powershell
cd backendnest
npm run start:dev
```

Terminal 2:

```powershell
cd frontend
npm run web
```

ML opcional, solo para validar previsao de deficit con el servicio externo activo:

```powershell
cd ml-finance-tcc
python -m uvicorn api.app:app --host 0.0.0.0 --port 8000
```

URLs esperadas:

- Backend: `http://localhost:3000`
- Backend health: `http://localhost:3000/health`
- Frontend: `http://localhost:8081`
- ML opcional: `http://localhost:8000/health`

Los scripts por defecto escriben cache y build temporal en `%LOCALAPPDATA%\meu-sistema-financeiro` para evitar bloqueos de OneDrive. Los scripts `start:dev:standard` y `web:standard` quedan como fallback si el proyecto se mueve fuera de OneDrive.

## 6. Verificacion rapida

Con backend y frontend activos:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\verify-all.ps1
```

Para validar solo los endpoints HTTP:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\verify-localhost.ps1
```

Debe reportar HTTP 200 en `GET /health` del backend y en el frontend.

## 7. Smoke manual minimo

Comandos exactos para validar desde PowerShell:

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 8
Invoke-WebRequest -Uri "http://localhost:8081" -UseBasicParsing -TimeoutSec 30
```

Si ML esta activo:

```powershell
Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 8
```

Flujo manual en navegador:

1. Abrir `http://localhost:8081`.
2. Entrar con el usuario demo.
3. Validar que dashboard muestre saldos y tarjetas con datos.
4. Navegar por contas, transacoes, categorias, orcamentos, relatorios y previsao.
5. Crear una transacao pequena y confirmar que vuelve a la lista sin error.
6. Revisar `logs/localhost-*.log` solo si algun servicio no responde.
