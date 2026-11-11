# Sessões: logout confiável — etapa 2 / U2

**Estado em 2026-10-09: U2 encerrada no escopo local aprovado, após validação independente do candidato corrigido: 138/138 testes em 12 suites, exit 0; typecheck global exit 0, sem diagnósticos. Os 16 hashes permaneceram estáveis durante a validação. U3–U6 e etapa 2 não encerradas.**

O dispositivo não depende da disponibilidade do servidor para sair. Confirmação remota é separada da saída local: offline, timeout e rejeição não comprovam revogação. Resend permanece adiado; backend e banco não foram modificados.

## Ficha técnica

| Item | Implementação |
|---|---|
| Escopo | U2 do [plano de sessões](../planejamento/SEGURANCA_SESSOES_ETAPA_2.md), preservando U1 |
| Causa raiz | Home/dashboard aguardavam logout remoto antes de limpar dados e navegar; cliente compartilhado podia usar credenciais atuais/refresh; ausência de fence durável |
| Saída imediata | Generation avança e signed-out é publicado sincronamente; Home/dashboard limpam dados e navegam sem aguardar rede/storage; RootLayout reage antes de leituras pendentes |
| Storage | Fila persiste marcador não secreto `auth_signed_out=1` antes de remover tokens e usuário; cada remoção é tentada mesmo se outra falhar |
| Reload | Getters, snapshot e escrita de refresh respeitam tombstone; tokens legados sobreviventes não autorizam. Prova por reset de módulo, não browser/native real |
| Login novo | Instalação completa atual remove marcador depois das três escritas; rollback inclui marcador. Logout enfileirado precede novo login, inclusive quando B falha |
| Compatibilidade de storage | Escritores individuais ainda escrevem, mas não removem tombstone nem reabrem sessão; login real usa installSession. Fixtures usam instalação completa |
| Revogação | JWT antigo capturado na fila apenas quando disponível e sem instalação pendente; owner/sid seguem obtidos pelo guard, não pelo body |
| Transporte | POST /auth/logout existente, Axios dedicado com Authorization fixo e deadline/abort/timeout de 5 segundos; sem interceptores de sessão, refresh, retry, relogin ou fila persistente de segredos |
| Confirmação | HTTP 200 com contrato de sucesso/message; success:false e payload malformado não confirmam. Offline, timeout, 401, 429 e 503 são unconfirmed |
| Resultado | localDurable, cleanupComplete e remote: confirmed/unconfirmed. Falha do marcador bloqueia neste runtime, mas NÃO garante reload; falha de remoção informa segredos locais residuais |
| Conta B | Completion de A não apaga B, não envia JWT de B nem mostra aviso sobre B; chamadas repetidas na mesma generation compartilham operação |
| UI | Aviso português em Alert native/window.alert web, uma vez e somente na generation da saída; Home/dashboard cercam publicações atrasadas |
| Serviço legado | logoutSession delega ao coordenador seguro; sucesso somente com persistência/limpeza e confirmação. Caso contrário rejeita Error genérico; erro Axios bruto antigo não é preservado |
| Fora de escopo | Sem nova dependência, lockfile, DTO HTTP, endpoint, migration, DB, env, Resend, política de duração, commit ou deploy |

## Arquivos e rollback

- `frontend/storage/authStorage.ts`: estado local, tombstone, getters/refresh, limpeza e rollback.
- `frontend/src/modules/auth/services/logoutCoordinator.ts`: tentativa limitada, resultado e aviso.
- `frontend/src/modules/auth/services/authService.ts`: wrapper sem bypass inseguro.
- `frontend/src/modules/dashboard/screens/HomeScreen.tsx`: limpeza/navegação imediatas e fence de usuário.
- `frontend/src/modules/dashboard/hooks/useDashboardData.ts`: limpeza dos dados publicados e fence de carga.
- `frontend/src/navigation/RootLayout.tsx`: reação imediata e leitura antiga cercada.
- `frontend/__tests__/services/logout-coordinator.test.ts`, `logout-tombstone.test.ts`, `logout-consumers.test.tsx`: barreiras, transporte controlado, timeout, storage e consumidores reais.
- Fixtures existentes de authStorage, credential-session-races, home, dashboard e authService atualizadas sem remover cenários U1.

Rollback é a unidade de código/callers/testes acima, usando baseline de WIP em `.tmp/stage2-u2/original/`. Não apagar tombstone de usuários nem restaurar credenciais para reativar login automaticamente; qualquer rollback operacional deve preservar fence de saída e instalação completa. Não há rollback SQL.

## Evidência

RED comportamental inicial: token obsoleto exposto atrás de tombstone (1 falha). Durante implementação: 2 falhas / 20 aprovações demonstraram que falha de leitura da credencial impedia persistência do marcador e success:false era aceito como confirmação. Ambas corrigidas no limite central. Falha inicial por módulo novo inexistente não substitui a prova comportamental.

