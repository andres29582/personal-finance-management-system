# Runbook Operacional Local

Checklist para preparar uma entrega local confiavel do sistema financeiro.

## Ensaio de recuperacao antes da sincronizacao

O teste `backendnest/test/backup-restore.e2e-spec.ts` cria bases exclusivas com
nomes aleatorios e dados ficticios. Nao le nem copia a base da aplicacao.
Antes do comando, confirme servidor, porta e role autorizados para criar/remover
recursos temporarios; pare se esse destino ou permissao nao estiver confirmado.
Execute `npm run test:e2e -- --testPathPatterns=backup-restore` no backend com
`E2E_DB_HOST`, `E2E_DB_PORT`, `E2E_DB_USERNAME`, `E2E_DB_PASSWORD` e, se necessario,
`E2E_DB_ADMIN_DATABASE`. A role de setup cria/remove somente bases e uma role
de login aleatorias do ensaio; a role ficticia usa senha ASCII temporaria,
permissoes SELECT na origem e ownership do destino, sem superuser/CREATEDB.
Defina `PG_TOOLS_DIRECTORY` como o diretorio de `pg_dump` e `pg_restore` quando
nao estiverem no PATH. O ensaio exige clientes da mesma versao principal do
servidor; ferramentas ausentes/incompativeis falham, nao ignoram o teste.

O arquivo custom e escrito diretamente por `pg_dump --format=custom --file`,
fora do repositorio. Nao redirecione binarios com PowerShell. O restore usa
`--exit-on-error --single-transaction --no-owner --no-privileges` somente para
mapear ownership/permissoes para a role ficticia. Constraints nao sao desativadas.
Compara esquema, constraints validadas, todas as linhas, valores exatos e saldos
com ajustes, comissao, pagamento de divida e registros excluidos logicamente.
Tambem verifica que um arquivo truncado falha. Remove apenas recursos criados
pelo proprio teste. Nunca execute o helper que recria `public` sobre um restore.

Uma recuperacao de dados reais exige autorizacao separada com origem e destino
nomeados. Use um backup confiavel: restore pode executar codigo da origem.
Armazene-o fora do Git, com acesso privado, criptografia e retencao definidos;
senhas, hashes, tokens e dados financeiros tambem fazem parte do backup.
Verifique versoes e extensoes antes: cliente antigo nao exporta servidor mais
novo; restore em servidor mais antigo nao e garantido. `pg_dump` copia uma base,
nao roles/globais: documente a politica de ownership e permissoes reais.
Restaure numa base nova, vazia e identificada; nao use `--clean` nem a base local
em uso. Compare schema, constraints, contagens, somas exatas e saldos esperados
numa janela sem escritas, para nao comparar snapshots de momentos diferentes.
Um arquivo criado ou `pg_restore --list` nao comprova recuperacao. O diagnostico
`data:check` deve ser repetido no clone; gaps conhecidos permanecem bloqueios.

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

Antes de executar, confirme host, porta, role e `DB_NAME` efetivamente usados
pelo backend, incluindo ambiente do processo e `.env`. Use somente base local
de demonstracao autorizada, sem dados reais. O
[seed](../../backendnest/src/scripts/seed-demo-profile.ts) **exclui o usuario
`demo.financeiro@exemplo.com` existente e recria seu perfil e dados**.
Ele nao visa outros usuarios, mas isso nao torna a operacao somente leitura.
Pare se houver dados demo a preservar ou destino desconhecido; nao use E2E
para tentar recuperar o seed. Os passos nao garantem rollback global em falha.

Depois dessas confirmacoes, o caminho para carregar dados demo e:

```powershell
cd backendnest
npm run seed:demo
```

Resultado esperado: seed encerra com codigo zero e o perfil demo permite o
smoke manual abaixo. Se falhar, pare, registre a etapa sem credenciais e
investigue dados parciais antes de repetir. Uma nova execucao pode recriar o
perfil novamente; nao e recuperacao de dados anteriores.

