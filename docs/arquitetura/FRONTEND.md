# Arquitetura do frontend

Este documento descreve a arquitetura do frontend Expo do sistema de gestao
financeira pessoal. Ele complementa o guia operacional em
[frontend/README.md](../../frontend/README.md) e os documentos especificos de
design system, dashboard e testes.

O foco aqui e explicar a organizacao tecnica, os fluxos principais e os pontos
de manutencao mais sensiveis, sem repetir comandos de instalacao ou execucao.

## Visao geral

O frontend fica em `frontend/` e usa Expo Router com React Native para entregar
uma experiencia web/mobile. A arquitetura separa rotas, telas de dominio,
servicos de API, infraestrutura compartilhada e componentes visuais.

A decisao estrutural mais importante e manter `frontend/app/` como camada fina
de roteamento. Os arquivos de rota exportam telas reais que vivem em
`frontend/src/modules` ou componentes de navegacao em `frontend/src/navigation`.
Isso reduz acoplamento com o Expo Router e facilita testar telas, hooks e
services fora da camada de rota.

## Stack tecnica

- **Expo**: runtime e tooling de desenvolvimento.
- **React Native**: componentes nativos/web e modelo visual.
- **Expo Router**: roteamento file-based em `frontend/app`.
- **TypeScript**: contratos de tela, DTOs, services, builders de teste e tipos
  de dominio.
- **axios**: API client HTTP com interceptors.
- **expo-secure-store**: armazenamento seguro de tokens em plataformas nativas.
- **localStorage no web**: fallback usado pelo storage de auth quando
  `Platform.OS === 'web'`.
- **Jest e Testing Library React Native**: testes de services, storage,
  navegacao e telas.

## Organizacao de pastas

```text
frontend/
  app/                  # rotas finas do Expo Router
  src/
    navigation/         # RootLayout, guards e decisao inicial de rota
    modules/            # telas, services, types e testes por dominio
    shared/             # API client, UI compartilhada, tema, hooks e builders
  storage/              # armazenamento de sessao/autenticacao
  services/             # shims de compatibilidade para imports legados
  types/                # shims de compatibilidade para imports legados
  hooks/                # shims de compatibilidade para imports legados
```

Novas regras de tela, service ou tipo devem entrar em `src/modules` ou
`src/shared`. As pastas raiz `services/`, `types/` e `hooks/` existem para
compatibilidade temporaria com imports antigos e nao devem receber nova regra de
negocio.

`frontend/components` tambem deve ser tratado como camada legada ou de
compatibilidade quando houver alternativa em `src/shared/ui`. Novos componentes
reutilizaveis devem nascer em `src/shared/ui`; componentes especificos de
dominio devem nascer em `src/modules/<dominio>/components`.

Regra de manutencao para pastas raiz legadas:

- nao criar novas features em `frontend/services`, `frontend/types`,
  `frontend/hooks` ou `frontend/components`;
- nao mover codigo de dominio novo para a raiz do frontend;
- manter shims apenas enquanto imports antigos dependerem deles;
- remover shims somente com teste, typecheck e lint passando;
- preferir `src/modules` para dominio e `src/shared` para infraestrutura.

## Rotas, modulos e navegacao

As rotas em `app/` refletem as telas do produto: login, cadastro, dashboard,
contas, transacoes, transferencias, dividas, pagamentos de divida, categorias,
orcamentos, metas, alertas, relatorios, previsao de deficit, auditoria e
perfil do usuario.

Cada dominio principal possui um modulo em `src/modules/<dominio>` com uma
combinacao de:

- `screens/`: tela real renderizada pela rota;
- `services/`: funcoes HTTP tipadas;
- `types/`: tipos do dominio e DTOs de resposta/request;
- `components/`: componentes especificos do dominio;
- `hooks/`: estado local ou coordenacao de dados;
- `__tests__/`: testes de tela, service ou mappers.

Padrao recomendado para novos modulos:

```text
src/modules/<dominio>/
  screens/
  services/
  types/
  components/
  hooks/
  __tests__/
```

Nem todo modulo precisa criar todas as pastas de inicio. A pasta deve existir
quando houver responsabilidade real para ela.

