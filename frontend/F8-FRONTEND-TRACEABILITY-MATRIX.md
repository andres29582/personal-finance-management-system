# F8 - Matriz de rastreabilidade frontend

## Escopo

Esta matriz rastreia as rotas Expo Router do frontend contra telas reais em `src/modules`, servicos, fluxos de API, riscos funcionais e testes automatizados existentes.

Arquitetura considerada:

- `frontend/app/*`: apenas adaptadores finos de rota Expo Router.
- `frontend/src/modules/*`: telas, servicos, tipos e testes por dominio.
- `frontend/src/shared/*`: infraestrutura reutilizavel, API client, hooks, tipos e builders de teste.
- `frontend/services/*`, `frontend/types/*`, `frontend/hooks/*`: shims temporarios de compatibilidade, sem logica de negocio.

Status usado:

- **Coberto**: ha teste automatizado de tela/fluxo principal ou combinacao forte de teste de service + fluxo.
- **Parcial**: ha teste de service, storage, API client ou navegacao, mas a tela ainda nao tem teste dedicado.
- **Pendente**: nao ha teste frontend automatizado dedicado identificado.

## Matriz

| Tela | Servico | Fluxo | Risco | Teste | Status |
|---|---|---|---|---|---|
| Layout / guards (`app/_layout.tsx` -> `src/navigation/RootLayout.tsx`) | `authStorage`, `api` | Restaurar sessao, bloquear rotas protegidas, redirecionar auth/public | Acesso sem token, loop de redirect, render antes da sessao estar pronta | `__tests__/navigation/_layout.test.ts`, `protected-routes.test.ts`, `session-navigation.test.ts` | Coberto |
| Login (`app/login.tsx` -> `src/modules/auth/screens/LoginScreen.tsx`) | `authService`, `authStorage` | `POST /auth/login`, salvar access token, refresh token e usuario | Credenciais invalidas, resposta malformada, sessao nao salva | `src/modules/auth/__tests__/login.test.tsx`, `auth-flow.test.ts`, `authService.test.ts` | Coberto |
| Cadastro (`app/register.tsx` -> `src/modules/auth/screens/RegisterScreen.tsx`) | `authService`, `cepService` | `POST /auth/register`, lookup `GET /cep/:cep`, aceite LGPD | CPF/CEP invalidos, aceite LGPD ausente, erro 400/409 mal exibido | `src/modules/auth/__tests__/register.test.tsx`, `authService.test.ts` | Coberto |
| Esqueci senha (`app/forgot-password.tsx`) | `authService` | `POST /auth/forgot-password` | Email inexistente, erro generico, token de reset exibido incorretamente | `src/modules/auth/__tests__/authService.test.ts` | Parcial |
| Reset senha com token (`app/reset-password-token.tsx`) | `authService` | `POST /auth/reset-password-token` | Token expirado/invalido, nova senha fraca, mensagem inadequada | `src/modules/auth/__tests__/authService.test.ts` | Parcial |
| Reset senha autenticado (`app/reset-password.tsx`) | `authService`, `authStorage` | `POST /auth/reset-password`, logout/limpeza de sessao | Sessao antiga continuar ativa, usuario nao redirecionado | `src/modules/auth/__tests__/authService.test.ts`, `auth-flow.test.ts` | Parcial |
| Dashboard (`app/dashboard.tsx`) | `dashboardService`, `authService`, `authStorage` | `GET /dashboard`, logout `POST /auth/logout` | Totais incorretos, erro 401 sem limpeza, logout incompleto | `src/modules/dashboard/__tests__/dashboard.test.tsx`, `dashboardService.test.ts` | Coberto |
| Home legado (`app/home.tsx`) | `authService`, `authStorage` | Ler usuario local, logout, atalhos | Divergir do dashboard real, logout inconsistente | `src/modules/auth/__tests__/auth-flow.test.ts`, `__tests__/storage/authStorage.test.ts` | Parcial |
| Contas lista (`app/contas.tsx`) | `contaService` | `GET /contas`, `PATCH /contas/:id/desativar` | Conta inativa ainda exibida, 401 sem redirect, saldo mostrado errado | `src/modules/contas/__tests__/contaService.test.ts` | Parcial |
| Criar conta (`app/contas-create.tsx`) | `contaService` | `POST /contas` | Tipo invalido, saldo inicial incorreto, campos de cartao inconsistentes | `src/modules/contas/__tests__/contaService.test.ts` | Parcial |
| Editar conta (`app/contas-edit.tsx`) | `contaService` | `GET /contas/:id`, `PATCH /contas/:id` | Edicao de conta inexistente, update parcial invalido, retorno para lista falha | `src/modules/contas/__tests__/contaService.test.ts` | Parcial |
| Categorias lista (`app/categorias.tsx`) | `categoriaService` | `GET /categorias`, `PATCH /categorias/:id/desativar` | Categoria errada por tipo, item inativo exibido, 401 sem redirect | `src/modules/categorias/__tests__/categoriaService.test.ts` | Parcial |
| Categoria formulario (`app/categorias-form.tsx`) | `categoriaService` | `POST /categorias`, `GET /categorias/:id`, `PATCH /categorias/:id` | Tipo despesa/receita errado, nome vazio, erro de edicao silencioso | `src/modules/categorias/__tests__/categoriaService.test.ts` | Parcial |
| Transacoes lista (`app/transacoes.tsx`) | `transacaoService` | `GET /transacoes`, `DELETE /transacoes/:id` | Filtros errados, exclusao sem confirmacao efetiva, saldo desatualizado | `src/modules/transacoes/__tests__/transacaoService.test.ts` | Parcial |
| Transacao formulario (`app/transacoes-form.tsx`) | `transacaoService`, `contaService`, `categoriaService` | `GET /contas`, `GET /categorias`, `POST /transacoes`, `PATCH /transacoes/:id` | Categoria incompativel com tipo, valor invalido, conta ausente, erro de save | `src/modules/transacoes/__tests__/transacoes-form.test.tsx`, `transacaoService.test.ts` | Coberto |
| Transferencias lista (`app/transferencias.tsx`) | `transferenciaService` | `GET /transferencias`, `DELETE /transferencias/:id` | Origem/destino trocados, exclusao indevida, comissao ignorada | `src/modules/transferencias/__tests__/transferenciaService.test.ts` | Parcial |
| Transferencia formulario (`app/transferencias-form.tsx`) | `transferenciaService`, `contaService` | `GET /contas`, `POST /transferencias`, `PATCH /transferencias/:id` | Origem igual destino, valor/comissao invalidos, conta ausente | `src/modules/transferencias/__tests__/transferenciaService.test.ts` | Parcial |
| Dividas lista (`app/dividas.tsx`) | `dividaService` | `GET /dividas`, `PATCH /dividas/:id/desativar` | Divida inativa exibida, valores de vencimento incorretos, 401 sem redirect | `src/modules/dividas/__tests__/dividaService.test.ts` | Parcial |
| Divida formulario (`app/dividas-form.tsx`) | `dividaService`, `contaService` | `GET /contas`, `GET /dividas/:id`, `POST /dividas`, `PATCH /dividas/:id` | Datas invalidas, valor total/parcela invalido, conta associada errada | `src/modules/dividas/__tests__/dividaService.test.ts` | Parcial |
| Pagamentos de divida (`app/pagos-divida.tsx`) | `pagoDividaService`, `dividaService`, `contaService`, `categoriaService` | `GET /pagos-divida/divida/:id`, `POST /pagos-divida`, `DELETE /pagos-divida/:id` | Pagamento sem categoria despesa, saldo nao atualizado, divida errada | `src/modules/pagos-divida/__tests__/pagoDividaService.test.ts` | Parcial |
| Metas lista (`app/metas.tsx`) | `metaService` | `GET /metas`, `PATCH /metas/:id/desativar` | Meta inativa exibida, progresso incorreto, 401 sem redirect | `src/modules/metas/__tests__/metaService.test.ts` | Parcial |
| Meta formulario (`app/metas-form.tsx`) | `metaService`, `contaService`, `dividaService` | `GET /metas/:id`, `POST /metas`, `PATCH /metas/:id` | Vinculo conta/divida errado, valor alvo invalido, tipo meta incorreto | `src/modules/metas/__tests__/metaService.test.ts` | Parcial |
| Orcamentos lista (`app/orcamentos.tsx`) | `orcamentoService` | `GET /orcamentos?ano=` | Ano/filtro incorreto, total planejado errado, status mal interpretado | `src/modules/orcamentos/__tests__/orcamentoService.test.ts` | Parcial |
| Orcamento formulario (`app/orcamentos-form.tsx`) | `orcamentoService` | `GET /orcamentos/:id`, `POST /orcamentos`, `PATCH /orcamentos/:id` | Mes duplicado, valor planejado invalido, edicao de mes bloqueada incorretamente | `src/modules/orcamentos/__tests__/orcamentoService.test.ts` | Parcial |
| Relatorios (`app/relatorios.tsx`) | `relatorioService` | `GET /relatorios` com periodo/filtros | Periodo incorreto, totais divergentes, filtros ignorados | `src/modules/relatorios/__tests__/relatorioService.test.ts` | Parcial |
| Previsao deficit (`app/previsao-deficit.tsx`) | `previsaoService` | `GET /previsoes/deficit?mes=` | Mes invalido, falha ML sem feedback, interpretacao errada do risco | `src/modules/previsao-deficit/__tests__/previsaoService.test.ts` | Parcial |
| Alertas lista (`app/alertas.tsx`) | `alertaService` | `GET /alertas`, `PATCH /alertas/:id/desativar`, `PATCH /alertas/:id/notificar` | Alerta inativo exibido, referencia financeira invalida, notificacao duplicada | `src/modules/alertas/__tests__/alertaService.test.ts` | Parcial |
| Alerta formulario (`app/alertas-form.tsx`) | `alertaService`, `metaService`, `orcamentoService`, `dividaService` | `GET/POST/PATCH /alertas`, carregar referencias | Referencia de meta/orcamento/divida errada, regra de disparo invalida | `src/modules/alertas/__tests__/alertaService.test.ts` | Parcial |
| Audit logs (`app/audit-logs.tsx`) | `auditLogService` | `GET /audit-logs?limit=&offset=` | Vazamento de dados sensiveis, paginacao quebrada, 401 sem redirect | `src/modules/audit-logs/__tests__/auditLogService.test.ts` | Parcial |
| Usuario perfil (`app/usuario.tsx`) | `userService`, `authStorage`, `cepService` | `GET /users/me`, `PATCH /users/me`, lookup `GET /cep/:cep` | Perfil local divergente do backend, update parcial invalido, CEP incorreto | `src/modules/usuario/__tests__/userService.test.ts` | Parcial |
| Privacidade (`app/privacidade.tsx`) | N/A | Tela informativa LGPD | Texto desatualizado ou link de aceite inconsistente | Cobertura indireta via cadastro | Parcial |
| API client (`services/api.ts` -> `src/shared/services/api.ts`) | `api`, `authService`, `authStorage` | Bearer token, refresh `POST /auth/refresh`, retry 401, cleanup | Loop infinito, corrida de refresh, token ausente, refresh expirado | `__tests__/services/api.test.ts`, `auth-flow.test.ts` | Coberto |
| Auth storage (`storage/authStorage.ts`) | SecureStore/local storage | Salvar/remover token, refresh token, usuario, listeners | Usuario corrupto, listeners inconsistentes, limpeza parcial | `__tests__/storage/authStorage.test.ts`, `auth-flow.test.ts`, `session-navigation.test.ts` | Coberto |
| Tratamento de erro API (`utils/api-error.ts`) | `authStorage` | Resolver mensagens, limpar sessao em 401 | Mensagem errada, sessao expirada sem cleanup | `__tests__/utils/api-error.test.ts` | Coberto |

## Resumo de cobertura

| Categoria | Quantidade |
|---|---:|
| Coberto | 8 |
| Parcial | 26 |
| Pendente | 0 |

## Principais lacunas para proximas fases

1. Criar testes de tela para formularios e listas ainda cobertos apenas por service: categorias, metas, orcamentos, alertas, usuario, transferencias, dividas, pagamentos e previsao.
2. Adicionar teste dedicado para `src/shared/services/cepService.ts`, hoje coberto indiretamente por cadastro/perfil.
3. Expandir testes de telas financeiras de lista (`contas`, `transacoes`, `transferencias`, `dividas`) para cobrir carregamento, estado vazio, erro 401 e acoes de desativar/remover.
4. Manter builders tipados em `src/shared/test/builders/` como fonte unica de fixtures para evitar mocks desatualizados.

## Evidencia tecnica atual

Ultima verificacao conhecida nesta fase:

- `npm test -- --runInBand`: 27 suites / 329 tests passando.
- `npm run lint`: passando.
- `npx tsc --noEmit`: passando.
