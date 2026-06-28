# Arquitetura do Dashboard Frontend

## Objetivo

Este documento registra a evolução técnica da tela principal do frontend para um dashboard financeiro dark fintech com visual liquid glass/glassmorphism. A intenção é criar uma base modular, autônoma e testável para que a interface possa evoluir em etapas sem acoplar regras de negócio, navegação, carregamento de dados e apresentação visual em um único arquivo.

## Contexto atual

O frontend usa Expo Router, React Native, TypeScript e axios. A arquitetura já segue uma divisão por rotas finas e módulos de domínio:

```text
app/
  dashboard.tsx
src/
  navigation/
  modules/
    dashboard/
      screens/
      services/
      types/
      components/
      hooks/
      __tests__/
  shared/
components/
constants/
storage/
utils/
```

A rota `app/dashboard.tsx` deve continuar sendo apenas um adaptador fino. A implementação real da tela permanece em `src/modules/dashboard`.

## Diretrizes arquiteturais

- Manter `app/` apenas como camada de roteamento do Expo Router.
- Concentrar a nova infraestrutura visual dentro de `src/modules/dashboard`.
- Evitar alterar o tema global antes de estabilizar o novo dashboard.
- Separar carregamento de dados, mapeamento de dados, layout e widgets visuais.
- Manter componentes pequenos, com responsabilidades explícitas.
- Garantir que estados de carregamento, erro, vazio e sucesso continuem testáveis.
- Preferir dados derivados em funções ou hooks isolados, evitando lógica complexa diretamente no JSX.
- Preservar compatibilidade com os serviços e tipos existentes.
- Registrar cada fase neste documento para manter histórico técnico da evolução.

## Infraestrutura proposta

```text
src/modules/dashboard/
  screens/
    DashboardScreen.tsx
  hooks/
    useDashboardData.ts
  components/
    DashboardShell.tsx
    DashboardSidebar.tsx
    DashboardHeader.tsx
    GlassPanel.tsx
    MetricGlassCard.tsx
    FinancialSummaryGrid.tsx
    SpendingTrendCard.tsx
    CategoryBarsCard.tsx
    AccountsOverviewCard.tsx
    GoalsProgressCard.tsx
    AlertsCard.tsx
    RecentTransactionsCard.tsx
  styles/
    dashboardTheme.ts
    dashboardLayout.ts
  utils/
    dashboardMappers.ts
```

## Fases de implementação

### Fase 1: Autonomia de estado e dados

Objetivo: retirar da tela principal a responsabilidade de carregar usuário, carregar dados do dashboard, tratar erros de API e executar logout.

Arquivos previstos:

- Criar `frontend/src/modules/dashboard/hooks/useDashboardData.ts`.
- Modificar `frontend/src/modules/dashboard/screens/DashboardScreen.tsx`.
- Manter e ajustar, se necessário, `frontend/src/modules/dashboard/__tests__/dashboard.test.tsx`.

Critérios de aceite:

- `DashboardScreen` deve ficar mais focada em apresentação.
- O hook deve expor usuário, dashboard, loading, mensagem de erro, recarregamento e logout.
- O comportamento atual deve ser preservado.
- Os testes do dashboard devem continuar passando.

### Fase 2: Tema visual isolado

Objetivo: criar tokens visuais específicos para o dashboard dark fintech sem afetar outras telas do aplicativo.

Arquivos previstos:

- Criar `frontend/src/modules/dashboard/styles/dashboardTheme.ts`.
- Criar `frontend/src/modules/dashboard/styles/dashboardLayout.ts`.

Critérios de aceite:

- Cores, espaçamentos, raios, bordas e efeitos neon devem ficar centralizados.
- `ContaTheme` não deve ser usado como base visual principal do novo dashboard.
- A tela deve poder alternar visualmente sem quebrar formulários e telas de CRUD existentes.

### Fase 3: Shell e navegação lateral

Objetivo: criar a estrutura principal da tela com fundo escuro, área segura, sidebar minimal e header financeiro.

Arquivos previstos:

- Criar `DashboardShell.tsx`.
- Criar `DashboardSidebar.tsx`.
- Criar `DashboardHeader.tsx`.

Critérios de aceite:

