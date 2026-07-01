# Design System do Frontend

## Objetivo

Este documento registra a infraestrutura visual compartilhada que será usada para migrar as telas do frontend para o novo estilo dark fintech com glassmorphism. A primeira etapa consolida tokens e componentes reutilizáveis sem reescrever todas as telas de uma vez.

## Fase 1: Fundação compartilhada

Data: 2026-05-17.

Decisão: extrair do dashboard os elementos que são genéricos o suficiente para serem usados por outras telas autenticadas. O dashboard continua funcionando, mas passa a apontar para a base compartilhada onde já existe maturidade.

## Arquivos criados

- `frontend/src/shared/styles/financeTheme.ts`.
- `frontend/src/shared/ui/AppGlassScreen.tsx`.
- `frontend/src/shared/ui/GlassPanel.tsx`.
- `frontend/src/shared/ui/GlassButton.tsx`.
- `frontend/src/shared/ui/GlassField.tsx`.
- `frontend/src/shared/ui/GlassStatusCard.tsx`.
- `frontend/src/shared/ui/GlassOptionGroup.tsx`.
- `frontend/src/shared/ui/NeonIconButton.tsx`.
- `frontend/src/shared/ui/index.ts`.

## Tema compartilhado

`FinanceTheme` centraliza:

- Paleta dark fintech.
- Superfícies glass.
- Acentos neon cyan, magenta e misto.
- Tipografia.
- Espaçamentos.
- Raios.
- Bordas.
- Opacidades.
- Sombras.

O tema local do dashboard passa a reexportar `FinanceTheme` como compatibilidade temporária. Isso permite migrar módulos aos poucos.

## Componentes compartilhados

### `AppGlassScreen`

Base para telas simples com fundo escuro, área segura, título, subtítulo e ação opcional.

### `GlassPanel`

Superfície base para cards glass. Suporta título, subtítulo, ação, conteúdo e estado pressionável.

### `GlassButton`

Botão textual para ações primárias, fantasmas e perigosas.

### `NeonIconButton`

Botão compacto com ícone para ações de card, navegação secundária e controles contextuais.

### `GlassField` e `GlassTextInput`

Base para formulários dark com label, input e mensagem de erro.

### `GlassStatusCard`

Estados de loading, erro, vazio e sucesso com visual compatível com o novo tema.

### `GlassOptionGroup`

Controle segmentado para opções curtas.

## Regras de uso

- Novas telas migradas para o design dark devem usar `src/shared/ui`.
- Componentes específicos de domínio continuam dentro de `src/modules/<dominio>/components`.
- O tema antigo `ContaTheme` permanece enquanto as telas legadas ainda dependem dele.
- Não alterar todas as telas de uma vez; migrar por domínio e validar testes após cada etapa.
- Evitar duplicar estilos glass/neon dentro de telas. Se o padrão for reutilizável, promover para `src/shared/ui`.

## Integração inicial

O dashboard já usa os wrappers locais:

- `src/modules/dashboard/components/GlassPanel.tsx`.
- `src/modules/dashboard/components/NeonIconButton.tsx`.
- `src/modules/dashboard/styles/dashboardTheme.ts`.

Esses wrappers agora apontam para a infraestrutura compartilhada, preservando imports existentes enquanto a arquitetura global amadurece.

## Próxima fase

Criar um shell autenticado compartilhado para que telas como contas, transações, orçamentos e metas tenham a mesma estrutura visual e navegação lateral do dashboard.

## Fase 2: Shell autenticado compartilhado

Data: 2026-05-17.

Decisão: promover a estrutura de aplicação autenticada para `src/shared/ui`, mantendo o dashboard como primeiro consumidor. Essa fase cria a base para que outras telas usem a mesma navegação lateral, header e área de conteúdo sem depender do módulo `dashboard`.

## Arquivos criados

- `frontend/src/shared/styles/financeLayout.ts`.
- `frontend/src/shared/ui/FinanceAppShell.tsx`.
- `frontend/src/shared/ui/FinanceAppHeader.tsx`.
- `frontend/src/shared/ui/FinanceSidebar.tsx`.

## Responsabilidades

### `FinanceAppShell`

- Controlar área segura.
- Aplicar fundo dark.
- Alternar layout desktop/mobile.
- Renderizar sidebar vertical no desktop.
- Renderizar sidebar compacta em telas menores.
- Centralizar conteúdo com largura máxima.

### `FinanceSidebar`

- Renderizar navegação principal.
- Suportar modo completo e compacto.
- Expor labels acessíveis para testes e acessibilidade.
- Receber itens de navegação por props.

### `FinanceAppHeader`

- Renderizar título, subtítulo e eyebrow.
- Renderizar avatar/perfil quando informado.
- Renderizar metadado de período.
- Renderizar ação de logout.

### `financeLayout`

- Centralizar largura máxima, breakpoints e espaçamentos estruturais.

## Integração inicial

O dashboard passou a usar wrappers finos:

- `DashboardShell` encapsula `FinanceAppShell`.
- `DashboardSidebar` reexporta `FinanceSidebar`.
- `DashboardHeader` encapsula `FinanceAppHeader`.
- `dashboardLayout` reexporta `financeLayout`.

Essa abordagem preserva imports existentes do dashboard e evita uma migração invasiva.

## Próxima fase

Migrar uma tela de listagem real, começando por `ContasScreen`, para validar o shell compartilhado fora do dashboard.

## Fase 3: Primeira tela de listagem migrada

Data: 2026-05-17.

Decisão: migrar `ContasScreen` como primeira tela fora do dashboard. A tela de contas é uma boa candidata porque possui carregamento, estado vazio, erro, lista de cards, ações de edição/desativação e navegação para criação.

## Alterações realizadas

- Criado `frontend/src/shared/navigation/financeNavigation.ts`.
- `dashboardMappers.ts` passou a consumir `financeSidebarItems`.
- `ContasScreen` passou a usar `FinanceAppShell`.
- `ContasScreen` passou a usar `FinanceAppHeader`.
- `ContasScreen` passou a usar `GlassPanel`.
- `ContasScreen` passou a usar `GlassButton`.
- `ContasScreen` passou a usar `GlassStatusCard`.
- `ContasScreen` passou a usar `FinanceTheme`.

## Resultado

- A sidebar compartilhada foi validada fora do dashboard.
- O header compartilhado foi validado em uma tela de listagem.
- Cards de entidade passaram a usar glassmorphism.
- Estados de carregamento, erro e vazio passaram a usar a nova linguagem visual.
- A lógica de service e domínio foi preservada.

## Próxima fase

Migrar `TransacoesScreen`, que possui filtros e maior complexidade de listagem. Essa tela deve validar padrões para listas densas e controles de seleção no novo design.