A navegacao autenticada usa itens compartilhados em
`src/shared/navigation/financeNavigation.ts`. Essa lista alimenta o shell
financeiro compartilhado e evita que cada tela recrie manualmente a sidebar.

## Fluxo de autenticacao e protecao de rotas

O ponto central de navegacao e `src/navigation/RootLayout.tsx`, exportado por
`app/_layout.tsx`.

O fluxo de protecao e:

1. `RootLayout` le o access token salvo em `storage/authStorage.ts`.
2. Enquanto a sessao e verificada, renderiza `AppLoading`.
3. Rotas publicas, como login, cadastro, recuperacao de senha e privacidade,
   podem renderizar sem token.
4. Usuario sem token em rota protegida e redirecionado para `/login`.
5. Usuario autenticado em rota de entrada, como `/` ou `/login`, e
   redirecionado para `/dashboard`.
6. `RootLayout` assina `subscribeAuthState` para reagir a login, logout,
   refresh bem-sucedido ou limpeza de sessao.

`authStorage.ts` encapsula access token, refresh token e usuario logado. Em web
usa `localStorage`; em plataformas nativas usa `expo-secure-store`. O storage
tambem valida o shape do usuario antes de devolver dados salvos.

## Integracao com o backend

A integracao HTTP principal fica em `src/shared/services/api.ts`.

O API client:

- define `baseURL` por `EXPO_PUBLIC_API_URL`, com fallback para
  `http://localhost:3000`;
- injeta `Authorization: Bearer <access_token>` nas chamadas protegidas;
- desempacota respostas do backend no formato `{ success: true, data }`;
- ignora refresh automatico para endpoints publicos de auth;
- trata `401` tentando renovar a sessao com `POST /auth/refresh`;
- serializa o refresh em uma unica `refreshPromise`, reduzindo corrida entre
  multiplas chamadas simultaneas;
- limpa a sessao quando o refresh token nao existe ou quando a renovacao falha;
- faz retry da requisicao original uma vez com o novo access token.

Services de dominio importam esse client e mantem o restante da aplicacao longe
dos detalhes de axios/interceptors. Exemplos: `authService`, `dashboardService`,
`contaService`, `transacaoService`, `previsaoService` e services financeiros
equivalentes.

A arquitetura deve acompanhar o contrato documentado em
[BACKEND.md](BACKEND.md), especialmente autenticacao,
respostas globais e endpoints financeiros.

## Telas principais

O frontend organiza as telas por dominio:

- **Auth**: login, cadastro, recuperacao de senha, reset autenticado e reset
  por token.
- **Dashboard**: resumo financeiro, planejamento, metas, ultimas transacoes e
  atalhos de navegacao.
- **Contas**: listagem, criacao e edicao.
- **Transacoes**: listagem, filtros, criacao, edicao e remocao.
- **Transferencias**: movimentacao entre contas.
- **Dividas e pagamentos**: ciclo de dividas e pagamentos associados.
- **Categorias**: categorias de receita/despesa.
- **Orcamentos, metas e alertas**: planejamento e acompanhamento financeiro.
- **Relatorios**: agregacoes por periodo.
- **Previsao de deficit**: leitura do endpoint de ML via backend.
- **Audit logs**: consulta de eventos de auditoria do usuario.
- **Usuario**: perfil, atualizacao e consulta de CEP.

Essa divisao permite evoluir telas financeiras sem misturar regras de dominio
em arquivos de rota ou no layout raiz.

## Dashboard financeiro

O dashboard e a tela mais composta do frontend e fica em
`src/modules/dashboard`.

`DashboardScreen` e responsavel pela composicao visual. Ele recebe dados do
hook `useDashboardData` e transforma respostas de API em modelos de
apresentacao por meio de `dashboardMappers`.

O fluxo principal e:

1. `useDashboardData` carrega usuario local e `GET /dashboard`.
2. Com a referencia mensal do dashboard, busca orcamentos do ano e metas.
3. Falha ao carregar orcamentos/metas nao bloqueia o dashboard principal.
4. `resolveApiError` padroniza mensagens e identifica `401`.
5. Em sessao expirada, a tela redireciona para `/login`.
6. Logout chama `POST /auth/logout`, limpa a sessao local e volta para login.

