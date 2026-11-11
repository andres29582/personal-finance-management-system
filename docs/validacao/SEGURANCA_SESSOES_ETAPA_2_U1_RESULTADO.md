# Sessões: isolamento de erros e respostas — etapa 2 / U1

**Estado em 2026-10-08: U1 encerrada no escopo local aprovado, com verificação independente do candidato estendido: typecheck global sem diagnósticos e 80/80 testes, incluindo 9/9 da tela real. Bloqueio de GlassField resolvido; U2–U6 e etapa 2 não encerradas.**

O cliente não deve confundir indisponibilidade com credenciais revogadas, nem
entregar respostas de uma conta anterior à conta atual. Esta unidade corrige
essas fronteiras no cliente compartilhado e instala o login de forma coerente
no mesmo runtime. Resend continua adiado; nenhum backend ou banco foi alterado.

## Ficha técnica

| Item | Implementação |
|---|---|
| Escopo aprovado | U1 de [sessões completas e confiáveis](../planejamento/SEGURANCA_SESSOES_ETAPA_2.md), achados F1/F6 |
| Causa raiz F1 | `resolveApiError` apagava a sessão em qualquer 401, ignorando a classificação e os guards do coordenador |
| Causa raiz F6 | Somente parte dos erros possuía fence; sucessos atrasados eram entregues; login publicava o access token antes dos outros campos |
| Erros | Resolver sem alterações de storage; falha temporária indica indisponibilidade, não expiração; cancelamento/resposta obsoleta não exige login nem exibe mensagem antiga |
| Identidade | Generation e snapshot de refresh capturados no request original; não substituídos pela identidade atual ao receber a resposta |
| Sucesso | Response interceptor rejeita sucesso de generation antiga antes de entregar dados ao serviço/consumidor |
| Terminal | Rejeição do refresh só vira 401 terminal após clearing confirmado do snapshot correspondente; CAS perdido e credenciais já avançadas viram resultado local obsoleto |
| Login | `installSession` valida os três campos, serializa instalação, publica uma única alteração completa e verifica generation antes/depois das operações assíncronas |
| Storage | Leituras de token/refresh/usuário compartilham a fila; falha de escrita tenta restaurar o snapshot anterior sem publicar login parcial; falha do próprio rollback oculta a sessão neste runtime |
| Compatibilidade | DTOs HTTP, chaves de armazenamento e assinaturas existentes preservados; instalação coerente é aditiva; login usa o novo método |
| Reparação autorizada de UI | Imports e declaração antiga duplicados, mais JSX antigo antes do wrapper atual impediam parse de `GlassField.tsx`; remoção de 8 linhas obsoletas, preservando props, ícones/ação, foco, estilos, acessibilidade e corpo de `GlassField` |
| Blast radius de UI | GitNexus upstream de `GlassTextInput`: CRITICAL, 23 callers diretos e 19 entradas de processos afetados; aviso reconhecido antes da correção mínima |
| Dependências | Nenhuma nova instalação ou alteração de lockfile |
| Backend/DB | N/A nesta unidade: sem API, migration, conexão, DML ou configuração alterados |
| Entrega | Sem commit, deploy, email real ou mudança de política de duração |

### Arquivos da unidade

- `frontend/src/shared/services/api.ts`: metadados imutáveis, fence de sucesso/erro e classificação de refresh.
- `frontend/utils/api-error.ts`: apresentação de erros sem clearing global.
- `frontend/utils/session-error.ts`: resultados locais `stale`/`unavailable`, sem resposta HTTP 401 fictícia.
- `frontend/storage/authStorage.ts`: instalação completa e leituras serializadas.
- `frontend/src/modules/auth/screens/LoginScreen.tsx`: instalação única antes da navegação.
- `frontend/__tests__/services/credential-session-races.test.ts`: barreiras e regressões de ownership/storage.
- `frontend/__tests__/services/session-consumer.test.tsx`: API real com adapter controlado → resolver → consumidor React renderizado.
- `frontend/__tests__/utils/api-error.test.ts`: contrato sem efeitos colaterais.
- `frontend/src/modules/auth/__tests__/login.test.tsx`: tela real, instalação aguardada antes da navegação, resultado superado e falha sem navegação; sem writers legados.
- `frontend/src/shared/ui/GlassField.tsx`: reparação exclusivamente sintática dos fragmentos duplicados do WIP existente.