- A tela deve ter estrutura responsiva para web e mobile.
- A navegação deve continuar usando Expo Router.
- A sidebar deve conter os principais domínios do sistema financeiro.

### Fase 4: Cards glass reutilizáveis

Objetivo: criar uma base visual reutilizável para cards translúcidos com bordas neon e estados consistentes.

Arquivos previstos:

- Criar `GlassPanel.tsx`.
- Criar `MetricGlassCard.tsx`.
- Criar `NeonIconButton.tsx`, se necessário.

Critérios de aceite:

- Cards devem suportar título, subtítulo, ação, conteúdo e variações de destaque.
- O estilo glass deve ficar encapsulado.
- A composição deve evitar duplicação de estilos.

### Fase 5: Widgets financeiros

Objetivo: decompor o dashboard em widgets autônomos.

Arquivos previstos:

- Criar `FinancialSummaryGrid.tsx`.
- Criar `CategoryBarsCard.tsx`.
- Criar `SpendingTrendCard.tsx`.
- Criar `AccountsOverviewCard.tsx`.
- Criar `GoalsProgressCard.tsx`.
- Criar `AlertsCard.tsx`.
- Criar `RecentTransactionsCard.tsx`.

Critérios de aceite:

- Cada widget deve receber dados por props.
- A tela principal não deve conhecer detalhes de renderização interna dos widgets.
- Estados vazios devem ser claros e consistentes.

### Fase 6: Mapeamento e enriquecimento de dados

Objetivo: transformar os dados da API em modelos prontos para apresentação sem poluir a tela.

Arquivos previstos:

- Criar `dashboardMappers.ts`.
- Expandir tipos locais, se necessário.

Critérios de aceite:

- Cálculos de percentual, séries de gráfico, listas resumidas e atalhos devem ficar fora do JSX.
- A UI deve continuar funcionando mesmo com listas vazias.

### Fase 7: Validação visual e testes

Objetivo: consolidar testes automatizados e validação visual da nova experiência.

Arquivos previstos:

- Atualizar `dashboard.test.tsx`.
- Criar testes unitários para mappers, se houver lógica relevante.
- Validar a tela em web/mobile.

Critérios de aceite:

- Fluxos de carregamento, erro, logout e navegação lateral continuam cobertos.
- O dashboard renderiza dados principais.
- Não há regressão de navegação autenticada.

## Histórico de execução

### 2026-05-17: Início da Fase 1

Decisão: iniciar pela separação da lógica de dados em um hook dedicado. Essa etapa prepara o terreno para o redesenho visual sem misturar infraestrutura de carregamento com componentes glassmorphism.

Resultado esperado:

- `DashboardScreen` passa a consumir `useDashboardData`.
- A lógica de `getUser`, `getDashboard`, tratamento de erro e logout sai da tela.
- A estrutura do módulo fica pronta para receber os componentes visuais das próximas fases.

### 2026-05-17: Conclusão da Fase 1

Implementado `useDashboardData` em `src/modules/dashboard/hooks/useDashboardData.ts`.

Responsabilidades extraídas:

- Carregamento do usuário autenticado.
- Carregamento do resumo financeiro.
- Tratamento de erro de API.
- Redirecionamento para login quando a sessão expira.
- Recarregamento manual do dashboard.
- Logout da sessão.

Resultado:

- `DashboardScreen` ficou mais enxuta e focada em apresentação.
- O comportamento existente foi preservado.
- Os testes do dashboard passaram após a extração.

### 2026-05-17: Início da Fase 2

Decisão: criar um tema visual local para o dashboard antes de implementar os componentes glass. Essa escolha evita espalhar cores, sombras, opacidades, raios e medidas em diversos componentes logo no início do redesenho.

Arquivos criados:

- `frontend/src/modules/dashboard/styles/dashboardTheme.ts`.
- `frontend/src/modules/dashboard/styles/dashboardLayout.ts`.

Responsabilidades de `dashboardTheme.ts`:

- Paleta dark fintech.
- Superfícies glass translúcidas.
- Acentos neon cyan, magenta e violeta.
- Tokens de texto, borda, raio, espaçamento, opacidade e sombra.
- Tipos auxiliares para acentos visuais.

Responsabilidades de `dashboardLayout.ts`:

