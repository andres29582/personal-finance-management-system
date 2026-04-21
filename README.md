# Sistema de Gestão Financeira Pessoal

Sistema full stack para gerenciamento de finanças pessoais, desenvolvido como MVP acadêmico com foco em controle de contas, transações, orçamento, metas, dívidas e visão consolidada do patrimônio.

## Visão geral

O projeto foi criado para permitir o acompanhamento da vida financeira de forma organizada, centralizando informações sobre entradas, saídas, contas, dívidas e objetivos financeiros em um único sistema.

A proposta do sistema é responder perguntas importantes do dia a dia, como:

- Quanto dinheiro tenho disponível agora?
- Quanto gastei em determinado período?
- Em que categorias estou gastando mais?
- Estou gastando mais do que ganho?
- Quanto devo atualmente?
- Como meu patrimônio está evoluindo?

## Funcionalidades do MVP

O sistema cobre os principais módulos da gestão financeira pessoal:

- autenticação de usuário com cadastro e login;
- gerenciamento de contas;
- gerenciamento de categorias;
- registro de receitas e despesas;
- cálculo de saldo atual em leitura;
- dashboard com saldos, receitas, despesas e gastos por categoria;
- orçamentos mensais;
- relatórios básicos;
- metas financeiras;
- alertas;
- transferências entre contas;
- dívidas e pagamentos de dívida.

## Stack utilizada

### Backend
- NestJS
- TypeORM
- PostgreSQL
- JWT
- Bcrypt
- ValidationPipe

### Frontend
- Expo
- React Native
- Expo Router
- execução inicial com foco em web

## Estrutura do projeto

```bash
backendnest/   # API NestJS + TypeORM + PostgreSQL
frontend/      # aplicação Expo Router
docs/          # documentação de apoio, arquitetura, manual e demo

Como executar localmente
1. Backend
configurar o arquivo backendnest/.env com base em backendnest/.env.example;
aplicar a baseline em backendnest/migrations/0001_mvp_baseline.sql;
instalar as dependências do backend;
iniciar a API.
2. Frontend
configurar o arquivo frontend/.env com base em frontend/.env.example;
instalar as dependências do frontend;
iniciar o Expo Web.
Documentação

Os materiais de apoio do projeto estão em:

docs/resumen-arquitectura.md
docs/manual-usuario.md
docs/matriz-requisitos.md
docs/guion-demo.md
Status do projeto

Projeto em desenvolvimento, com foco na consolidação do MVP funcional e evolução gradual dos módulos complementares.

Próximos passos
melhorar a experiência do usuário no frontend;
consolidar fluxos de dívida e pagamento;
expandir relatórios e indicadores do dashboard;
revisar a documentação técnica;
preparar versão de demonstração para apresentação.
Objetivo do projeto

Além de atender ao escopo acadêmico, o sistema também foi desenvolvido como aplicação prática para estudo de arquitetura full stack, modelagem de dados, regras de negócio e organização modular de software.