## Evidência e limites

RED antes da correção: **2 falhas / 9 aprovações** no resolver e **8 falhas /
7 aprovações** nas regressões de corrida. As falhas mostraram clearing universal,
classificação indevida de quatro falhas de refresh, exposição de sucesso antigo,
erro obsoleto e ausência de instalação coerente. Depois foram adicionadas provas
de cada escrita nativa, leitores bloqueados e instalação superada por logout.

Comando de regressão delimitada, `cwd: frontend`:

```text
npm test -- --runInBand --runTestsByPath __tests__/services/credential-session-races.test.ts __tests__/services/session-consumer.test.tsx __tests__/services/api.test.ts __tests__/storage/authStorage.test.ts __tests__/utils/api-error.test.ts
```

**Prova independente do candidato congelado: 71/71 testes, 5/5 suites, exit 0.**
Inclui refresh 200/401 obsoleto na mesma generation. As 11 hashes permaneceram
iguais antes/depois da verificação. Revisão delimitada do código conectado não
identificou defeitos obrigatórios causados pelo candidato; isso não aprova as
integrações bloqueadas nem o restante da etapa. Evidência sanitizada:
`.tmp/stage2-u1/verification.json`.

Cobertura delimitada: refresh offline/429/500/503 passando pelo resolver;
sucesso/401/500 atrasados após troca A→B; CAS de refresh antigo; erro terminal
atual; login público rejeitado; senha atual inválida sem logout; rollback nas
escritas nativas 1/2/3; leitores aguardam instalação; logout vence instalação.
Consumidor React demonstra mensagem de indisponibilidade sem pedir login e
ausência de payload A após instalação B. **Não é navegador nem dispositivo real.**

### Bloqueios históricos da primeira verificação independente

- `npm run typecheck` falhou no arquivo não pertencente a U1
  `src/shared/ui/GlassField.tsx:68` (TS2657) e `:159` (TS1005), exit 1.
- A tentativa incluindo `src/modules/auth/__tests__/login.test.tsx` não conseguiu
  carregar a suite: import duplicado `ReactNode` em `GlassField.tsx:3`.
  **Zero testes executados nessa suite**; o callback real de LoginScreen não foi
  comprovado naquele candidato. A primeira verificação confirmou que esse arquivo externo permaneceu intacto.
  Não removemos nem corrigimos esse trabalho externo para fabricar aprovação.
- Checagem TypeScript delimitada dos quatro módulos centrais, incluindo
  `expo-env.d.ts` e as opções existentes do projeto: zero diagnósticos na última
  execução independente (exit 0); não substitui typecheck global nem prova da
  tela real de login.
- Browser, múltiplas abas, armazenamento real native, HTTP/DB e regressão global
  não executados. A verificação independente foi somente local e delimitada.

### Prova local e independente após reparação autorizada

RED da reparação: parse TypeScript de `GlassField.tsx` reproduziu TS2657 na
linha 68 e TS1005 na linha 159 (exit 1). A correção removeu somente 8 linhas
obsoletas; nenhum componente foi restaurado de HEAD nem redesenhado. Não foi
encontrado teste específico de GlassField; a tela real exercita os inputs com
ícones e ação de visibilidade. Sem mudança de lógica de UI.

Comandos efetivamente executados, `cwd: frontend`:

```text
npm run typecheck
npm test -- --runInBand --runTestsByPath __tests__/services/credential-session-races.test.ts __tests__/services/session-consumer.test.tsx __tests__/services/api.test.ts __tests__/storage/authStorage.test.ts __tests__/utils/api-error.test.ts src/modules/auth/__tests__/login.test.tsx
```