- Largura máxima de conteúdo.
- Medidas de sidebar e header.
- Alturas mínimas para cards e gráficos.
- Breakpoints para mobile, tablet e desktop.
- Espaçamentos de tela por faixa de largura.
- Metadados de grid para os futuros widgets.

Resultado esperado:

- As próximas fases podem usar tokens centralizados.
- O tema global atual permanece intacto.
- O dashboard ganha independência visual sem impactar telas de formulário, CRUD, login e autenticação.

### 2026-05-17: Início da Fase 3

Decisão: introduzir a estrutura visual principal do dashboard usando os tokens criados na Fase 2. A implementação começa pelo shell, header e sidebar porque esses componentes definem a experiência base antes da criação dos cards glass e widgets financeiros.

Arquivos criados:

- `frontend/src/modules/dashboard/components/DashboardShell.tsx`.
- `frontend/src/modules/dashboard/components/DashboardHeader.tsx`.
- `frontend/src/modules/dashboard/components/DashboardSidebar.tsx`.

Responsabilidades de `DashboardShell.tsx`:

- Criar a superfície principal dark do dashboard.
- Controlar área segura, rolagem e limite máximo de conteúdo.
- Alternar layout desktop e mobile.
- Renderizar sidebar vertical no desktop e sidebar compacta em telas menores.

Responsabilidades de `DashboardHeader.tsx`:

- Exibir identidade da tela, saudação do usuário e e-mail.
- Exibir referência mensal quando disponível.
- Centralizar ações de perfil e logout.
- Usar tokens visuais dark/neon sem depender de `AppScreen`.

Responsabilidades de `DashboardSidebar.tsx`:

- Definir navegação principal do dashboard.
- Suportar modo completo e modo compacto.
- Indicar rota ativa.
- Usar ícones de `@expo/vector-icons` para manter a navegação mais visual e menos textual.

Resultado esperado:

- `DashboardScreen` passa a usar a nova infraestrutura visual.
- A estrutura principal do dashboard deixa de depender de `AppScreen`.
- Os widgets atuais ainda podem permanecer provisoriamente com `AppCard` até a Fase 4.
- A próxima etapa pode focar na criação de `GlassPanel` e cards neon reutilizáveis.

### 2026-05-17: Início da Fase 4

Decisão: criar os componentes visuais reutilizáveis antes de decompor todos os widgets financeiros. Essa ordem evita que cada seção do dashboard implemente seu próprio estilo glass/neon de forma duplicada.

Arquivos criados:

- `frontend/src/modules/dashboard/components/GlassPanel.tsx`.
- `frontend/src/modules/dashboard/components/MetricGlassCard.tsx`.
- `frontend/src/modules/dashboard/components/NeonIconButton.tsx`.

Responsabilidades de `GlassPanel.tsx`:

- Fornecer a superfície base glassmorphism.
- Centralizar borda, sombra, raio, espaçamento e acento visual.
- Suportar título, subtítulo, ação e conteúdo arbitrário.
- Servir como base para widgets financeiros futuros.

Responsabilidades de `MetricGlassCard.tsx`:

- Renderizar métricas principais com ícone, rótulo e valor.
- Aplicar acentos cyan, magenta ou misto.
- Manter dimensões mínimas para grids responsivos.

Responsabilidades de `NeonIconButton.tsx`:

- Fornecer botão compacto com ícone e rótulo opcional.
- Manter ações visuais alinhadas ao estilo neon.
- Preparar base para ações rápidas e menus de card.

Integração inicial:

- Métricas principais do dashboard passaram a usar `MetricGlassCard`.
- Seções de gastos por categoria, últimas transações e atalhos passaram a usar `GlassPanel`.
- `AppStatusCard` permanece temporariamente para estados de carregamento, erro e vazio até a migração visual desses estados.

Resultado esperado:

- A superfície visual do dashboard começa a se aproximar do estilo dark fintech.
- O código ganha componentes de UI próprios do módulo.
- A Fase 5 poderá focar na decomposição dos widgets financeiros sem recriar estilos base.

### 2026-05-17: Início da Fase 5

Decisão: decompor o conteúdo financeiro atual em widgets autônomos. A tela principal já possuía shell, header, sidebar e cards base; portanto, a próxima melhoria estrutural é retirar da `DashboardScreen` a responsabilidade de renderizar detalhes de cada seção.

