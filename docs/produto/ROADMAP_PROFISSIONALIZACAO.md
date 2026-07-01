# Roadmap de Profissionalização do Sistema Financeiro

## 1. Objetivo da fase de profissionalização

Este roadmap consolida a fase de profissionalização anteriormente tratada como Opção D durante o planejamento inicial.

A fase de profissionalização define a Fase 2 de profissionalização do sistema financeiro com foco em converter o MVP atual em um projeto reproduzível, pronto para deploy, testável e apresentável como solução profissional.

O objetivo não é introduzir grandes mudanças funcionais nem refactors arquitetônicos profundos nesta etapa. A prioridade é criar uma base operacional confiável para que o sistema possa ser executado, validado, demonstrado e eventualmente publicado de forma consistente.

Esta fase prioriza:

- reproducibilidade local;
- documentação clara de ambientes;
- conteinerização gradual;
- migrações e seed demo controlados;
- CI/CD completo;
- segurança base;
- deploy demo;
- documentação operacional;
- avaliação futura de integrações Open Finance.

## 2. Estado atual do sistema

O repositório já contém uma base técnica avançada para um MVP acadêmico/profissional:

- Backend NestJS em `backendnest/`.
- Frontend Expo/React Native Web em `frontend/`.
- Módulo ML/FastAPI em `ml-finance-tcc/`.
- Base PostgreSQL modelada com TypeORM e migrações SQL versionadas.
- Autenticação com JWT, refresh token, sessões e recuperação de senha.
- Logs de auditoria consultáveis pelo usuário.
- Seed demo existente para carga de dados de apresentação.
- Testes unitários e de integração em backend, frontend e ML.
- Workflow inicial de GitHub Actions para frontend e backend.
- Documentação de arquitetura, demo, manual de usuário e estabilização local.

A Fase 1 arquitetônica já deixou implementados padrões importantes como Repository Pattern, exceções tipificadas e response wrapper. Por isso, a fase de profissionalização se apoia nessa base e muda o foco para operações, reprodutibilidade e entrega profissional.

## 3. Fortalezas já existentes

- Backend modular por domínios: auth, users, contas, categorias, transações, dashboard, orçamentos, relatórios, previsões, dívidas, metas, alertas, transferências e auditoria.
- TypeORM configurado com `synchronize: false`, reduzindo risco de alterações automáticas de schema.
- Migrações SQL versionadas em `backendnest/migrations/`.
- Segurança básica já presente no backend: `helmet`, CORS por lista branca, throttling global, `ValidationPipe` com whitelist e rejeição de campos extras.
- Autenticação com access token, refresh token, rotação de refresh token e persistência de sessões.
- Tokens sensíveis persistidos como hash no backend.
- Logs de auditoria com sanitização de campos sensíveis como token, senha/password, email e CPF.
- Frontend com separação progressiva entre rotas finas, módulos de domínio e camada compartilhada.
- Cliente Axios com unwrap do response wrapper e refresh automático de token.
- ML com contrato V2 estrito, validação de schema, manifesto de features e testes HTTP.
- Seed demo documentado em `docs/operacao/RUNBOOK.md`.
- CI inicial existente em `.github/workflows/ci.yml`.
- Documentação reutilizável para arquitetura, demo, frontend e fechamento da Fase 1.

## 4. Brechas técnicas principais

As brechas principais não são de funcionalidade de negócio, mas de preparação operacional:

- Não existe Dockerfile nem `docker-compose` para levantar o sistema completo de forma reproduzível.
- A CI atual não cobre o módulo ML nem uma execução E2E completa com PostgreSQL.
- Não existe uma estratégia formal de deploy demo.
- As migrações SQL existem, mas não há um fluxo único documentado e automatizável para aplicá-las em ambientes novos.
- O seed demo existe, mas precisa de contrato operacional: quando usar, onde, com quais variáveis e quais garantias oferece.
- `.gitignore` é mínimo e não protege suficientemente arquivos locais como `.env`, builds, caches ou artefatos temporários.
- Os `.env.example` existem, mas falta uma matriz formal de variáveis por ambiente e serviço.
- FastAPI ML permite CORS aberto, aceitável em local, mas não em um ambiente demo público.
- Swagger atual é estático e pode ficar dessincronizado do backend real.
- README de backend ainda conserva conteúdo genérico do starter de NestJS.
- Falta documentação operativa: runbook, rollback, troubleshooting, health checks e checklist pré-demo.
- Não há modelo formal de segurança base para segredos, CORS, logs, tokens, dependências e exposição pública.

