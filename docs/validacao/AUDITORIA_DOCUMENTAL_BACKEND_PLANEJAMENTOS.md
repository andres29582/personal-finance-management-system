# Auditoria Documental Backend - Planejamentos Compartilhados

Data: 2026-07-08
Branch: `codex/planejamentos-frontend-acertos-reapply`
Ultimo commit relacionado: `42b1684 fix(planejamentos): create owner participant with safe name`

## Resumo executivo

O backend real de Planejamentos Compartilhados esta implementado, testado e alinhado ao Swagger oficial para os 12 endpoints atualmente expostos. A migration `backendnest/migrations/0007_create_planejamentos_compartilhados.sql` esta alinhada com as entidades TypeORM e explica o erro local anterior em `POST /planejamentos`: ambientes sem essa migration aplicada nao possuem a tabela `planejamento` e retornam HTTP 500.

Foram encontradas divergencias documentais, sem necessidade de alterar codigo funcional nesta auditoria. As principais sao: `backendnest/README.md` ainda nao lista a migration 0007; `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md` contem uma nota desatualizada dizendo que o frontend nao consome Planejamentos; e os documentos conceituais em `docs/specs/planejamentos-compartilhados/` descrevem endpoints futuros que nao existem no controller atual.

## Escopo da auditoria

Fontes revisadas:

- `backendnest/src/planejamentos/`
- `backendnest/migrations/0007_create_planejamentos_compartilhados.sql`
- `backendnest/swagger.yaml`
- `backendnest/README.md`
- `docs/validacao/VALIDACAO_FLUXO_PLANEJAMENTOS.md`
- `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md`
- `docs/specs/planejamentos-compartilhados/`

Restricoes respeitadas:

- Nenhuma alteracao em frontend.
- Nenhuma alteracao em backend funcional.
- Nenhuma alteracao em Swagger.
- Auditoria registrada apenas neste documento.

## Estado real do backend

O modulo backend esta em `backendnest/src/planejamentos/` e usa `JwtAuthGuard` no controller inteiro. O controller expoe 12 handlers reais. O service implementa criacao, listagem, consulta por id, participantes, gastos, divisoes iguais, sugestoes de acertos, sincronizacao de acertos e transicoes pagar/cancelar/reabrir.

Na criacao de planejamento, o service executa transacao, cria o planejamento e cria automaticamente o participante proprietario. O nome do proprietario usa `usuario.nome` quando disponivel, senao o prefixo do email, senao `Proprietario`. Isso evita falha quando o payload autenticado nao traz nome.

O acesso e baseado em usuario autenticado. Um planejamento e acessivel ao criador ou a um participante ativo vinculado ao usuario. Acoes restritas ao proprietario usam validacao explicita no service. Erros esperados usam excecoes de aplicacao como `ValidationAppException`, `ResourceNotFoundException`, `ForbiddenResourceException` e `AppConflictException`.

## Mapa de entidades

| Entidade | Tabela | Migration | Entity TypeORM | Relacionamentos | Observacao |
|---|---|---|---|---|---|
| `Planejamento` | `planejamento` | Sim | Sim | Criador, participantes, gastos, acertos | Tabela principal; soft delete por `deleted_at`. |
| `ParticipantePlanejamento` | `participante_planejamento` | Sim | Sim | Planejamento, usuario opcional, gastos pagos, divisoes, acertos | Nome real da tabela difere do nome sugerido no pedido (`planejamento_participante`), mas migration e entity estao alinhadas. |
| `GastoPlanejamento` | `gasto_planejamento` | Sim | Sim | Planejamento, participante pagador, divisoes | Categoria e `varchar` nullable, sem FK para tabela de categorias. |
| `DivisaoGasto` | `divisao_gasto` | Sim | Sim | Gasto, participante | Nome real da tabela difere do nome sugerido no pedido (`planejamento_gasto_divisao`), mas migration e entity estao alinhadas. |
| `AcertoPlanejamento` | `acerto_planejamento` | Sim | Sim | Planejamento, participante devedor, participante recebedor | Possui indice unico parcial para acertos pendentes equivalentes. |

## Mapa de migrations

A migration `0007_create_planejamentos_compartilhados.sql` cria a extensao `pgcrypto`, as cinco tabelas do modulo, chaves primarias, chaves estrangeiras, checks de enums/status, checks de valores positivos, colunas de auditoria e indices de consulta.

Pontos confirmados:

