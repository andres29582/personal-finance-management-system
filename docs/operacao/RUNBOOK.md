# Runbook Operacional Local

Checklist para preparar uma entrega local confiavel do sistema financeiro.

## 1. Variaveis e base de dados

1. Copiar `backendnest/.env.example` para `backendnest/.env` se ainda nao existir.
2. Confirmar PostgreSQL ativo com a base indicada em `DB_NAME`.
3. Copiar `frontend/.env.example` para `frontend/.env` se ainda nao existir.
4. Confirmar que `EXPO_PUBLIC_API_URL=http://localhost:3000`.

## 2. Dados demo

O caminho oficial para carregar dados demo e:

```powershell
cd backendnest
npm run seed:demo
```

O seed recria o usuario demo se ele ja existir, por isso nao e destrutivo para outros usuarios.

Credenciales demo:

```text
Email: demo.financeiro@exemplo.com
Senha: Demo@123456
```

O seed deixa dados para dashboard, contas, transacoes, categorias, orcamentos, relatorios, metas, alertas, transferencias, dividas e previsao.

## 3. Checks antes de subir localhost

O comando principal a partir da raiz executa testes do backend, build do backend e testes do frontend:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\verify-all.ps1 -SkipLocalhost
```

Tambem e possivel executar passo a passo:

```powershell
cd backendnest
npm test -- --runInBand
npm run build

cd ..\frontend
npm test -- --runInBand
```

Se `npm run build` falhar com `EPERM` ao tentar apagar arquivos em `backendnest/dist`, feche processos locais de Node/Nest que possam estar usando o build anterior e repita o comando. O fluxo oficial deste checklist usa o build padrao.

## 4. Orden recomendado para demo

1. Confirmar PostgreSQL ativo com a base configurada em `backendnest/.env`.
2. Subir o backend e validar `GET /health`.
3. Subir o frontend e validar HTTP 200 em `http://localhost:8081`.
4. Subir o ML somente se a demo incluir previsao de deficit.

## 5. Subir servicos locais

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

ML opcional, somente para validar previsao de deficit com o servico externo ativo:

```powershell
cd ml-finance-tcc
python -m uvicorn api.app:app --host 0.0.0.0 --port 8000
```

URLs esperadas:

- Backend: `http://localhost:3000`
- Backend health: `http://localhost:3000/health`
- Frontend: `http://localhost:8081`
- ML opcional: `http://localhost:8000/health`

Os scripts padrao escrevem cache e build temporario em `%LOCALAPPDATA%\meu-sistema-financeiro` para evitar bloqueios de OneDrive. Os scripts `start:dev:standard` e `web:standard` ficam como fallback se o projeto for movido para fora do OneDrive.

## 6. Verificacion rapida

Con backend y frontend activos:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\verify-all.ps1
```

Para validar somente os endpoints HTTP:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\verify-localhost.ps1
```

Deve reportar HTTP 200 em `GET /health` do backend e no frontend.

## 7. Smoke manual minimo

Comandos exactos para validar desde PowerShell:

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 8
Invoke-WebRequest -Uri "http://localhost:8081" -UseBasicParsing -TimeoutSec 30
```

Se o ML estiver ativo:

```powershell
Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 8
```

Fluxo manual no navegador:

1. Abrir `http://localhost:8081`.
2. Entrar com o usuario demo.
3. Validar que o dashboard mostre saldos e cards com dados.
4. Navegar por contas, transacoes, categorias, orcamentos, relatorios e previsao.
5. Criar uma transacao pequena e confirmar que retorna para a lista sem erro.
6. Revisar `logs/localhost-*.log` somente se algum servico nao responder.