Arquivos criados:

- `frontend/src/modules/dashboard/components/FinancialSummaryGrid.tsx`.
- `frontend/src/modules/dashboard/components/CategoryBarsCard.tsx`.
- `frontend/src/modules/dashboard/components/RecentTransactionsCard.tsx`.
- `frontend/src/modules/dashboard/components/AccountsOverviewCard.tsx`.

Responsabilidades de `FinancialSummaryGrid.tsx`:

- Renderizar as quatro métricas principais.
- Formatar valores monetários.
- Compor `MetricGlassCard` em grid responsivo.

Responsabilidades de `CategoryBarsCard.tsx`:

- Renderizar gastos por categoria.
- Calcular largura relativa das barras.
- Manter estado vazio da seção.

Responsabilidades de `RecentTransactionsCard.tsx`:

- Renderizar últimas transações.
- Formatar moeda e data.
- Manter estado vazio da seção.

Responsabilidades de `AccountsOverviewCard.tsx`:

- Preservar o fluxo de onboarding quando não há contas cadastradas.
- Encapsular a chamada para criação da primeira conta.

Resultado esperado:

- `DashboardScreen` fica focada em composição.
- Cada widget passa a receber dados por props.
- A próxima etapa pode introduzir mappers e widgets mais ricos sem aumentar a complexidade da tela.

### 2026-05-17: Início da Fase 6

Decisão: extrair configurações e dados derivados para `dashboardMappers.ts`. Depois da decomposição em widgets, alguns componentes ainda conheciam detalhes de formatação, navegação e cálculo de proporções. A Fase 6 centraliza essas transformações para reduzir acoplamento e facilitar a evolução visual.

Arquivos criados:

- `frontend/src/modules/dashboard/utils/dashboardMappers.ts`.
- `frontend/src/modules/dashboard/__tests__/dashboardMappers.test.ts`.

Responsabilidades de `dashboardMappers.ts`:

- Definir itens da sidebar do dashboard.
- Mapear métricas financeiras para cards visuais.
- Mapear gastos por categoria para barras proporcionais.
- Formatar valores monetários usados nos modelos de apresentação.

Responsabilidades de `dashboardMappers.test.ts`:

- Garantir que métricas sejam geradas com labels e valores esperados.
- Garantir que barras de categoria mantenham proporção e moeda formatada.
- Garantir que a navegação essencial continue disponível.

Integração:

- `DashboardScreen` passou a consumir `dashboardSidebarItems`, `mapDashboardMetrics` e `mapCategoryBars`.
- `FinancialSummaryGrid` passou a receber métricas já formatadas.
- `CategoryBarsCard` passou a receber barras já calculadas.

Resultado esperado:

- A tela principal conhece menos detalhes de estrutura visual.
- Os widgets recebem modelos de apresentação mais estáveis.
- Mudanças futuras em labels, rotas, percentuais e formatação ficam concentradas.

### 2026-05-17: Ajuste de navegação após a Fase 6

Decisão: remover o card de atalhos do conteúdo principal e consolidar esses acessos na sidebar. A navegação lateral passa a ser a fonte única para deslocamento entre áreas do sistema, deixando o dashboard mais focado em informação financeira.

Alterações realizadas:

- Removido `QuickActionsCard.tsx`.
- Removido o painel `Atalhos` da `DashboardScreen`.
- `dashboardSidebarItems` passou a incluir todas as rotas que estavam nos atalhos.
- `DashboardSidebar` passou a expor `accessibilityLabel` nos itens de navegação.
- Testes passaram a validar navegação pela sidebar.

Rotas consolidadas na sidebar:

- Dashboard.
- Contas.
- Transações.
- Categorias.
- Orçamentos.
- Relatórios.
- Previsão ML.
- Metas.
- Alertas.
- Transferências.
- Dívidas.
- Auditoria.
- Senha.

Resultado esperado:

- Menos ruído visual no conteúdo principal.
- Navegação mais consistente.
- Cards do dashboard ficam reservados para dados financeiros e estados operacionais.

### 2026-05-17: Painéis recolhíveis para histórico

Decisão: transformar `Gastos por categoria` e `Últimas transações` em painéis recolhíveis. O painel fechado mostra apenas seu título e a ação de histórico; o próprio container passa a ser a ação principal de expandir ou recolher.