Normalização somente dos arquivos próprios com TypeScript instalado e indentação de 2 espaços, antes da prova final. Comandos, cwd frontend:

```text
npm test -- --runInBand --runTestsByPath __tests__/services/api.test.ts __tests__/services/credential-session-races.test.ts __tests__/services/session-consumer.test.tsx __tests__/storage/authStorage.test.ts __tests__/utils/api-error.test.ts src/modules/auth/__tests__/login.test.tsx __tests__/services/logout-coordinator.test.ts __tests__/services/logout-tombstone.test.ts __tests__/services/logout-consumers.test.tsx src/modules/dashboard/__tests__/home.test.tsx src/modules/dashboard/__tests__/dashboard.test.tsx src/modules/auth/__tests__/authService.test.ts
npm run typecheck
```

**Histórico interrompido do writer:** os logs reportaram 138/138 testes em 12 suites e nenhum diagnóstico TypeScript, mas os códigos de saída separados não foram preservados; essa execução não estava comprovada independentemente naquele momento. A prova atual vem da validação independente do sucessor em `.tmp/stage2-u2/correction-independent-verification.json`: **138/138, 12/12 suites, exit 0; typecheck global exit 0, zero diagnósticos**. Inclui as seis suites históricas de U1, login real, refresh 200/401 atrasado, instalação interrompida, logout→B que falha, reset de módulo, falha do marcador e de cada remoção nativa. Testes usam barreiras/relógio falso, sem rede real ou sleeps. Avisos conhecidos de act em Expo Icon na suite LoginScreen não foram ocultados ou corrigidos.

Evidências sanitizadas: `.tmp/stage2-u2/baseline.json`, `original/`, `red-tombstone.log`, `red-capture.log`, `normalization.json`, `tests-final.log`, `types-final.log`, `evidence.json` e `manifest.json`. Nenhuma credencial real nesses artefatos.

## Limites e próximo passo

- S2-05/S2-06 somente no cliente delimitado: sem PostgreSQL real/barreiras, browser offline/reload/multiaba ou dispositivo native. Não é aprovação integral da matriz.
- Tombstone é fence signed-out, não envelope completo ou mutex cross-tab. Depois de novo login, isolamento entre contextos antigos pertence a U3.
- Persistência pode aguardar SecureStore já em andamento. UI bloqueia imediatamente; durabilidade só é afirmada depois da escrita. Falha/hang de storage não garante reload.
- Offline não revoga no servidor: sessão pode permanecer válida em outro cliente até revogação/expiração. Não existe retry secreto posterior.
- Não executados: regressão inteira, export:web, servidor, dispositivo, acessibilidade real, carga, idle/absolute ou gestão de dispositivos. Startup autoritativo fica para unidades seguintes.

U2 está encerrada somente no alcance local aprovado. Próximo passo: aprovar U3 e suas decisões de plataforma/ambiguidade. Resend e entrega real da etapa 1 continuam pendentes.

## Correção delimitada após verificação independente — 2026-10-09

A primeira execução independente preservou os 16 hashes, mas terminou com 137/138 testes, 11/12 suites e um timeout no cenário HomeScreen; typecheck exit 0. Uma única reprodução instrumentada passou e confirmou montagem, usuário real, clique, entrada no adapter do coordenador e deadline. A causa temporal original não foi reproduzida e permanece não comprovada: não se declarou defeito de produto.

Somente o teste Home foi ajustado: montagem/carregamento terminam antes de ativar fake timers, entrada no transporte usa assertiva com espera limitada em vez de promise sem limite, ausência de aviso prematuro é conferida e timers/spy são restaurados em finally. Sem aumentar timeout, forçar captura de credencial, modificar código de produto ou simular o coordenador. Prova focada: 3/3, exit 0; nova regressão local exata de 12 suites: 138/138, exit 0; typecheck global exit 0. Evidências: `correction-diagnostic.log`, `correction-target.log`, `correction-tests.log`, `correction-types.log`, `correction-run.json` e `corrected-final.json` em `.tmp/stage2-u2/`. O manifesto original e a falha independente permanecem preservados.

Validação independente final: 138/138 testes em 12 suites, exit 0; typecheck global exit 0, zero diagnósticos; 16/16 hashes iguais antes/depois, sendo 13 caminhos inalterados em relação ao candidato original. O único delta de teste foi reconstruído contra o SHA original; sem aumento de timeout, alteração de produto, retry ou segunda revisão adversarial. A evidência está em `.tmp/stage2-u2/correction-independent-verification.json`. Este fechamento documental preserva os 14 hashes de código/testes do sucessor e registra somente os dois documentos em `.tmp/stage2-u2/documentary-closure.json`.
