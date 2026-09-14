# Runbook Operacional Local

Checklist para preparar uma entrega local confiavel do sistema financeiro.

## 1. Variaveis e base de dados

1. Copiar `backendnest/.env.example` para `backendnest/.env` se ainda nao existir.
2. Confirmar PostgreSQL ativo com a base indicada em `DB_NAME`.
3. Copiar `frontend/.env.example` para `frontend/.env` se ainda nao existir.
4. Confirmar que `EXPO_PUBLIC_API_URL=http://localhost:3000`.

Para o banco local, confirme no ambiente do backend:

```text
NODE_ENV=development
CORS_ORIGINS=http://localhost:8081,http://localhost:19006,http://localhost:3000
HTTP_BODY_LIMIT_BYTES=102400
DB_SSL_MODE=disable
```

Em qualquer ambiente exposto, use:

```text
NODE_ENV=production
CORS_ORIGINS=https://app.exemplo.com
HTTP_BODY_LIMIT_BYTES=102400
DB_SSL_MODE=verify-full
```

Em ambiente exposto, `CORS_ORIGINS` e obrigatoria, aceita apenas origens HTTPS
explicitas e nao aceita wildcard. Porta, payload e throttling invalidos fazem o
backend falhar antes de escutar conexoes. Requisicoes sem `Origin` continuam
suportadas; JSON e URL-encoded acima do limite retornam HTTP `413`.

`DB_SSL_CA_BASE64` e necessaria somente quando a cadeia da CA nao estiver no
trust store do sistema. Falhas de certificado nao devem ser contornadas com
`rejectUnauthorized=false`. Senhas e o conteudo da CA nao devem aparecer em
logs ou commits.

## Teste fisico com Expo Go na LAN

Use somente uma rede de desenvolvimento confiavel. Em outro dispositivo,
`localhost` aponta para o proprio telefone, nao para o computador.

### Caminho rapido

1. Descubra o IPv4 da rede Wi-Fi do computador:

   ```powershell
   ipconfig
   ```

2. Em `frontend/.env`, aponte a API para esse IPv4. Este arquivo e local e
   ignorado pelo Git:

   ```text
   EXPO_PUBLIC_API_URL=http://<HOST_LAN_IP>:3000
   ```

3. Confirme que PostgreSQL esta ativo e inicie o backend:

   ```powershell
   cd backendnest
   npm run start:dev
   ```

4. No telefone, conectado a mesma Wi-Fi, abra no navegador:

   ```text
   http://<HOST_LAN_IP>:3000/health
   ```

   A resposta deve conter `"status":"ok"`. Se nao responder, confirme que a
   rede do Windows esta marcada como **Privada** e permita Node.js/Nest e Expo
   no Firewall do Windows para redes privadas.

5. Em outro terminal, inicie o Expo em LAN:

   ```powershell
   cd frontend
   npm run start:standard -- --lan
   ```

   O script `npm run start` e otimizado para uso offline e nao pode combinar
   `--offline` com `--lan`; use `start:standard` apenas neste smoke test.

6. Abra Expo Go no telefone e escaneie o QR exibido pelo Expo. A confirmacao
   do QR, login e navegacao sao passos manuais no dispositivo e nao podem ser
   confirmados apenas pelo computador.

### Limite do smoke test

Valide login, dashboard, criacao de uma transacao pequena e retorno a lista.
Nao use dados financeiros reais, nem exponha o computador fora da rede local.

### Navegador no telefone (opcional)

Expo Go nativo nao envia `Origin`, portanto nao precisa de CORS adicional. Se
o frontend for aberto como site no navegador do telefone, inclua a origem LAN
exata em `backendnest/.env`, sem wildcard, e reinicie o backend:

```text
CORS_ORIGINS=http://localhost:8081,http://localhost:19006,http://localhost:3000,http://<HOST_LAN_IP>:8081
```

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