## 5. Roadmap dividido em sprints

### Sprint 1: Configuração, gitignore, env examples e documentação de ambientes

Prioridade: Alta.

Objetivo: estabelecer uma base limpa e segura de configuração antes de contêineres ou deploy.

Alcance:

- Revisar e ampliar `.gitignore` para proteger `.env`, caches, builds, logs temporários e artefatos locais.
- Padronizar `.env.example` por serviço.
- Criar documentação de variáveis obrigatórias, opcionais e sensíveis.
- Definir matriz de ambientes: local, test, CI, demo e futuro production.
- Definir convenções de portas, URLs internas e URLs públicas.
- Documentar segredos que nunca devem ser versionados.

Critérios de aceitação:

- Existe uma documentação clara de variáveis por serviço.
- Um novo desenvolvedor pode preparar `.env` local sem adivinhar valores.
- `.env` reais e segredos ficam protegidos por `.gitignore`.
- A matriz de ambientes diferencia local, CI e demo.
- Não se modifica código-fonte nem dependências durante este sprint, salvo aprovação explícita.

### Sprint 2: Docker local com PostgreSQL, backend, ML API e frontend

Prioridade: Alta.

Objetivo: permitir levantar o sistema completo com um fluxo local reproduzível.

Alcance:

- Definir Dockerfile para backend.
- Definir Dockerfile para ML API.
- Definir estratégia para frontend web em modo desenvolvimento ou build estático, conforme necessidade.
- Criar `docker-compose` local com PostgreSQL, backend, ML API e frontend.
- Configurar healthchecks basicos.
- Definir rede interna entre serviços.
- Documentar comandos de início, parada, logs e troubleshooting.

Critérios de aceitação:

- O stack local levanta com um comando documentado.
- Backend consegue se conectar ao PostgreSQL do compose.
- Backend consegue consultar a ML API pelo nome do serviço interno.
- Frontend consegue consumir o backend pela URL configurada.
- Healthchecks de backend e ML respondem.
- O fluxo não exige instalar PostgreSQL local fora do Docker.

### Sprint 3: Migrações e seed demo reproduzível

Prioridade: Alta.

Objetivo: garantir que uma base nova possa passar de zero a demo funcional com passos controlados.

Alcance:

- Definir comando ou script oficial para aplicar migrações SQL em ordem.
- Documentar pré-condições de migração.
- Documentar rollback esperado ou estratégia de recuperação.
- Formalizar contrato do seed demo.
- Validar que o seed demo não afete usuários não-demo.
- Documentar credenciais demo e dados gerados.
- Integrar migrações e seed ao fluxo Docker local, sem transformá-lo ainda em deploy produtivo.

Critérios de aceitação:

- Uma base vazia pode ser inicializada com migrações em ordem.
- O seed demo deixa dados suficientes para dashboard, contas, transações, orçamentos, metas, dívidas, alertas e previsão.
- O usuário demo fica documentado.
- O seed é repetível sem destruir dados alheios.
- Existe documentação para resolver falhas comuns de migração.

### Sprint 4: CI/CD completo com backend, frontend, ML e E2E

Prioridade: Alta.

Objetivo: converter a validação automática em uma barreira confiável de qualidade.

Alcance:

- Manter lint, typecheck, testes e build de backend.
- Manter lint, typecheck e testes de frontend.
- Adicionar testes do módulo ML com `pytest`.
- Adicionar job de backend E2E com serviço PostgreSQL em CI.
- Separar jobs por responsabilidade e cachear dependências.
- Publicar artefatos úteis quando houver falha: logs, coverage ou relatórios básicos.
- Definir checks obligatorios para merge.

