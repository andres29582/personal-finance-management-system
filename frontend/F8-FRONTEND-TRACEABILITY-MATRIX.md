# F8 - Matriz de rastreabilidade frontend

## Escopo

Esta matriz rastreia as telas do frontend Expo/React Native contra servicos, fluxos de API, riscos funcionais e testes automatizados existentes.

Status usado:

- **Coberto**: ha teste automatizado de tela/fluxo principal ou combinacao forte de teste de service + fluxo.
- **Parcial**: ha teste de service, storage, API client ou navegacao, mas a tela ainda nao tem teste dedicado.
- **Pendente**: nao ha teste frontend automatizado dedicado identificado.

## Matriz

| Tela | Servico | Fluxo | Risco | Teste | Status |
|---|---|---|---|---|---|
| Layout / guards (`app/_layout.tsx`) | `authStorage`, `api` | Restaurar sessao, bloquear rotas protegidas, redirecionar auth/public | Acesso sem token, loop de redirect, render antes da sessao estar pronta | `__tests__/navigation/_layout.test.ts`, `protected-routes.test.ts`, `session-navigation.test.ts` | Coberto |
| Login (`app/login.tsx`) | `authService`, `authStorage` | `POST /auth/login`, salvar access token, refresh token e usuario | Credenciais invalidas, resposta malformada, sessao nao salva | `__tests__/auth/login.test.tsx`, `auth-flow.test.ts`, `services/authService.test.ts` | Coberto |
| Cadastro (`app/register.tsx`) | `authService`, `cepService` | `POST /auth/register`, lookup `GET /cep/:cep`, aceite LGPD | CPF/CEP invalidos, aceite LGPD ausente, erro 400/409 mal exibido | `__tests__/auth/register.test.tsx`, `services/authService.test.ts` | Coberto |
| Esqueci senha (`app/forgot-password.tsx`) | `authService` | `POST /auth/forgot-password` | Email inexistente, erro generico, token de reset exibido incorretamente | `__tests__/services/authService.test.ts` | Parcial |
| Reset senha com token (`app/reset-password-token.tsx`) | `authService` | `POST /auth/reset-password-token` | Token expirado/invalido, nova senha fraca, mensagem inadequada | `__tests__/services/authService.test.ts` | Parcial |
| Reset senha autenticado (`app/reset-password.tsx`) | `authService`, `authStorage` | `POST /auth/reset-password`, logout/limpeza de sessao | Sessao antiga continuar ativa, usuario nao redirecionado | `__tests__/services/authService.test.ts`, `__tests__/auth/auth-flow.test.ts` | Parcial |
| Dashboard (`app/dashboard.tsx`) | `dashboardService`, `authService`, `authStorage` | `GET /dashboard`, logout `POST /auth/logout` | Totais incorretos, erro 401 sem limpeza, logout incompleto | `__tests__/dashboard.test.tsx`, `services/dashboardService.test.ts` | Coberto |
| Home legado (`app/home.tsx`) | `authService`, `authStorage` | Ler usuario local, logout, atalhos | Divergir do dashboard real, logout inconsistente | `__tests__/auth/auth-flow.test.ts`, `storage/authStorage.test.ts` | Parcial |
| Contas lista (`app/contas.tsx`) | `contaService` | `GET /contas`, `PATCH /contas/:id/desativar` | Conta inativa ainda exibida, 401 sem redirect, saldo mostrado errado | `__tests__/services/contaService.test.ts` | Parcial |
| Criar conta (`app/contas-create.tsx`) | `contaService` | `POST /contas` | Tipo invalido, saldo inicial incorreto, campos de cartao inconsistentes | `__tests__/services/contaService.test.ts` | Parcial |
| Editar conta (`app/contas-edit.tsx`) | `contaService` | `GET /contas/:id`, `PATCH /contas/:id` | Edicao de conta inexistente, update parcial invalido, retorno para lista falha | `__tests__/services/contaService.test.ts` | Parcial |
| Categorias lista (`app/categorias.tsx`) | `categoriaService` | `GET /categorias`, `PATCH /categorias/:id/desativar` | Categoria errada por tipo, item inativo exibido, 401 sem redirect | Nao identificado | Pendente |
| Categoria formulario (`app/categorias-form.tsx`) | `categoriaService` | `POST /categorias`, `GET /categorias/:id`, `PATCH /categorias/:id` | Tipo despesa/receita errado, nome vazio, erro de edicao silencioso | Nao identificado | Pendente |
| Transacoes lista (`app/transacoes.tsx`) | `transacaoService` | `GET /transacoes`, `DELETE /transacoes/:id` | Filtros errados, exclusao sem confirmacao efetiva, saldo desatualizado | `__tests__/services/transacaoService.test.ts` | Parcial |
| Transacao formulario (`app/transacoes-form.tsx`) | `transacaoService`, `contaService`, `categoriaService` | `GET /contas`, `GET /categorias`, `POST /transacoes`, `PATCH /transacoes/:id` | Categoria incompatível com tipo, valor invalido, conta ausente, erro de save | `__tests__/transacoes-form.test.tsx`, `services/transacaoService.test.ts` | Coberto |
| Transferencias lista (`app/transferencias.tsx`) | `transferenciaService` | `GET /transferencias`, `DELETE /transferencias/:id` | Origem/destino trocados, exclusao indevida, comissao ignorada | `__tests__/services/transferenciaService.test.ts` | Parcial |
| Transferencia formulario (`app/transferencias-form.tsx`) | `transferenciaService`, `contaService` | `GET /contas`, `POST /transferencias`, `PATCH /transferencias/:id` | Origem igual destino, valor/comissao invalidos, conta ausente | `__tests__/services/transferenciaService.test.ts` | Parcial |
| Dividas lista (`app/dividas.tsx`) | `dividaService` | `GET /dividas`, `PATCH /dividas/:id/desativar` | Divida inativa exibida, valores de vencimento incorretos, 401 sem redirect | `__tests__/services/dividaService.test.ts` | Parcial |
| Divida formulario (`app/dividas-form.tsx`) | `dividaService`, `contaService` | `GET /contas`, `GET /dividas/:id`, `POST /dividas`, `PATCH /dividas/:id` | Datas invalidas, valor total/parcela invalido, conta associada errada | `__tests__/services/dividaService.test.ts` | Parcial |
| Pagamentos de divida (`app/pagos-divida.tsx`) | `pagoDividaService`, `dividaService`, `contaService`, `categoriaService` | `GET /pagos-divida/divida/:id`, `POST /pagos-divida`, `DELETE /pagos-divida/:id` | Pagamento sem categoria despesa, saldo nao atualizado, divida errada | `__tests__/services/pagoDividaService.test.ts` | Parcial |
| Metas lista (`app/metas.tsx`) | `metaService` | `GET /metas`, `PATCH /metas/:id/desativar` | Meta inativa exibida, progresso incorreto, 401 sem redirect | Nao identificado | Pendente |
| Meta formulario (`app/metas-form.tsx`) | `metaService`, `contaService`, `dividaService` | `GET /metas/:id`, `POST /metas`, `PATCH /metas/:id` | Vinculo conta/divida errado, valor alvo invalido, tipo meta incorreto | Nao identificado | Pendente |
| Orcamentos lista (`app/orcamentos.tsx`) | `orcamentoService` | `GET /orcamentos?ano=` | Ano/filtro incorreto, total planejado errado, categoria duplicada | Nao identificado | Pendente |
| Orcamento formulario (`app/orcamentos-form.tsx`) | `orcamentoService`, `categoriaService` | `GET /orcamentos/:id`, `POST /orcamentos`, `PATCH /orcamentos/:id` | Mes/categoria duplicados, valor planejado invalido, categoria nao despesa | Nao identificado | Pendente |
| Relatorios (`app/relatorios.tsx`) | `relatorioService` | `GET /relatorios` com periodo/filtros | Periodo incorreto, totais divergentes, filtros ignorados | `__tests__/services/relatorioService.test.ts` | Parcial |
| Previsao deficit (`app/previsao-deficit.tsx`) | `previsaoService` | `GET /previsoes/deficit?mes=` | Mes invalido, falha ML sem feedback, interpretacao errada do risco | Nao identificado | Pendente |
| Alertas lista (`app/alertas.tsx`) | `alertaService` | `GET /alertas`, `PATCH /alertas/:id/desativar` | Alerta inativo exibido, referencia financeira invalida, notificacao duplicada | Nao identificado | Pendente |
| Alerta formulario (`app/alertas-form.tsx`) | `alertaService`, `metaService`, `orcamentoService`, `dividaService` | `GET/POST/PATCH /alertas`, carregar referencias | Referencia de meta/orcamento/divida errada, regra de disparo invalida | Nao identificado | Pendente |
| Audit logs (`app/audit-logs.tsx`) | `auditLogService` | `GET /audit-logs?limit=&offset=` | Vazamento de dados sensiveis, paginacao quebrada, 401 sem redirect | Nao identificado | Pendente |
| Usuario perfil (`app/usuario.tsx`) | `userService`, `authStorage` | `GET /users/me`, `PATCH /users/me` | Perfil local divergente do backend, update parcial invalido | Nao identificado | Pendente |
| Privacidade (`app/privacidade.tsx`) | N/A | Tela informativa LGPD | Texto desatualizado ou link de aceite inconsistente | Cobertura indireta via cadastro | Parcial |
| API client (`services/api.ts`) | `api`, `authService`, `authStorage` | Bearer token, refresh `POST /auth/refresh`, retry 401, cleanup | Loop infinito, corrida de refresh, token ausente, refresh expirado | `__tests__/services/api.test.ts`, `auth-flow.test.ts` | Coberto |
| Auth storage (`storage/authStorage.ts`) | SecureStore/local storage | Salvar/remover token, refresh token, usuario, listeners | Usuario corrupto, listeners inconsistentes, limpeza parcial | `__tests__/storage/authStorage.test.ts`, `auth-flow.test.ts`, `session-navigation.test.ts` | Coberto |
| Tratamento de erro API (`utils/api-error.ts`) | `authStorage` | Resolver mensagens, limpar sessao em 401 | Mensagem errada, sessao expirada sem cleanup | `__tests__/utils/api-error.test.ts` | Coberto |

## Resumo de cobertura

| Categoria | Quantidade |
|---|---:|
| Coberto | 8 |
| Parcial | 15 |
| Pendente | 11 |

## Principais lacunas para proximas fases

1. Criar testes de tela para os formularios sem cobertura dedicada: categorias, metas, orcamentos, alertas, usuario e previsao.
2. Criar testes de service para `categoriaService`, `metaService`, `orcamentoService`, `alertaService`, `auditLogService`, `previsaoService`, `userService` e `cepService`.
3. Expandir testes de telas financeiras de lista (`contas`, `transacoes`, `transferencias`, `dividas`) para cobrir carregamento, estado vazio, erro 401 e acoes de desativar/remover.
4. Manter builders tipados em `src/shared/test/builders/` como fonte unica de fixtures para evitar mocks desatualizados.

## Evidencia tecnica atual

Ultima verificacao conhecida antes desta matriz:

- `npm test -- --runInBand`: 20 suites / 300 tests passando.
- `npm run lint`: passando.
- `npx tsc --noEmit`: passando.