- TypeScript global: **exit 0, zero diagnósticos**; parse e imports desbloqueados.
- Jest: **80/80 testes, 6/6 suites, exit 0**, incluindo **9/9 da tela real LoginScreen**.
- O callback real aguarda uma instalação controlada pendente: não navega antes
  de `true`; `false` (superada) e rejeição não navegam. Generation concreta e
  ausência dos três writers legados são verificadas. Storage é mockado nesta
  suite de UI; publicação, rollback e concorrência do storage real continuam
  cobertos nas suites existentes, não são prova de dispositivo real.
- A primeira execução após o parse aprovou os 7 testes existentes de login;
  as duas regressões adicionadas e a barreira de instalação reforçam cobertura,
  sem alteração de LoginScreen ou simulação de publicação pelo mock.
- Warnings assíncronos de `act` nos ícones Expo existentes permanecem visíveis;
  não foram silenciados e não fizeram o processo falhar.
- Evidência e hashes desta extensão: `.tmp/stage2-u1-glassfield/`.
  A prova independente histórica de 71 testes permanece separada e intacta.
  **Verificação independente do candidato estendido aprovada:** typecheck
  global exit 0, zero diagnósticos; 80/80 testes em 6/6 suites (9/9 LoginScreen),
  exit 0. As 12 hashes permaneceram iguais antes/depois; `git diff --check`
  delimitado aprovou. Revisão do código conectado não identificou defeitos
  obrigatórios causados pelo candidato; confirmou reparação de 8 linhas removidas,
  zero adicionadas e preservação do wrapper/comportamento canônico.
  Evidência: `.tmp/stage2-u1-glassfield/independent-verification.json`.
  O fechamento documental posterior preserva as 10 hashes não documentais em
  `.tmp/stage2-u1-glassfield/documentary-closure.json`, sem reescrever o freeze.
- Sem browser/múltiplas abas, native real, HTTP/DB, export/build global ou
  regressão completa. Backend, ambiente, Resend, dependências, U2–U6 e deploy
  não foram alterados. Nenhum commit criado.

## Compatibilidade e risco residual

Não alteramos a política de replay existente após 401. A classificação segura
não resolve concorrência de rotação entre abas nem impede o servidor de revogar
uma sessão quando um refresh antigo é reapresentado: essa correção é U3. Falhas
de rede continuam sem prova sobre commit de rotação; U1 conserva o snapshot e
não faz retry adicional nesta falha, mas a política de resultado desconhecido
continua pendente de decisão em U3.

As três chaves antigas continuam existentes. Fila e rollback são garantias do
runtime atual, não transação durável, envelope versionado ou garantia perante
crash/reload/outra aba. Quarentena após rollback falho também é local ao runtime.
Caches/dados já entregues antes de uma mudança de identidade e validação
autoritativa no startup precisam das unidades seguintes; não alegamos cobertura
de S2-01/S2-02 em navegador nem fechamento de toda a matriz S2.

## Rollback e próximo passo

Reverter como unidade somente os deltas de API, resolver/erro local, instalação,
LoginScreen e suas regressões; preservar alterações anteriores nos mesmos
arquivos. Nenhum rollback de banco ou alteração de credencial é necessário.
Retirar apenas `installSession` sem ajustar LoginScreen quebra o contrato local.
A extensão de reparação é reversível pelo delta de 8 linhas de GlassField e
pelas regressões adicionais de login, usando o baseline próprio, sem substituir
arquivos inteiros ou descartar o WIP anterior.

1. Preservar as provas independentes e a cronologia dos bloqueios históricos resolvidos.
2. U1 está encerrada somente no escopo local aprovado; browser/native/DB e a matriz completa não estão comprovados.
3. Aprovar e executar U2; resolver decisões antes de U3–U5.
4. Manter Resend pendente e não declarar a etapa 2 encerrada.