Critérios de aceitação:

- CI valida backend, frontend e ML.
- CI executa E2E contra PostgreSQL efêmero.
- Falhas entregam diagnóstico suficiente.
- Não há passos que modifiquem código durante CI.
- Os comandos de CI estão documentados e podem ser reproduzidos localmente.

### Sprint 5: Segurança base

Prioridade: Alta.

Objetivo: reduzir riscos evidentes antes de expor um deploy demo.

Alcance:

- Revisar CORS de backend e ML por ambiente.
- Revisar exposição de tokens no frontend web.
- Definir política mínima de segredos.
- Revisar logs para evitar dados sensíveis.
- Definir checklist OWASP basico para API.
- Revisar headers HTTP.
- Revisar rate limiting e endpoints públicos de auth.
- Definir prática de secret scanning antes de deploy.
- Revisar dependências com auditoria disponível do ecossistema.

Critérios de aceitação:

- CORS não fica aberto em ambiente demo.
- Variáveis sensíveis são documentadas como segredos.
- Segredos reais não são impressos em logs de deploy.
- Endpoints públicos ficam inventariados.
- Existe checklist de segurança base antes de demo.

### Sprint 6: Deploy demo

Prioridade: Média-Alta.

Objetivo: publicar uma versão demo estável para apresentação profissional.

Alcance:

- Escolher estratégia de hosting para backend, frontend, ML e PostgreSQL.
- Definir se o ML será implantado como serviço separado ou ficará opcional para demo.
- Configurar variáveis do ambiente demo.
- Executar migrações em demo.
- Cargar seed demo controlado.
- Validar smoke test post-deploy.
- Documentar URLs públicas e credenciais demo.
- Definir critério de disponibilidade mínima para apresentação.

Critérios de aceitação:

- Existe uma URL demo documentada para frontend.
- Backend demo responde health check.
- ML demo responde health check se estiver incluído no alcance.
- Usuário demo consegue iniciar sessão.
- Dashboard muestra datos.
- Fluxo mínimo de demo funciona: login, dashboard, contas, transações, relatórios e previsão se ML estiver ativo.
- Existe procedimento de redeploy ou recuperação.

### Sprint 7: Documentação operacional

Prioridade: Média.

Objetivo: deixar o projeto compreensível, manutenível e demonstrável sem depender de memória informal.

Alcance:

- Criar runbook local.
- Criar runbook de demo.
- Criar guia de troubleshooting.
- Criar checklist pre-demo.
- Atualizar README raiz.
- Substituir conteúdo genérico do README de backend por conteúdo específico do projeto.
- Consolidar referencias a docs existentes.
- Documentar arquitectura final de Fase 2.

Critérios de aceitação:

- Um terceiro pode levantar o projeto localmente seguindo a documentação.
- Uma terceira pessoa pode executar a demo seguindo um roteiro claro.
- Problemas comuns têm passos de diagnóstico.
- README raiz explica stack, arquitetura, comandos e docs principais.
- README de backend deixa de depender do texto genérico do starter.

### Sprint 8: Avaliação futura de Open Finance

Prioridade: Média-Baixa.

Objetivo: avaliar integração futura com Open Finance sem comprometer a segurança nem o alcance atual.

Alcance:

- Investigar requisitos técnicos e regulatórios de Open Finance.
- Separar dados manuais atuais de dados importados futuros.
- Identificar domínios impactados: contas, transações, consentimentos, auditoria e privacidade.
- Definir riscos de privacidade, consentimento, retenção e revogação.
- Propor uma arquitetura inicial de integração futura.
- Criar ADR de decisão: integrar agora, postergar ou simular com importação controlada.

Critérios de aceitação:

- Existe documento de avaliação com opções e riscos.
- Integrações reais não são implementadas nesta fase.
- Define-se quais dados poderiam ser importados e sob quais regras.
- São identificadas dependências legais e de segurança antes de qualquer desenvolvimento.

