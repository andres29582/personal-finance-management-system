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
perfil do usuario, alem de listagem, criacao, detalhe e formularios protegidos
de Planejamentos compartilhados.

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

A navegacao principal possui dois contratos durante a migracao visual:

- `AppShell` e o contrato canonico para os fluxos moveis ja migrados e para a
  pagina publica de privacidade, que preserva sua regra de acesso;
- `FinanceAppShell` continua atendendo as telas legadas com os itens de
  `src/shared/navigation/financeNavigation.ts`.

### Contrato canonico do shell movel

`src/shared/ui/AppShell.tsx` e a moldura principal dos fluxos moveis atuais.
Ele controla area segura, marca com retorno ao dashboard, perfil, logout
opcional, rolagem da pagina, limite de largura, footer e menu global `+`.
Dashboard, Contas (lista, criacao e edicao), Transacoes (lista e formulario),
Categorias (lista e formulario), Transferencias (lista e formulario), Orcamentos
(lista e formulario), Metas (lista e formulario), Dividas (lista, formulario e
pagamentos), Alertas (lista e formulario), Relatorios, Planejamentos (lista,
detalhe, criacao, participante e gasto), Previsao ML e Decisoes sao os
consumidores financeiros atuais. Usuario, Auditoria e Privacidade completam a
migracao; Privacidade continua publica, enquanto Usuario e Auditoria continuam
protegidas pelo `RootLayout`.
Todo consumidor deve conectar o perfil a `/usuario`; logout permanece opcional
porque depende de quem possui o estado da sessao.

#### Footer primario

| Label | Rota |
| --- | --- |
| Dashboard | `/dashboard` |
| Planejamentos | `/planejamentos` |
| Previsao ML | `/previsao-deficit` |
| Decisoes | `/decisoes` |

O footer contem apenas destinos primarios. `activeRoute` seleciona um item
somente quando a rota atual pertence a essa lista. Por isso telas contextuais,
como `/transacoes` e `/transacoes-form`, nao marcam uma aba artificial.

#### Menu global `+`

`QuickActionsMenu` concentra destinos secundarios independentes de uma
entidade previamente selecionada:

| Grupo | Acoes |
| --- | --- |
| Registrar | Nova despesa (`/transacoes-form?tipo=despesa`), nova receita (`/transacoes-form?tipo=receita`), nova conta (`/contas-create`), transferencia (`/transferencias-form`), divida (`/dividas-form`), meta (`/metas-form`), orcamento (`/orcamentos-form`), categoria (`/categorias-form`) e alerta (`/alertas-form`) |
| Gestionar | Contas (`/contas`); **pagar divida (`/pagos-divida`) e um acesso incorreto ainda presente** |
| Consultar | Relatorios (`/relatorios`) |

#### Matriz de acesso visivel (38 rotas Expo)

| Classe | Rotas | Entrada real e contrato |
| --- | --- | --- |
| Footer | `/dashboard`, `/planejamentos`, `/previsao-deficit`, `/decisoes` | Quatro abas globais do `AppShell`; nenhuma rota contextual deve aparecer aqui. |
| Menu `+` | `/transacoes-form` (receita/despesa), `/contas-create`, `/transferencias-form`, `/dividas-form`, `/metas-form`, `/orcamentos-form`, `/categorias-form`, `/alertas-form`, `/contas`, `/relatorios` | Acoes globais independentes de uma entidade, definidas em `financeQuickActionGroups`. Os formularios compartilhados podem receber `id` para edicao contextual, mas a criacao nao exige esse parametro. |
| Perfil | `/usuario`, `/reset-password`, `/privacidade`, `/audit-logs` | Botao de perfil do shell leva a `/usuario`; a tela de perfil oferece acessos visiveis a senha, privacidade e auditoria. Nao sao abas nem acoes globais. |
| Contextual com entidade obrigatoria | `/contas-edit` (`id`), `/planejamentos-detail` (`id`), `/planejamentos-participante-form` (`id`), `/planejamentos-gasto-form` (`id`), `/pagos-divida` (`dividaId`) | Somente a partir da conta, planejamento ou divida selecionada. O teste de `DividasScreen` verifica o envio de `dividaId`; `PagosDividaScreen` nao funciona sem ele. |
| Contextual ou publico com entrada visivel | `/transacoes`, `/orcamentos`, `/metas`, `/planejamentos-form`, `/forgot-password`, `/register` | Cards do dashboard, lista de planejamentos ou fluxo publico de autenticacao; nao precisam virar destinos globais duplicados. `/privacidade` tambem permanece publica a partir do cadastro, sem exibir navegacao autenticada para visitantes. |
| Retorno apos formulario, sem entrada estavel | `/categorias`, `/transferencias`, `/dividas`, `/alertas` | As telas existem, mas hoje so sao alcancaveis indiretamente apos salvar o respectivo formulario; falta um acesso de listagem independente. |
| Rota legada redundante | `/home` | Nao recebe novo acesso: o dashboard ja cobre essa entrada. |
| Entrada externa ou tecnica | `/reset-password-token`, `/`, `/login`, `/prototype/slime` | Link de recuperacao de senha, redirects/entrada de sessao e prototipo; fora da navegacao autenticada. |

**Pendente para a fase de acoes:** o menu `+` ainda publica `Pagar divida`
como `/pagos-divida` sem `dividaId`. Essa entrada nao satisfaz o contrato
contextual e deve sair do menu global; o acesso valido ja existe em
`DividasScreen`. O teste de contrato registra a exclusividade como `it.todo`
ate essa correcao, sem deixar a suite vermelha nesta fase. A matriz descreve
o acesso real e aponta as lacunas, nao promete alcance que a UI ainda nao tem.