Alterações realizadas:

- `CategoryBarsCard` passou a controlar estado local de expansão.
- `RecentTransactionsCard` passou a controlar estado local de expansão.
- O resumo compacto foi removido dos painéis fechados.
- A expansão passou a acontecer ao pressionar o próprio container.
- Cada painel recebeu ação de histórico:
  - Categorias abre `/relatorios`.
  - Transações abre `/transacoes`.
- Testes cobrem expansão dos painéis e navegação para os históricos.

Resultado esperado:

- O dashboard fica mais limpo visualmente.
- Informações detalhadas continuam acessíveis sem sair da tela.
- O histórico completo fica a um toque de distância.

### 2026-05-17: Cards de orçamento mensal e meta em destaque

Decisão: adicionar, após os painéis de categorias e transações, uma área de planejamento com dois cards lado a lado: orçamento do mês e meta em destaque. Esses cards usam dados reais dos módulos `orcamentos` e `metas`.

Alterações realizadas:

- `useDashboardData` passou a carregar orçamento do ano/mês de referência do dashboard.
- `useDashboardData` passou a carregar metas e selecionar a primeira meta ativa como destaque.
- A falha no carregamento de orçamento/metas não impede o carregamento do dashboard principal.
- Criado `BudgetOverviewCard`.
- Criado `GoalProgressCard`.
- Criado `PlanningOverviewGrid`.
- Criados mappers `mapBudgetOverview` e `mapGoalOverview`.
- Testes cobrem renderização dos cards, navegação e mapeamento dos dados.

Conteúdo do card de orçamento:

- Valor definido para o mês.
- Valor já gasto.
- Valor restante.
- Barra de utilização.
- Ação para abrir `/orcamentos`.

Conteúdo do card de meta:

- Nome da meta.
- Valor guardado.
- Valor objetivo.
- Valor faltante.
- Barra de progresso.
- Ação para abrir `/metas`.

Resultado esperado:

- O dashboard passa a conectar o resumo financeiro com planejamento mensal e objetivos pessoais.
- A tela ganha mais valor operacional sem misturar regras de orçamento/metas dentro do JSX principal.

### 2026-05-17: Integração com design system compartilhado

Decisão: manter os imports atuais do dashboard, mas fazer `GlassPanel`, `NeonIconButton` e `DashboardTheme` apontarem para a nova base compartilhada em `src/shared`. Isso evita retrabalho no dashboard e prepara a migração das demais telas.

Alterações realizadas:

- `DashboardTheme` passou a reexportar `FinanceTheme`.
- `GlassPanel` do dashboard passou a reexportar `src/shared/ui/GlassPanel`.
- `NeonIconButton` do dashboard passou a reexportar `src/shared/ui/NeonIconButton`.
- Criado documento `docs/frontend-design-system.md`.

Resultado esperado:

- O dashboard preserva compatibilidade.
- Outras telas podem começar a usar a mesma fundação visual.
- O design system deixa de ser uma implementação isolada do dashboard.

### 2026-05-17: Integração com shell autenticado compartilhado

Decisão: substituir a implementação interna de shell, sidebar e header do dashboard por wrappers sobre os componentes compartilhados em `src/shared/ui`.

Alterações realizadas:

- `DashboardShell` passou a encapsular `FinanceAppShell`.
- `DashboardSidebar` passou a reexportar `FinanceSidebar`.
- `DashboardHeader` passou a encapsular `FinanceAppHeader`.
- `dashboardLayout` passou a reexportar `financeLayout`.

Resultado esperado:

- O dashboard continua com a mesma API interna.
- O shell autenticado passa a estar disponível para outras telas.
- A próxima migração pode focar em telas de listagem, começando por contas.

### 2026-05-17: Navegação compartilhada usada por Contas

Decisão: a lista de itens da sidebar deixou de viver como configuração exclusiva do dashboard. Foi criada uma configuração compartilhada em `src/shared/navigation/financeNavigation.ts`, usada pelo dashboard e pela tela de contas.

Resultado esperado:

- A sidebar passa a ter uma fonte única.
- Novas telas autenticadas podem entrar no mesmo shell sem depender do módulo dashboard.