## 6. Prioridade de cada sprint

| Sprint | Tema | Prioridade | Razão |
| --- | --- | --- | --- |
| 1 | Configuração e ambientes | Alta | Base necessária para evitar erros e segredos expostos |
| 2 | Docker local | Alta | Reprodutibilidade do sistema completo |
| 3 | Migrações e seed demo | Alta | Demo confiável a partir de base limpa |
| 4 | CI/CD completo | Alta | Qualidade automatizada antes de deploy |
| 5 | Segurança base | Alta | Requisito antes de expor demo |
| 6 | Deploy demo | Média-Alta | Entrega apresentável e validável |
| 7 | Documentação operativa | Média | Sustentabilidade e transferência |
| 8 | Open Finance futuro | Média-Baixa | Exploratório, não bloqueia a profissionalização inicial |

## 7. Critérios de aceitação gerais

A fase de profissionalização se considera completada quando:

- O projeto pode ser levantado localmente com documentação clara.
- Existe um fluxo Docker local funcional para os serviços principais.
- Um banco PostgreSQL vazio pode ser inicializado com migrações e seed demo.
- CI valida backend, frontend, ML e E2E.
- Existe uma versão demo publicada ou um procedimento de deploy demo validado.
- Os segredos e variáveis de ambiente estão documentados e não versionados.
- CORS, logs e endpoints públicos têm uma revisão mínima de segurança.
- A documentação permite operar o projeto sem depender do autor original.
- Fica documentada a decisão sobre Open Finance como avaliação futura, não como implementação imediata.

## 8. Fora do alcance por enquanto

Não fazem parte da fase de profissionalização inicial:

- Implementar CQRS em módulos de negócio.
- Adicionar Redis cache.
- Migrar de TypeORM para outro ORM.
- Implementar microserviços.
- Implementar Open Finance real.
- Implementar OAuth bancário ou integrações externas reguladas.
- Criar apps nativas publicadas em stores.
- Refazer a UI completa.
- Alterar o modelo ML ou reentrená-lo com dados reais.
- Implementar observabilidad avanzada con OpenTelemetry, Prometheus o Grafana.
- Automatizar deploy productivo multiambiente con alta disponibilidad.
- Introduzir grandes mudanças funcionais de negócio.

Esses temas podem ser avaliados em fases posteriores, quando a base operacional já estiver estável.

## 9. Riscos técnicos

- Docker pode revelar inconsistências de configuração local que hoje estão ocultas por execuções manuais.
- Migrações SQL manuais podem falhar em bancos parcialmente inicializados se não for definido um runner e um estado esperado.
- E2E em CI pode ser sensível a tempos de inicialização do PostgreSQL.
- ML usa artefatos `pickle/joblib`; isso exige controle estrito da origem dos modelos carregados.
- CORS aberto em ML não deve chegar à demo pública.
- Tokens em `localStorage` são uma superfície de risco para frontend web se houver XSS.
- O seed demo imprime credenciais; deve se limitar a ambientes controlados.
- Swagger estático pode ficar desatualizado em relação à API real.
- O deploy demo pode introduzir diferenças entre Windows local e Linux remoto.
- Adicionar CI completo pode revelar dívida de testes intermitentes ou dependências implícitas.

## 10. Próximos passos recomendados

1. Aprovar a fase de profissionalização como alcance oficial da Fase 2.
2. Criar issues por sprint com critérios de aceitação concretos.
3. Executar Sprint 1 antes de qualquer Docker ou CI novo.
4. Definir quem será owner de configuração, Docker, CI, segurança e documentação.
5. Manter mudanças pequenas e revisáveis por sprint.
6. Evitar misturar refactors de negócio com infraestrutura.
7. Registrar decisões importantes como ADRs.
8. Validar cada sprint com uma demo técnica curta.
9. Somente depois do Sprint 6 avaliar se convém retomar CQRS, Redis ou observabilidade avançada.
10. Manter Open Finance como investigação documentada até que existam requisitos legais, técnicos e de segurança suficientes.
