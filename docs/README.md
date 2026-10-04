# Documentação do Sistema Financeiro

Esta pasta reúne a documentação oficial, histórica, acadêmica e operacional do projeto. A documentação viva deve refletir o estado atual do sistema; documentos em `arquivo/` são históricos e não representam necessariamente a arquitetura, decisões ou processos atuais.

Este índice orienta a leitura; não certifica que todos os documentos estejam
atualizados. A revisão de requisitos e backlog, arquitetura, procedimentos e
OpenAPI continua nas próximas fases da atualização documental.

## Fonte oficial de contrato da API

O contrato HTTP declarado está em [backendnest/swagger.yaml](../backendnest/swagger.yaml).

Documentos em `docs/validacao/` são relatórios de auditoria e não substituem o
contrato OpenAPI. Divergências entre contrato, implementação e documentação
devem ser registradas e corrigidas: nenhuma fonte prevalece silenciosamente
para justificar um comportamento incompatível.

## Documentos principais

- [Roadmap de Profissionalização](produto/ROADMAP_PROFISSIONALIZACAO.md)
- [Requisitos](produto/REQUISITOS.md)
- [Manual do Usuário](produto/MANUAL_DO_USUARIO.md)
- [Arquitetura do Sistema](arquitetura/ARQUITETURA.md)
- [Runbook Operacional Local](operacao/RUNBOOK.md)

### Rotas de leitura

| Necessidade | Começar por | Continuar em |
| --- | --- | --- |
| Produto: entender capacidades e pendências | [Requisitos](produto/REQUISITOS.md) | [Manual do Usuário](produto/MANUAL_DO_USUARIO.md) e [Roadmap](produto/ROADMAP_PROFISSIONALIZACAO.md) |
| Desenvolvimento: entender e verificar o sistema | [Arquitetura](arquitetura/ARQUITETURA.md) | [Contrato HTTP](../backendnest/swagger.yaml), [testes](desenvolvimento/TESTES.md) e README do módulo |
| Operação: preparar e recuperar um ambiente | [Runbook](operacao/RUNBOOK.md) | [Guia do backend](../backendnest/README.md) e [Docker](operacao/DOCKER.md) |

### Onde consultar cada informação

Cada tema tem uma referência principal; os demais documentos devem referenciá-la,
não manter cópias paralelas. A finalidade da fonte delimita o que ela demonstra.

| Informação | Referência principal | Papel e limite |
| --- | --- | --- |
| Regras e capacidades pretendidas | [Requisitos](produto/REQUISITOS.md) | Define o esperado; o estado de entrega exige evidência própria. |
| Organização e fluxos técnicos | [Arquitetura](arquitetura/ARQUITETURA.md) e guias de módulo | Explica o sistema; deve distinguir implementação atual de propostas. |
| Contrato HTTP declarado | [Swagger/OpenAPI](../backendnest/swagger.yaml) | Referência contratual; discrepâncias com o comportamento precisam de correção. |
| Alterações versionadas de esquema | [Migrações SQL](../backendnest/migrations) e [guia do backend](../backendnest/README.md) | Descreve alterações e aplicação; não comprova o esquema aplicado a uma base. |
| Comandos de verificação | Scripts dos módulos, como [backend](../backendnest/package.json), e [CI](../.github/workflows/ci.yml) | Define comandos executáveis; não comprova que passaram em uma execução. |
| Estratégia de testes | [Testes](desenvolvimento/TESTES.md) | Explica cobertura e escopo; resultados precisam de contexto identificável. |
| Procedimentos operacionais | [Runbook](operacao/RUNBOOK.md) | Define passos, cuidados e limites; não comprova execução em um ambiente real. |
| Evidência de uma revisão | [Relatórios de validação](validacao/) | Registra resultados vinculados a data, revisão e ambiente, não aprovação permanente. |
| Trabalho futuro | [Roadmap](produto/ROADMAP_PROFISSIONALIZACAO.md) | Organiza propostas e pendências; não prova funcionalidade entregue. |

### Como interpretar o estado

Registrar separadamente as três dimensões abaixo, quando aplicáveis. Evitar
um rótulo único como “concluído” quando os limites forem diferentes.

| Dimensão | Estados e evidência |
| --- | --- |
| Implementação | Planejada, parcial ou integrada; identificar a revisão ou PR correspondente. |
| Verificação | Não executada ou resultado documentado, com data, commit, ambiente e escopo. |
| Operação | Não comprovada, comprovada em fixtures ou comprovada em um destino explicitamente identificado, sem dados sensíveis. |