- `planejamento.usuario_criador_id` referencia `usuario(id)` com `ON DELETE CASCADE`.
- `participante_planejamento.usuario_id` referencia `usuario(id)` com `ON DELETE SET NULL`.
- Participantes, gastos, divisoes e acertos referenciam seus agregados por FK.
- Ha checks para tipos e status de planejamento, participante, gasto, divisao e acerto.
- Ha checks para `valor_centavos > 0`, `valor_devido_centavos > 0` e formato opcional `YYYY-MM` de `mes_referencia`.
- Ha indices para listagens por planejamento/status/usuario/pagador.
- Ha unicidade parcial para participante ativo por usuario/email e para acerto pendente equivalente.
- Nao existe FK com categorias; a categoria de gasto compartilhado e texto opcional.

Conclusao: a migration esta coerente com as entities TypeORM. A divergencia de nomes existe apenas em relacao ao enunciado/spec esperada, nao entre codigo e banco.

## Mapa de endpoints

| Endpoint | Existe no controller | Existe no service | Existe no Swagger | Testado | Observacao |
|---|---|---|---|---|---|
| `POST /planejamentos` | Sim | Sim | Sim | Sim | Cria planejamento e participante proprietario em transacao. |
| `GET /planejamentos` | Sim | Sim | Sim | Sim | Lista planejamentos acessiveis ao usuario, com filtro opcional de status. |
| `GET /planejamentos/{id}` | Sim | Sim | Sim | Sim | Consulta planejamento acessivel com participantes. |
| `POST /planejamentos/{id}/participantes` | Sim | Sim | Sim | Sim | Somente proprietario; valida duplicidade. |
| `POST /planejamentos/{planejamentoId}/gastos` | Sim | Sim | Sim | Sim | Cria gasto e divisoes iguais em transacao. |
| `GET /planejamentos/{planejamentoId}/gastos` | Sim | Sim | Sim | Sim | Lista gastos do planejamento acessivel. |
| `GET /planejamentos/{planejamentoId}/gastos/{gastoId}` | Sim | Sim | Sim | Sim | Consulta gasto especifico ou retorna not found. |
| `GET /planejamentos/{planejamentoId}/acertos` | Sim | Sim | Sim | Sim | Calcula sugestoes de acertos sem persistir. |
| `POST /planejamentos/{planejamentoId}/acertos/sincronizar` | Sim | Sim | Sim | Sim | Persiste acertos pendentes ainda inexistentes. |
| `PATCH /planejamentos/{planejamentoId}/acertos/{acertoId}/pagar` | Sim | Sim | Sim | Sim | Proprietario ou devedor pode marcar pendente como pago. |
| `PATCH /planejamentos/{planejamentoId}/acertos/{acertoId}/cancelar` | Sim | Sim | Sim | Sim | Somente proprietario; cancela pendente ou pago. |
| `PATCH /planejamentos/{planejamentoId}/acertos/{acertoId}/reabrir` | Sim | Sim | Sim | Sim | Somente proprietario; reabre cancelado para pendente. |

Nao existem no controller atual endpoints para editar planejamento, fechar, arquivar, cancelar planejamento, deletar, listar/editar/remover participantes, editar/cancelar gasto, resumo financeiro ou replicar planejamento mensal. Esses endpoints aparecem em specs conceituais como escopo futuro.

## Mapa de regras de negocio

| Regra | Implementada no codigo | Documentada | Testada | Observacao |
|---|---|---|---|---|
| Criar planejamento autenticado | Sim | Sim | Sim | `POST /planejamentos` usa `req.user` e DTO validado. |
| Criar participante proprietario automaticamente | Sim | Sim | Sim | Usa nome seguro a partir de nome, email ou fallback `Proprietario`. |
| Validar periodo inicial/final | Sim | Sim | Sim | `dataFim` menor que `dataInicio` gera erro de validacao. |
| Listar apenas planejamentos acessiveis | Sim | Sim | Sim | Acesso por criador ou participante ativo vinculado. |
| Consultar detalhe apenas com acesso | Sim | Sim | Sim | Sem acesso retorna not found/erro de recurso. |
| Adicionar participante apenas como proprietario | Sim | Sim | Sim | `assertUsuarioProprietario` protege a acao. |
| Evitar participante duplicado | Sim | Sim | Sim | Duplicidade por usuario, email ou nome manual. |
| Criar gasto com pagador ativo do planejamento | Sim | Sim | Sim | Pagador deve ser participante ativo do planejamento. |
| Dividir gasto igualmente entre participantes | Sim | Sim | Sim | Dominio distribui centavos e rejeita lista vazia/duplicada. |
| Validar participantes da divisao | Sim | Sim | Sim | Todos devem pertencer ao planejamento e estar ativos. |
| Calcular acertos sugeridos | Sim | Sim | Sim | `GET /acertos` calcula saldos sem persistir novos acertos. |
| Sincronizar acertos pendentes | Sim | Sim | Sim | Evita duplicar pendencias equivalentes. |
| Pagar acerto | Sim | Sim | Sim | Exige status `PENDENTE`; permitido ao proprietario ou devedor. |
| Cancelar acerto | Sim | Sim | Sim | Somente proprietario; permitido para `PENDENTE` ou `PAGO`. |
| Reabrir acerto | Sim | Sim | Sim | Somente proprietario; permitido para `CANCELADO`. |
| Usar transacao em criacao de planejamento/gasto/acertos | Sim | Sim | Sim | Repository expoe `executarEmTransacao`. |

