# Matriz de rastreabilidade: requisito -> endpoint -> tela -> teste

Objetivo: mapear cada requisito funcional às rotas principais do backend, às telas envolvidas no frontend e ao cenário mínimo de validação ponta a ponta.

Convenções:
- A coluna Backend lista as rotas principais do fluxo, não todos os endpoints auxiliares.
- A coluna Frontend aponta a tela principal e, quando aplicável, as telas de criação ou edição.
- O teste sugerido descreve o cenário feliz mínimo; cenários de erro, permissão e borda devem ser derivados a partir dele.

| Requisito | Backend principal | Frontend | Teste sugerido | Observações |
| --- | --- | --- | --- | --- |
| Cadastro de usuário | `POST /auth/register` | `app/register.tsx` | Registrar novo usuário e validar criação do usuário e categorias iniciais | Fluxo público |
| Login | `POST /auth/login` | `app/login.tsx` | Fazer login com credenciais válidas e abrir dashboard autenticado | Fluxo público |
| Redefinição de senha | `POST /auth/reset-password` | `app/reset-password.tsx` | Alterar senha com sessão ativa e validar novo login | Exige sessão autenticada |
| Perfil do usuário | `GET /users/me`, `PATCH /users/me` | `app/usuario.tsx` | Atualizar dados do perfil e confirmar persistência após recarregar a tela | Fluxo autenticado |
| Contas | `POST /contas`, `GET /contas`, `PATCH /contas/:id` | `app/contas.tsx`, `app/contas-create.tsx`, `app/contas-edit.tsx` | Criar conta, editar dados e revisar saldo atual na listagem | Impacta saldos em outros módulos |
| Categorias | `POST /categorias`, `GET /categorias`, `PATCH /categorias/:id` | `app/categorias.tsx`, `app/categorias-form.tsx` | Criar categoria e filtrá-la por tipo na listagem | Base para transações e relatórios |
| Transações | `POST /transacoes`, `GET /transacoes`, `PATCH /transacoes/:id`, `DELETE /transacoes/:id` | `app/transacoes.tsx`, `app/transacoes-form.tsx` | Registrar uma receita e uma despesa e validar reflexo no saldo da conta | Fluxo central do domínio |
| Dashboard | `GET /dashboard` | `app/dashboard.tsx` | Revisar saldos consolidados e últimas transações após movimentações | Depende de dados de contas e transações |
| Orçamentos | `POST /orcamentos`, `GET /orcamentos`, `PATCH /orcamentos/:id` | `app/orcamentos.tsx`, `app/orcamentos-form.tsx` | Criar orçamento e revisar indicador/alerta de consumo | Relacionado a categorias e período |
| Relatórios | `GET /relatorios` | `app/relatorios.tsx` | Filtrar relatório por mês e trimestre e validar totais agregados | Depende de transações consistentes |
| Metas | `POST /metas`, `GET /metas`, `PATCH /metas/:id` | `app/metas.tsx`, `app/metas-form.tsx` | Criar meta e revisar progresso calculado após movimentações | Pode depender de conta ou dívida vinculada |
| Alertas | `POST /alertas`, `GET /alertas`, `PATCH /alertas/:id`, `PATCH /alertas/:id/notificar` | `app/alertas.tsx`, `app/alertas-form.tsx` | Criar alerta in-app e validar mudança de status/notificação | Possui ações específicas além do CRUD básico |
| Transferências | `POST /transferencias`, `GET /transferencias`, `PATCH /transferencias/:id`, `DELETE /transferencias/:id` | `app/transferencias.tsx`, `app/transferencias-form.tsx` | Transferir valor entre contas e revisar saldo de origem e destino | Deve preservar consistência entre duas contas |
| Dívidas | `POST /dividas`, `GET /dividas`, `PATCH /dividas/:id` | `app/dividas.tsx`, `app/dividas-form.tsx` | Criar dívida e listar pagamentos vinculados | Integra com pagamentos de dívida |
| Pagamentos de dívida | `POST /pagos-divida`, `GET /pagos-divida/divida/:dividaId`, `GET /pagos-divida/:id`, `DELETE /pagos-divida/:id` | `app/pagos-divida.tsx` | Registrar pagamento, validar vínculo com a dívida e confirmar transação associada | Depende de uma dívida previamente cadastrada |
| Recuperação de senha (esqueci) | `POST /auth/forgot-password`, `POST /auth/reset-password-token` | `app/forgot-password.tsx`, `app/reset-password-token.tsx` | Pedir reset por e-mail, usar token (ou fluxo dev com `AUTH_RETURN_RESET_TOKEN`) e validar novo login | Complementa `POST /auth/reset-password` autenticado |
| Log de auditoria (titular) | `GET /audit-logs` | `app/audit-logs.tsx` | Autenticado, listar eventos do próprio usuário com paginação | Dados sensíveis já mascarados no serviço de logs quando aplicável |
| Privacidade / LGPD (resumo) | — | `app/privacidade.tsx` | Leitura do texto e aceite no cadastro (`aceitoPoliticaPrivacidade`) | Documentação orientada ao titular |

## Próximos refinamentos recomendados

- Adicionar uma coluna de prioridade (`P0`, `P1`, `P2`) para ordenar execução de testes.
- Adicionar uma coluna de automação (`manual`, `integração`, `e2e`) para transformar a matriz em backlog de testes.
- Vincular cada linha ao arquivo de teste correspondente quando os testes começarem a ser implementados.