Componentes do dashboard incluem cards de metricas, contas, categorias,
transacoes recentes, comparacao mensal, orcamento e meta em destaque. A
infraestrutura visual do dashboard foi gradualmente promovida para
`src/shared/ui`, preservando wrappers locais para manter compatibilidade.

Para historico detalhado da evolucao do dashboard, consulte
[FRONTEND_DASHBOARD.md](FRONTEND_DASHBOARD.md).

## Design system e componentes compartilhados

O design system atual vive em `src/shared/styles` e `src/shared/ui`.

Principais pecas:

- `FinanceTheme`: paleta dark fintech, acentos, espacamentos, raios, bordas e
  tipografia.
- `FinanceAppShell`: estrutura autenticada com area segura, fundo, sidebar e
  conteudo responsivo.
- `FinanceAppHeader`: cabecalho autenticado com titulo, usuario e acoes.
- `FinanceSidebar`: navegacao principal compartilhada.
- `GlassPanel`, `GlassButton`, `GlassField`, `GlassStatusCard`,
  `GlassOptionGroup` e `NeonIconButton`: componentes visuais reutilizaveis.

A regra de manutencao e evitar duplicar padroes glass/neon em telas. Quando um
padrao visual e reutilizavel, ele deve subir para `src/shared/ui`. Componentes
especificos de dominio continuam dentro do modulo correspondente.

Para detalhes de fases, tokens e componentes, consulte
[FRONTEND_DESIGN_SYSTEM.md](FRONTEND_DESIGN_SYSTEM.md).

## Formularios e validacoes

Formularios devem seguir o padrao descrito em
[PADROES_FORMULARIOS_VALIDACOES.md](PADROES_FORMULARIOS_VALIDACOES.md).

Diretrizes gerais:

- separar valores de formulario, erros por campo, mensagem geral e estado de
  envio;
- usar `submitting` para bloquear duplo envio;
- normalizar payload antes de chamar services;
- tratar erros HTTP com `resolveApiError`;
- exibir feedback visual consistente para loading, erro, vazio e sucesso;
- extrair validacoes, normalizadores ou hooks quando a tela crescer.

## Estrategia de testes

A estrategia de testes do frontend cobre quatro camadas:

- **storage e API client**: sessao, refresh token, limpeza em `401` e erros de
  API;
- **services de dominio**: endpoints, transformacoes e contratos esperados;
- **telas e fluxos**: renderizacao, interacao, navegacao, estados de loading,
  erro e vazio;
- **mappers/builders**: transformacao de dados para apresentacao e fixtures
  tipadas.

`docs/desenvolvimento/TESTES_FRONTEND.md` rastreia rotas Expo Router contra
telas reais, services, riscos e testes automatizados. A matriz atual separa
fluxos cobertos, parciais e pendentes, e deve ser atualizada quando novas telas
ou testes forem adicionados.