Credenciales demo:

```text
Email: demo.financeiro@exemplo.com
Senha: Demo@123456
```

O seed deixa dados para dashboard, contas, transacoes, categorias, orcamentos, relatorios, metas, alertas, transferencias, dividas e previsao.

## 3. Checks antes de subir localhost

Pre-requisitos: dependencias instaladas, diretorio correto e permissao para
gerar build/cache locais. O [script](../../scripts/verify-all.ps1), a partir da
raiz, executa unitarios do backend, build do backend e testes do frontend.
Nao executa lint, typecheck, E2E ou ML e nao substitui toda a CI.
`-SkipLocalhost` omite somente HTTP; nao torna a execucao sem escrita:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\verify-all.ps1 -SkipLocalhost
```

Tambem e possivel executar passo a passo:

```powershell
cd backendnest
npm run lint:check
npm run typecheck
npm test -- --runInBand
npm run build

cd ..\frontend
npm test -- --runInBand
```

Resultado esperado: cada comando termina com codigo zero; o script imprime
`Verification completed.` apenas ao concluir suas etapas. Em execucao manual,
pare na primeira falha. Os checks de lint/tipos nao aplicam autofix; build
escreve compilacao. Para alcance e warnings, consultar
[TESTES.md](../desenvolvimento/TESTES.md) e
[comandos do backend](../../backendnest/README.md).

Se `npm run build` falhar com `EPERM` ao tentar apagar arquivos em `backendnest/dist`, feche processos locais de Node/Nest que possam estar usando o build anterior e repita o comando. O fluxo oficial deste checklist usa o build padrao.

### E2E, migrations e recuperacao: limites de autorizacao

- E2E comuns exigem destino PostgreSQL descartavel confirmado por host, porta,
  role e base, separado da aplicacao e de clones de restore. Defina os seis
  `E2E_DB_*` indicados em [TESTES.md](../desenvolvimento/TESTES.md); o helper pode
  herdar credenciais de `DB_*`/`.env`. Nome contendo `test` nao prova isolamento.
- O [helper E2E](../../backendnest/test/e2e-database.ts) pode criar a base e
  executa `DROP SCHEMA public CASCADE`, recria o esquema e aplica migrations.
  Pare antes do comando se nao houver autorizacao para descartar todo o esquema.
  Sucesso significa suites selecionadas aprovadas nesse destino, nao base real
  atualizada nem seguro upgrade de dados existentes.
- O ensaio de backup/restore acima cria recursos proprios. Exige permissao
  explicita para criar/remover bases e a role temporaria no servidor indicado.
  Seu sucesso com dados ficticios nao certifica backup, restore ou sincronizacao
  de dados reais; uma falha exige investigar, nao apontar para a base da aplicacao.
- Para esquema existente, seguir os procedimentos de
  [migrations e diagnostico](../../backendnest/README.md): confirmar destino e
  arquivos realmente pendentes, sem reaplicar toda a lista. `ON_ERROR_STOP=1`
  interrompe comandos seguintes; nao reverte SQL ja confirmado. Nao adicionar
  uma transacao global sobre scripts com fronteiras proprias.
- Diagnostico somente leitura nao autoriza correcao, restore ou sincronizacao.
  Em falha operacional, interromper escritas e decidir recuperacao separadamente,
  com origem/destino identificados; nunca usar o reset E2E como reparo.

Registrar comando, revisao, data, ambiente/destino autorizado e resultado.
Nao incluir senhas, tokens, dumps ou dados financeiros na evidencia versionada.
Nao ha comprovacao de operacao real por existirem comandos ou testes neste guia.

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

O script consulta apenas `GET /health` do backend e a pagina do frontend;
aceita status 200 a 399 e reporta cada resposta. Em falha, interrompe com codigo
nao zero: investigar URL/servico antes de prosseguir. Nao verifica login,
persistencia nem ML; HTTP acessivel nao equivale a smoke funcional aprovado.

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
