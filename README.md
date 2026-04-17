# Meu Sistema Financeiro

Monorepo do MVP do TCC de Gestao e Controle de Patrimonio (GCP).

## Estrutura

- `backendnest`: API NestJS + TypeORM + PostgreSQL.
- `frontend`: app Expo Router com foco inicial em web.
- `docs`: material de apoio para o TCC, onboarding e demo.

## Escopo atual do MVP

O projeto cobre o fluxo principal do MVP:

- cadastro e login;
- contas com saldo atual calculado em leitura;
- categorias com seed padrao por usuario;
- transacoes com validacao entre tipo da categoria e tipo da transacao;
- dashboard com saldos, receitas, despesas e gastos por categoria;
- orcamentos mensais;
- relatorios basicos;
- metas, alertas, transferencias, dividas e pagamentos de divida.

## Como subir localmente

1. Configure o backend usando `backendnest/.env.example`.
2. Aplique a baseline em `backendnest/migrations/0001_mvp_baseline.sql`.
3. Instale dependencias em `backendnest` e `frontend`.
4. Inicie a API.
5. Configure `frontend/.env.example`.
6. Inicie o Expo Web.

## Documentacao

- `docs/resumen-arquitectura.md`
- `docs/manual-usuario.md`
- `docs/matriz-requisitos.md`
- `docs/guion-demo.md`
