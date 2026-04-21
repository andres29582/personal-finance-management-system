# Resumo de arquitetura

## Visão geral

O sistema está dividido em duas aplicações:

- `frontend`: Expo Router, React Native Web, axios e armazenamento local para sessão.
- `backendnest`: NestJS, TypeORM e PostgreSQL.

## Fluxo principal

1. O usuário se cadastra ou faz login pelo frontend.
2. O backend devolve `access_token` e os dados básicos do usuário.
3. O frontend salva a sessão e envia o token em cada requisição.
4. A API valida o JWT e resolve dados financeiros por domínio.

## Domínios do backend

- `auth`: cadastro, login e alteração de senha.
- `contas`: contas com `saldoAtual` calculado na leitura.
- `categorias`: catálogo editável com seed padrão para novos usuários.
- `transacoes`: receitas e despesas.
- `dashboard`: resumo mensal consolidado.
- `orcamentos`: orçamento mensal por usuário.
- `relatorios`: leitura agregada por período.
- `metas`, `alertas`, `transferencias`, `dividas`, `pagos-divida`: módulos complementares do MVP.

## Decisões-chave

- `transacoes` é a única fonte para receitas e despesas.
- `transferencias` afetam o saldo das contas, mas não entram em relatórios de receitas e despesas.
- `pagos-divida` cria e exclui sua `transacao` associada dentro de uma transação de banco de dados.
- `saldoAtual` não é persistido na tabela `conta`; ele é calculado a partir do saldo inicial, transações e transferências.

## Frontend

- `app`: rotas e telas.
- `services`: clientes HTTP.
- `storage`: token e usuário.
- `types`: contratos TypeScript.
- `components`: blocos reutilizáveis.
- `utils`: formatação e tratamento simples de erros.