## Mapa Swagger x Backend

O Swagger oficial em `backendnest/swagger.yaml` possui a tag `Planejamentos`, os 12 paths reais e operationIds especificos:

- `createPlanejamento`
- `listPlanejamentos`
- `getPlanejamentoById`
- `addParticipantePlanejamento`
- `createGastoPlanejamento`
- `listGastosPlanejamento`
- `getGastoPlanejamentoById`
- `listAcertosPlanejamento`
- `syncAcertosPlanejamento`
- `payAcertoPlanejamento`
- `cancelAcertoPlanejamento`
- `reopenAcertoPlanejamento`

Os schemas do Swagger cobrem requests e responses principais, incluindo `CreatePlanejamentoRequest`, `AddParticipantePlanejamentoRequest`, `CreateGastoPlanejamentoRequest`, `Planejamento`, `ParticipantePlanejamento`, `GastoPlanejamento`, `DivisaoGastoPlanejamento`, `AcertoPlanejamento` e `AcertoPlanejamentoSugerido`. As respostas seguem o envelope padrao com `success`, `data`, `timestamp` e `requestId`.

Conclusao: Swagger esta alinhado ao backend implementado para o contrato atual.

## Mapa Documentacao x Backend

| Documento | Estado | Observacao |
|---|---|---|
| `docs/validacao/VALIDACAO_FLUXO_PLANEJAMENTOS.md` | Correto apos correcao | Registra que o 500 local foi causado por migration 0007 nao aplicada e que o fluxo passou apos aplicar a migration. |
| `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md` | Parcialmente desatualizado | Diz que Planejamentos tem 12/12 endpoints cobertos, mas ainda contem nota antiga de que o frontend nao consome o modulo. |
| `backendnest/swagger.yaml` | Alinhado | Contrato oficial reflete os 12 endpoints reais. |
| `backendnest/README.md` | Incompleto | Lista de migrations nao menciona `0007_create_planejamentos_compartilhados.sql`. |
| `docs/specs/planejamentos-compartilhados/api.md` | Conceitual/futuro | Inclui endpoints que nao existem no controller atual. |
| `docs/specs/planejamentos-compartilhados/testes.md` | Conceitual/futuro | Lista cenarios para endpoints ainda nao implementados. |
| `docs/specs/planejamentos-compartilhados/regras-de-negocio.md` | Parcialmente futuro | Contem regras de fechamento/arquivamento/cancelamento ainda sem endpoints atuais. |
| `docs/specs/planejamentos-compartilhados/modelo-de-dados.md` | Complementar | Serve como especificacao conceitual; o estado real deve ser lido contra migration/entities. |

## Divergencias encontradas

| Tipo | Local | Divergencia | Severidade | Recomendacao |
|---|---|---|---|---|
| Documentacao operacional | `backendnest/README.md` | Migration 0007 nao aparece na lista de migrations. | Alta | Atualizar README para incluir `0007_create_planejamentos_compartilhados.sql` e checklist de aplicacao. |
| Documentacao de validacao | `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md` | Nota antiga informa que o frontend nao consome Planejamentos, mas o frontend atual ja consome o modulo. | Media | Atualizar a linha historica ou marcar como obsoleta. |
| Spec conceitual x MVP | `docs/specs/planejamentos-compartilhados/api.md` | Descreve endpoints futuros nao existentes no controller atual. | Media | Marcar explicitamente como roadmap/futuro ou separar contrato atual de contrato planejado. |
| Spec conceitual x migration | Pedido/spec esperada | Nomes esperados `planejamento_participante`, `planejamento_gasto_divisao` diferem dos nomes reais `participante_planejamento`, `divisao_gasto`. | Baixa | Documentar nomes reais como fonte de verdade; nao alterar migration ja alinhada com entities. |
| Cobertura e2e especifica | `backendnest/test` | Nao foi identificado e2e dedicado ao fluxo completo de Planejamentos, embora testes unitarios/integrados passem. | Media | Adicionar e2e autenticado para criar planejamento, adicionar participante, gasto e acertos. |