Uma suíte existente não prova execução bem-sucedida; uma migração versionada
não prova aplicação. Verificações em fixtures não validam dados reais, e um
resultado antigo não valida automaticamente a revisão atual.

## Produto

A pasta `produto/` concentra documentos sobre visão de produto, requisitos, roadmap e uso do sistema.

- [Roadmap de Profissionalização](produto/ROADMAP_PROFISSIONALIZACAO.md)
- [Requisitos](produto/REQUISITOS.md)
- [Manual do Usuário](produto/MANUAL_DO_USUARIO.md)
- Visão consolidada do produto: em construção

## Arquitetura

A pasta `arquitetura/` descreve a organização técnica do sistema, seus módulos principais e decisões estruturais.

- [Arquitetura do Sistema Financeiro](arquitetura/ARQUITETURA.md): fonte oficial resumida da arquitetura geral.
- [Arquitetura do Backend](arquitetura/BACKEND.md): fonte oficial da estrutura backend.
- [Arquitetura do Frontend](arquitetura/FRONTEND.md): fonte oficial da estrutura frontend.
- [Contratos de API do Frontend](arquitetura/FRONTEND_API_CONTRACTS.md): complemento frontend para consumo do Swagger/OpenAPI.
- [Padrões de Formulários e Validações](arquitetura/PADROES_FORMULARIOS_VALIDACOES.md): guia atual de formularios frontend.
- [Arquitetura do Módulo de Machine Learning](arquitetura/MACHINE_LEARNING.md): fonte oficial da integracao ML.
- [Design System do Frontend](arquitetura/FRONTEND_DESIGN_SYSTEM.md): parcial; guia de evolucao visual do frontend.
- [Arquitetura do Dashboard Frontend](arquitetura/FRONTEND_DASHBOARD.md): parcial; historico tecnico detalhado do dashboard.
- Arquitetura de banco de dados: documento dedicado ainda nao existe.
- Segurança: documento dedicado ainda nao existe.

## Operação

A pasta `operacao/` deve reunir instruções para preparar ambientes, executar o sistema, operar demos, Docker, deploy, CI/CD e seed.

- Ambiente e variáveis: em construção
- [Docker](operacao/DOCKER.md): auditoria e documentação existentes; execução real e deploy não são comprovados pela presença deste arquivo.
- Deploy: em construção
- CI/CD: em construção
- Seed demo: em construção
- [Runbook Operacional Local](operacao/RUNBOOK.md)

## Desenvolvimento

A pasta `desenvolvimento/` deve reunir práticas de desenvolvimento, testes, padrões de código, contribuição e registros de decisão arquitetural.

- [Estratégia Geral de Testes](desenvolvimento/TESTES.md): fonte geral de testes do projeto.
- [Testes e Rastreabilidade do Frontend](desenvolvimento/TESTES_FRONTEND.md): fonte atual de testes frontend.
- Padrões de código: em construção
- Contribuição: em construção
- Catálogo central de ADRs: em construção em `desenvolvimento/ADR/`; já existem [decisões por módulo](specs/planejamentos-compartilhados/adr-decisoes-implementacao.md).

## Validação

- [Validação de Endpoints e APIs](validacao/VALIDACAO_ENDPOINTS_APIS.md): relatório de auditoria; não substitui `backendnest/swagger.yaml`.
- Contrato oficial HTTP: [backendnest/swagger.yaml](../backendnest/swagger.yaml).
- Coleção Postman: não encontrada neste repositório.

## Specs

Specs documentam requisitos e decisões de módulos específicos. Elas são
complementares à documentação de arquitetura e ao Swagger. Consultar o estado
e a evidência de cada spec: estar nesta pasta não significa estar integrada.

- [Planejamentos Compartilhados - Requisitos](specs/planejamentos-compartilhados/requisitos.md)
- [Planejamentos Compartilhados - Regras de Negócio](specs/planejamentos-compartilhados/regras-de-negocio.md)
- [Planejamentos Compartilhados - Fluxos](specs/planejamentos-compartilhados/fluxos.md)
- [Planejamentos Compartilhados - Modelo de Dados](specs/planejamentos-compartilhados/modelo-de-dados.md)
- [Planejamentos Compartilhados - API](specs/planejamentos-compartilhados/api.md)
- [Planejamentos Compartilhados - Testes](specs/planejamentos-compartilhados/testes.md)
- [Planejamentos Compartilhados - ADR](specs/planejamentos-compartilhados/adr-decisoes-implementacao.md)

## Machine Learning