Comandos de validacao esperados dentro de `frontend/`:

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npm run export:web
```

`export:web` pode gerar artefato de build/export. Esse artefato nao deve ser
versionado.

## Padrao para telas grandes

Telas grandes sao permitidas temporariamente, mas nao devem continuar crescendo
sem estrutura. Quando uma tela concentrar estado, chamadas HTTP, validacao,
mapeamento de dados, renderizacao condicional e muitos estilos, a evolucao
recomendada e:

1. extrair hook de tela para coordenacao de dados e acoes;
2. extrair mappers para transformar DTOs em modelos de apresentacao;
3. extrair componentes menores para secoes repetidas ou complexas;
4. manter validacoes e normalizacao de payload em funcoes pequenas;
5. manter rotas em `frontend/app` como adaptadores finos.

Prioridades atuais de atencao: planejamentos, usuario, relatorios, cadastro e
formularios financeiros complexos.

## Contratos de API

O contrato entre frontend e backend esta documentado em
[FRONTEND_API_CONTRACTS.md](FRONTEND_API_CONTRACTS.md).

Riscos atuais:

- DTOs e types do frontend ainda sao mantidos manualmente;
- services contem paths de endpoint escritos manualmente;
- o client Axios desembrulha o envelope global de sucesso, entao e preciso
  diferenciar tipo transportado pela API e tipo consumido pela tela;
- erros do backend podem chegar em formatos diferentes.

Novos endpoints devem ser confirmados no `backendnest/swagger.yaml` antes de
serem consumidos pelo frontend.

## Riscos conhecidos da arquitetura atual

- Contratos API manuais podem divergir do Swagger.
- Telas grandes podem misturar responsabilidades e dificultar testes.
- Cores hardcoded ainda existem fora do tema compartilhado.
- Nomes tecnicos ainda misturam portugues, ingles e espanhol por historico de
  contrato e dominio.
- Scripts de validacao eram incompletos antes da inclusao de `typecheck` e
  `export:web`.
- Smoke visual web/mobile e acessibilidade ainda nao possuem processo formal.

## Pontos sensiveis de manutencao

### RootLayout

`RootLayout` controla a decisao entre rota publica, rota protegida, loading e
redirect. Mudancas nesse arquivo podem gerar loops de navegacao, tela em branco
ou acesso indevido. Ao altera-lo, validar:

- rotas publicas;
- redirecionamento de `/` e `/login` para `/dashboard`;
- comportamento sem token;
- assinatura e limpeza de listeners de auth;
- testes de navegacao e rotas protegidas.

### Sessao e autenticacao

`authStorage.ts` e `authService.ts` formam a base da sessao local. A manutencao
deve preservar:

- access token e refresh token separados;
- limpeza completa em logout ou refresh invalido;
- notificacao de mudanca de auth state;
- validacao do usuario salvo;
- compatibilidade web/native no storage.

### API client e refresh token

`src/shared/services/api.ts` e sensivel porque todas as chamadas protegidas
passam por ele. Pontos de atencao:

- evitar refresh automatico em endpoints de auth;
- manter `_retry` para impedir loop infinito;
- preservar `refreshPromise` para reduzir corrida entre requisicoes;
- limpar sessao quando o refresh falha;
- manter unwrap de resposta alinhado ao backend.

### Dashboard

O dashboard agrega dados de varios dominios e usa mappers de apresentacao.
Alteracoes devem preservar a separacao entre:

- busca de dados em `useDashboardData`;
- transformacao em `dashboardMappers`;
- renderizacao por componentes;
- navegacao por `financeSidebarItems`;
- tolerancia a falhas secundarias em orcamentos/metas.

### Telas financeiras principais

Contas, transacoes, transferencias, dividas, pagamentos de divida, relatorios,
previsao, metas, orcamentos e alertas dependem do contrato do backend e de
isolamento por usuario. Mudancas nessas telas devem validar:

- estados vazio/loading/erro;
- `401` e limpeza de sessao;
- navegacao entre lista e formulario;
- services tipados;
- filtros e parametros de rota;
- fixtures/builders usados nos testes.

## Relacao com documentos existentes

- [frontend/README.md](../../frontend/README.md): guia curto de arquitetura
  local e comandos principais.
- [FRONTEND_DESIGN_SYSTEM.md](FRONTEND_DESIGN_SYSTEM.md): tokens visuais,
  componentes compartilhados e shell autenticado.
- [FRONTEND_API_CONTRACTS.md](FRONTEND_API_CONTRACTS.md): contrato entre
  frontend, Swagger e backend.
- [PADROES_FORMULARIOS_VALIDACOES.md](PADROES_FORMULARIOS_VALIDACOES.md):
  padroes de formularios, validacoes e feedback visual.
- [FRONTEND_DASHBOARD.md](FRONTEND_DASHBOARD.md): historico e arquitetura
  detalhada do dashboard.
- [docs/desenvolvimento/TESTES_FRONTEND.md](../desenvolvimento/TESTES_FRONTEND.md):
  matriz de rastreabilidade de rotas, services, riscos e testes.
- [BACKEND.md](BACKEND.md): arquitetura do backend consumido pelo frontend.

Este documento deve permanecer como visao arquitetural. Detalhes operacionais,
comandos e evidencias pontuais de execucao devem ficar no README ou nos
documentos de desenvolvimento.