## Documentacao correta

- Swagger oficial esta coerente com o controller atual.
- `VALIDACAO_FLUXO_PLANEJAMENTOS.md` registra corretamente a causa real do 500 local: migration de Planejamentos ausente na base.
- `VALIDACAO_ENDPOINTS_APIS.md` acerta ao indicar que Planejamentos tem 12 handlers e que o Swagger cobre os 12 handlers reais.
- As specs conceituais deixam claro em varios pontos que parte do escopo e planejado/futuro, embora isso ainda possa ficar mais explicito para evitar leitura como contrato atual.

## Documentacao incompleta

- Falta no `backendnest/README.md` mencionar a migration 0007.
- Falta uma pagina curta de contrato atual do backend de Planejamentos separada das specs conceituais.
- Falta checklist operacional para validar que a migration 0007 foi aplicada antes de testar frontend ou API em ambiente local.
- Falta documentar de forma destacada que categoria de gasto compartilhado e texto livre, nao FK para categorias.

## Documentacao desatualizada

- `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md` ainda contem a observacao "Frontend nao consome modulo" para Planejamentos.
- Specs conceituais citam endpoints ainda ausentes do controller atual: update, fechar, arquivar, cancelar planejamento, delete, participantes list/update/delete, gasto update/delete, resumo e replicar.

## Riscos encontrados

- Ambientes sem a migration 0007 aplicada continuam sujeitos a HTTP 500 em `POST /planejamentos`.
- Operadores/desenvolvedores podem deixar de aplicar a migration porque o README backend nao a lista.
- Consumidores podem interpretar specs conceituais como contrato atual e tentar chamar endpoints ainda nao implementados.
- A ausencia de e2e backend especifico do fluxo completo reduz protecao contra regressao entre auth, migration, repository e service.

## Recomendacoes

1. Atualizar `backendnest/README.md` com a migration 0007 e um passo explicito para aplica-la.
2. Atualizar `docs/validacao/VALIDACAO_ENDPOINTS_APIS.md` removendo ou marcando como historica a nota de que o frontend nao consome Planejamentos.
3. Separar "contrato atual" e "roadmap/futuro" nos documentos de `docs/specs/planejamentos-compartilhados/`.
4. Adicionar e2e backend autenticado para o fluxo minimo: criar planejamento, confirmar proprietario, adicionar participante, criar gasto, listar acertos, sincronizar e pagar/cancelar/reabrir.
5. Manter Swagger como fonte oficial do contrato atual enquanto as specs conceituais nao forem reconciliadas.

## Validacoes executadas

Estado inicial:

- `git status -sb`: limpo na branch `codex/planejamentos-frontend-acertos-reapply`.
- `git branch --show-current`: `codex/planejamentos-frontend-acertos-reapply`.
- `git log --oneline -10`: ultimo commit `42b1684 fix(planejamentos): create owner participant with safe name`.
- `docs/validacao/VALIDACAO_FLUXO_PLANEJAMENTOS.md`: presente.
- `docs/validacao/AUDITORIA_DOCUMENTAL_BACKEND_PLANEJAMENTOS.md`: nao existia antes desta auditoria.

Validacoes backend:

- `npm test -- --runInBand`: passou, 55 suites e 317 testes.
- `npm run test:e2e`: passou, 5 suites e 18 testes.
- `npm run build`: passou.
- `.\node_modules\.bin\eslint.cmd "{src,apps,libs,test}/**/*.ts"`: passou com exit code 0; 65 warnings preexistentes, sem erros e sem `--fix`.

MCP/GitNexus:

- `route_map` para `/planejamentos`: nao retornou rotas.
- `shape_check` para `/planejamentos`: nao retornou rotas com shapes/consumidores.
- `api_impact` para `/planejamentos`: nao encontrou rota.

Conclusao sobre MCP: o apoio foi tentado, mas o indice nao trouxe evidencia util para decorators Nest/rotas Expo neste caso. A auditoria foi baseada em codigo, migration, Swagger, docs e testes locais.

## Proximos passos

1. Corrigir documentacao operacional e historica listada em "Divergencias encontradas".
2. Criar e2e backend especifico para Planejamentos.
3. Reconciliar specs conceituais com o contrato atual antes de implementar novos endpoints.
4. Validar em cada ambiente que a migration 0007 foi aplicada antes de testar o fluxo pelo frontend.