- [Arquitetura ML](arquitetura/MACHINE_LEARNING.md): fonte arquitetural da integracao ML.
- [README do módulo ML](../ml-finance-tcc/README.md): guia operacional do serviço FastAPI e pipeline.
- [Dicionário de Dados do ML](../ml-finance-tcc/docs/DICIONARIO_DE_DADOS.md): referência das features e dados do modelo.

## Acadêmico

A pasta `academico/` deve concentrar materiais relacionados ao TCC, resultados e apresentações acadêmicas.

- [Nota Técnica do Módulo de Machine Learning](academico/TCC/NOTA_TECNICA_MACHINE_LEARNING.md)
- [Resultados e Discussão](academico/RESULTADOS/SECAO_5_RESULTADOS_DISCUSSAO.md)
- [Roteiro de Apresentação](academico/APRESENTACOES/ROTEIRO_APRESENTACAO.md)

## Pesquisa

A pasta `pesquisa/` deve reunir estudos e avaliações futuras que ainda não fazem parte da implementação principal.

- Open Finance: em construção
- Inteligência artificial: em construção
- Funcionalidades futuras: em construção

## Governança documental

- Documentação viva deve refletir o estado atual do sistema.
- A documentação afetada deve ser atualizada no mesmo PR do código; o autor e o revisor conferem coerência, referências e limites.
- Referenciar a fonte principal em vez de copiar contratos, comandos ou regras para múltiplos documentos.
- Documentos históricos ficam em `docs/arquivo/` e não devem ser usados como fonte atual sem validação.
- Relatórios e contagens históricas mantêm data, commit e ambiente originais; novas verificações não devem reescrever a evidência anterior como se fosse atual.
- Specs futuras ou exploratórias devem ser identificadas como roadmap, pesquisa ou futuro.
- Documentação viva, relatórios datados, arquivo histórico e propostas têm papéis distintos; localização ou existência do arquivo não prova entrega.
- `backendnest/swagger.yaml` é a referência oficial para contrato HTTP do backend.
- Divergências devem indicar as fontes envolvidas e a correção pendente; informações sem comprovação devem ser identificadas como não verificadas ou desatualizadas.
- Documentos de arquitetura devem ser revisados quando houver mudança estrutural.
- Documentos de testes devem ser atualizados quando números, estratégia ou cobertura mudarem.
- Não criar documento novo se já existir documento equivalente; revisar, fundir ou arquivar o existente.
- Relatórios em `docs/validacao/` registram auditorias e evidências, mas não substituem contratos oficiais.

## Arquivo histórico

A pasta `arquivo/` contém documentos preservados por valor histórico, rastreabilidade ou contexto de decisões anteriores. Eles podem mencionar caminhos antigos, fases concluídas ou planos que não representam o estado atual do sistema.

### Fase 1

- [Checklist Semana 1](arquivo/fase-1/CHECKLIST_SEMANA_1.md)
- [Fechamento da Fase 1](arquivo/fase-1/FECHAMENTO_FASE_1.md)
- [Guia Técnico da Fase 1](arquivo/fase-1/GUIA_TECNICO_FASE_1.md)

### Roadmaps antigos

- [Diagrama de Arquitetura Antigo](arquivo/roadmaps-antigos/DIAGRAMA_ARQUITETURA_ANTIGO.md)
- [Plano Executivo de Arquitetura](arquivo/roadmaps-antigos/PLANO_ARQUITETURA_EXECUTIVO.md)
- [Referência Rápida de Arquitetura](arquivo/roadmaps-antigos/REFERENCIA_RAPIDA_ARQUITETURA.md)
- [Roadmap Backend](arquivo/roadmaps-antigos/ROADMAP_BACKEND.md)

### Guias de implementação

- [Exemplo de Users Service Refatorado](arquivo/guias-de-implementacao/EXEMPLO_USERS_SERVICE_REFATORADO.md)
- [Guia Auth Session Frontend](arquivo/guias-de-implementacao/GUIA_AUTH_SESSION_FRONTEND.md)
- [Implementação Fase 1 Passo a Passo](arquivo/guias-de-implementacao/IMPLEMENTACAO_FASE_1_PASSO_A_PASSO.md)

### Relatórios de migração

- [Relatório Auth Session Frontend](arquivo/relatorios-de-migracao/RELATORIO_AUTH_SESSION_FRONTEND.md)
- [Relatório Rotas Protegidas Frontend](arquivo/relatorios-de-migracao/RELATORIO_ROTAS_PROTEGIDAS_FRONTEND.md)
- [Roteiro Demo Antigo](arquivo/relatorios-de-migracao/ROTEIRO_DEMO_ANTIGO.md)