Regras de navegacao:

- nao duplicar no menu os quatro destinos do footer;
- manter criacao e listagens autonomas no menu global, quando houver entrada
  implementada;
- manter edicao, exclusao, desativacao e detalhes junto da entidade escolhida;
- nunca publicar globalmente uma rota que exige `id` ou `dividaId` de uma
  entidade selecionada;
- usar `pageHeader` para voltar ou expor uma acao propria da tela;
- toda nova entrada deve apontar para uma rota existente, protegida e testada.

#### Primitivas visuais e estados

| Peca | Responsabilidade |
| --- | --- |
| `FinanceTheme` | Cores, tipografia, espacamento, raios, bordas, opacidade e sombras |
| `FinanceLayout` | Breakpoints, padding responsivo e largura maxima |
| `FinanceAppHeader` | Eyebrow, titulo, subtitulo, metadado e acao contextual |
| `GlassPanel`, `GlassField`, `GlassButton`, `LiquidButton` | Superficies, formularios e acoes reutilizaveis |
| `GlassStatusCard` | Loading, erro, vazio e sucesso, com retry quando aplicavel |
| `useReducedMotion` | Desativa animacao continua quando solicitado pelo sistema |

O `ScrollView` externo pertence ao `AppShell`; consumidores nao devem criar
outra rolagem de pagina. Listas, filtros e estados de dominio continuam dentro
da tela.

#### Limites de migracao

`FinanceAppShell`, `FinanceSidebar` e `financeSidebarItems` formam o contrato
legado ainda usado pelas telas nao migradas. Eles nao devem ser alterados para
imitar o footer movel nem migrados em lote; cada dominio exige uma fase propria
com seus testes.

`components/auth-screen.tsx` e o shell publico separado de login e cadastro.
Ele preserva fundo, teclado, rolagem e card glass, compartilhando tema e campos,
mas nunca footer, perfil ou menu `+` do shell principal. Privacidade e a unica
rota publica que compartilha `AppShell`; seus destinos financeiros permanecem
protegidos pelo guard central.

#### Checklist manual no Expo Go

- abrir Dashboard, Contas, criacao/edicao de conta, Transacoes, formulario de
  transacao, Categorias, formulario de categoria, Transferencias, formulario de
  transferencia, Orcamentos, formulario de orcamento, Metas, formulario de meta,
  Dividas, formulario e pagamentos de divida, Alertas, formulario de alerta e
  Relatorios, Planejamentos, detalhe, formulario, participante e gasto,
  Previsao ML e Decisoes;
- abrir Usuario, Auditoria e Privacidade, incluindo Privacidade sem sessao;
- confirmar area segura, rolagem e conteudo sem sobreposicao do footer;
- abrir o teclado nos formularios e confirmar que campos e acoes continuam
  alcancaveis pela rolagem;
- validar aba ativa somente nas quatro rotas primarias;
- abrir, rolar e fechar o menu `+` por botao e backdrop;
- confirmar destinos, inclusive tipo receita/despesa;
- abrir `/usuario` pelo perfil em todos os consumidores;
- confirmar que `/usuario` e `/audit-logs` continuam protegidas e que os botoes
  publicos de Privacidade retornam a login e cadastro;
- validar labels do leitor de tela e reduced motion.

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
- **Planejamentos compartilhados**: listagem, criacao, detalhe agregado,
  participantes, gastos, resumo, acertos e lifecycle conforme capacidade do
  ator.
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
- `AppShell`: shell movel autenticado com footer e menu global `+`.
- `QuickActionsMenu`: navegacao secundaria global agrupada por intencao.
- `FinanceAppShell`: shell legado responsivo com sidebar.
- `FinanceAppHeader`: cabecalho autenticado com titulo, usuario e acoes.
- `FinanceSidebar`: navegacao principal das telas legadas.
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

Os consumidores autenticados ainda no shell legado sao `HomeScreen` e o
wrapper `DashboardShell`.

No detalhe de Planejamentos, carregamento de dados e mutacoes permanecem
separados em hooks, com capacidades centralizadas. Proprietario e participante
`VINCULADO + ATIVO` possuem permissoes diferentes. Formularios de participante
e gasto carregam identidade e agregado antes de habilitar campos, distinguem
criacao de edicao e invalidam respostas obsoletas em trocas de rota, sequencias
`A -> B -> A` e unmount. Essa protecao melhora UX e defesa em profundidade, sem
substituir a autorizacao do backend.

## Contratos de API

O contrato entre frontend e backend esta documentado em
[FRONTEND_API_CONTRACTS.md](FRONTEND_API_CONTRACTS.md).

Riscos atuais:

- DTOs e types do frontend ainda sao mantidos manualmente;
- `UserProfile.dataRegistro` e retornado por `UsersService` e consumido no
  perfil, mas ainda nao aparece no schema Swagger `PublicUser`;
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
- `HomeScreen` e `DashboardShell` ainda dependem do shell legado; a migracao em
  lote continua fora do escopo por impacto compartilhado.
- O lint completo ainda encontra divida preexistente em efeitos/refs de
  `PagosDividaScreen` e formularios complexos de Planejamentos; as migracoes de
  shell nao alteram essa logica de dominio.
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

## Credenciais: respostas obsoletas

A troca autenticada pede senha atual exata e confirmacao local. Storage e refresh
usam geracao de sessao e fila de mutacoes no mesmo runtime: sucesso antigo nao
restaura credenciais e falha antiga nao limpa login novo. Abas distintas nao sao
coordenadas nesta etapa; autoridade continua no servidor.
[Estado e testes](../validacao/SEGURANCA_CREDENCIAIS_ETAPA_1_RESULTADO.md).
