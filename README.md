# Sistema de Gestão Financeira Pessoal

Sistema full stack para gerenciamento de finanças pessoais, desenvolvido como MVP acadêmico com foco em controle de contas, transações, orçamento, metas, dívidas, privacidade e visão consolidada do patrimônio.

## Visão geral

O projeto foi criado para permitir o acompanhamento da vida financeira de forma organizada, centralizando informações sobre entradas, saídas, contas, dívidas, objetivos financeiros e indicadores em um único sistema.

A proposta do sistema é responder perguntas importantes do dia a dia, como:

- Quanto dinheiro tenho disponível agora?
- Quanto gastei em determinado período?
- Em que categorias estou gastando mais?
- Estou gastando mais do que ganho?
- Quanto devo atualmente?
- Como meu patrimônio está evoluindo?

## Funcionalidades do MVP

O sistema cobre os principais módulos da gestão financeira pessoal:

- autenticação de usuário com cadastro, login, refresh token e recuperação de senha;
- consentimento LGPD no cadastro e tela de privacidade;
- gerenciamento de contas;
- gerenciamento de categorias;
- registro de receitas e despesas com exclusão lógica;
- cálculo de saldo atual em leitura;
- dashboard com saldos, receitas, despesas e gastos por categoria;
- orçamentos mensais;
- relatórios com gráficos;
- metas financeiras;
- alertas;
- transferências entre contas;
- dívidas e pagamentos de dívida;
- log de auditoria consultável pelo usuário;
- previsão de déficit via integração com serviço de ML.

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

### Machine Learning

- Python
- FastAPI
- Pandas
- Scikit-learn

## Estrutura do projeto

```bash
backendnest/     # API NestJS + TypeORM + PostgreSQL
frontend/        # aplicação Expo Router
docs/            # documentação de apoio, arquitetura, manual e demo
ml-finance-tcc/  # pipeline, modelo e API de previsão de déficit
```

## Como executar localmente

### Backend

1. Configure `backendnest/.env` com base em `backendnest/.env.example`.
2. Aplique as migrações em ordem em `backendnest/migrations/`, incluindo `0006_soft_delete_lgpd_password_reset.sql`.
3. Instale as dependências do backend.
4. Inicie a API.

### Frontend

1. Configure `frontend/.env` com base em `frontend/.env.example`.
2. Instale as dependências do frontend.
3. Inicie o Expo Web.

### ML

1. Entre em `ml-finance-tcc/`.
2. Crie e ative um ambiente virtual Python.
3. Instale as dependências de `requirements.txt`.
4. Execute o treino com `python main.py train`.
5. Inicie a API de previsão com `python -m uvicorn api.app:app --host 0.0.0.0 --port 8000`.

## Documentação

Os materiais de apoio do projeto estão em:

- `docs/resumo-arquitetura.md`
- `docs/manual-do-usuario.md`
- `docs/matriz-requisitos.md`
- `docs/roteiro-demo.md`
- `ml-finance-tcc/docs/`

## Status do projeto

Projeto em desenvolvimento, com foco na consolidação do MVP funcional, melhoria da rastreabilidade acadêmica e evolução gradual dos módulos complementares.

## Próximos passos

- melhorar a experiência do usuário no frontend;
- consolidar fluxos de dívida e pagamento;
- expandir relatórios e indicadores do dashboard;
- integrar envio real de e-mail no fluxo de recuperação de senha;
- acompanhar qualidade do modelo de previsão de déficit com dados reais;
- preparar versão de demonstração para apresentação.

## Objetivo do projeto

Além de atender ao escopo acadêmico, o sistema também foi desenvolvido como aplicação prática para estudo de arquitetura full stack, modelagem de dados, regras de negócio, organização modular de software e uso aplicado de machine learning em finanças pessoais.
