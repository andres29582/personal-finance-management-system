# Sistema de Gestão Financeira Pessoal

Sistema full stack para gestão financeira pessoal, com backend NestJS,
frontend Expo/React Native e integração técnica com um módulo FastAPI de
Machine Learning para previsão de déficit mensal.

O projeto demonstra uma arquitetura modular de ponta a ponta, cobrindo regras
financeiras, autenticação com refresh token, dashboard, relatórios, auditoria,
testes automatizados e documentação técnica organizada.

## Destaques técnicos

- Backend NestJS modular por domínio, com TypeORM e PostgreSQL.
- Autenticação JWT com access token, refresh token e sessões persistidas.
- Frontend Expo/React Native com Expo Router e telas organizadas por módulo.
- API client com tratamento de sessão, bearer token e refresh automático.
- Dashboard financeiro, relatórios, orçamentos, metas, dívidas e auditoria.
- Integração backend-ML via contrato V2 para previsão de déficit.
- Testes em backend, frontend e módulo ML.
- Documentação ativa de arquitetura, runbook operacional local e estratégia de
  testes.

## Visão do produto

A aplicação centraliza a gestão financeira pessoal em uma única experiência. O
usuário pode registrar e acompanhar contas, receitas, despesas, transferências,
dívidas, pagamentos, orçamentos, metas e alertas.

O sistema também oferece um dashboard com indicadores financeiros e relatórios
por período, além de uma previsão experimental de déficit mensal baseada no
histórico financeiro agregado.

## Arquitetura em alto nível

```text
frontend/             Expo Router + React Native
   |
   | HTTP
   v
backendnest/          NestJS + TypeORM + PostgreSQL
   |
   | contrato ML V2
   v
ml-finance-tcc/       FastAPI + pipeline Python + modelo treinado
```

O frontend não chama a API de Machine Learning diretamente. A previsão passa
pelo backend, que autentica o usuário, reconstrói as features financeiras a
partir do histórico persistido, chama o serviço ML e valida a resposta antes de
entregar o DTO público ao frontend.

Documentos relacionados:

- [Arquitetura do Backend](docs/arquitetura/BACKEND.md)
- [Arquitetura do Frontend](docs/arquitetura/FRONTEND.md)
- [Arquitetura do Módulo de Machine Learning](docs/arquitetura/MACHINE_LEARNING.md)

## Stack por camada

### Backend

- NestJS
- TypeScript
- TypeORM
- PostgreSQL
- JWT e Passport
- Bcrypt
- Helmet, CORS e throttling
- Jest e Supertest

### Frontend

- Expo
- React Native
- Expo Router
- TypeScript
- Axios
- Expo Secure Store
- Jest
- Testing Library React Native

### Machine Learning

- Python
- FastAPI
- Pandas
- NumPy
- Scikit-learn
- Pydantic
- Pytest

## Funcionalidades implementadas

### Autenticação e usuário

- Cadastro de usuário.
- Login com JWT.
- Refresh token com sessão persistida.
- Logout com revogação de sessão.
- Fluxo de recuperação e reset de senha.
- Consentimento de privacidade no cadastro.
- Perfil do usuário.
- Consulta pública de CEP.

### Gestão financeira

- Contas financeiras.
- Categorias de receita e despesa.
- Receitas e despesas com exclusão lógica.
- Transferências entre contas.
- Dívidas.
- Pagamentos de dívida.
- Orçamentos mensais.
- Metas financeiras.
- Alertas.
- Relatórios por período.
- Dashboard financeiro.
- Logs de auditoria consultáveis pelo usuário.

### Previsão de déficit

- Endpoint backend `GET /previsoes/deficit?mes=YYYY-MM`.
- Serviço ML FastAPI com `POST /predict`.
- Contrato V2 com lista fechada de features.
- Validação de payload e resposta.
- Tratamento de indisponibilidade da API ML no backend.

## Machine Learning: previsão de déficit com contrato V2

O módulo `ml-finance-tcc/` implementa uma integração técnica e experimental de
Machine Learning para estimar se um mês objetivo pode terminar em déficit.

Pontos importantes:

- O problema é tratado como classificação binária mensal.
- A API ML usa FastAPI e recebe um vetor numérico agregado.
- O contrato atual usa `schema_version = 2`.
- A previsão usa apenas histórico anterior ao mês objetivo.
- Para prever o mês `M`, as features usam `M-3`, `M-2` e `M-1`.
- Receitas e despesas observadas em `M` não entram no payload de inferência.
- O dataset atual de treinamento é sintético.
- Não há reentrenamento automático com dados reais dos usuários.
- As métricas atuais não comprovam qualidade em produção.

Essa integração deve ser entendida como parte arquitetural do MVP, não como
recomendação financeira produtiva.

Documentos relacionados:

- [README do módulo ML](ml-finance-tcc/README.md)
- [Arquitetura do Módulo de Machine Learning](docs/arquitetura/MACHINE_LEARNING.md)
- [Dicionário de Dados do ML](ml-finance-tcc/docs/DICIONARIO_DE_DADOS.md)

## Qualidade e testes

O projeto possui testes distribuídos por camada:

- backend: testes unitários, controller tests e E2E com Jest/Supertest;
- frontend: testes de telas, services, storage, navegação e API client;
- ML: testes pytest para API, contrato, feature engineering, treinamento,
  avaliação e persistência;
- contrato backend-ML: validação de `schema_version`, lista de features,
  payload e resposta.

Comandos principais:

```powershell
cd backendnest
npm test -- --runInBand
npm run test:e2e
npm run build
```

```powershell
cd frontend
npm test -- --runInBand
npm run lint
npx tsc --noEmit
```

```powershell
cd ml-finance-tcc
python -m pytest
```

Documentação de testes:

- [Estratégia Geral de Testes](docs/desenvolvimento/TESTES.md)
- [Testes e Rastreabilidade do Frontend](docs/desenvolvimento/TESTES_FRONTEND.md)

## Como executar localmente

Pré-requisitos gerais:

- Node.js e npm.
- Python com ambiente virtual.
- PostgreSQL local.
- Banco criado conforme configuração do backend.

### 1. Backend

```powershell
cd backendnest
npm install
Copy-Item .env.example .env
```

Configure o `.env` local e aplique as migrations SQL em
`backendnest/migrations/`.

Depois, inicie a API:

```powershell
npm run start:dev
```

Backend esperado:

```text
http://localhost:3000
```

Healthcheck:

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
```

### 2. Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run web
```

Frontend esperado:

```text
http://localhost:8081
```

### 3. Machine Learning

O serviço ML é necessário apenas para validar a previsão de déficit com a API
externa ativa.

```powershell
cd ml-finance-tcc
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py train
python -m uvicorn api.app:app --host 0.0.0.0 --port 8000
```

API ML esperada:

```text
http://localhost:8000/health
```

### 4. Dados demo

Com backend configurado, banco disponível e migrations aplicadas:

```powershell
cd backendnest
npm run seed:demo
```

Credenciais demo:

```text
Email: demo.financeiro@exemplo.com
Senha: Demo@123456
```

### 5. Verificação integrada

A partir da raiz do repositório:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\verify-all.ps1 -SkipLocalhost
```

Com backend e frontend ativos:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\verify-all.ps1
```

Mais detalhes no [Runbook Operacional Local](docs/operacao/RUNBOOK.md).

## Documentação técnica

A documentação principal fica em `docs/`:

- [Índice da documentação](docs/README.md)
- [Arquitetura do Sistema](docs/arquitetura/ARQUITETURA.md)
- [Arquitetura do Backend](docs/arquitetura/BACKEND.md)
- [Arquitetura do Frontend](docs/arquitetura/FRONTEND.md)
- [Arquitetura do Módulo de Machine Learning](docs/arquitetura/MACHINE_LEARNING.md)
- [Estratégia Geral de Testes](docs/desenvolvimento/TESTES.md)
- [Runbook Operacional Local](docs/operacao/RUNBOOK.md)
- [Requisitos](docs/produto/REQUISITOS.md)
- [Manual do Usuário](docs/produto/MANUAL_DO_USUARIO.md)

READMEs específicos:

- [Backend NestJS](backendnest/README.md)
- [Frontend Expo](frontend/README.md)
- [ML Finance TCC](ml-finance-tcc/README.md)

## Status atual e limitações conhecidas

Este projeto está em fase de MVP técnico e portfólio. Ele demonstra arquitetura,
integração entre camadas, regras financeiras, testes e documentação, mas não
deve ser tratado como sistema pronto para uso produtivo real.

Limitações atuais:

- Não há garantia de deploy público ativo.
- Não há promessa de CI/CD completo configurado.
- O app não está publicado em lojas mobile.
- O módulo ML usa dataset sintético.
- O modelo não é reentrenado automaticamente.
- As métricas de ML não comprovam qualidade em produção.
- O uso futuro de dados reais exigiria privacidade, anonimização, base legal e
  validação adicional.
- Algumas rotinas dependem de configuração local de PostgreSQL e variáveis de
  ambiente.

## Roadmap futuro

Próximos passos possíveis, ainda como evolução futura:

- Refinar experiência visual e responsividade do frontend.
- Expandir estados de erro, vazio e carregamento nas telas financeiras.
- Ampliar cobertura E2E de fluxos financeiros críticos.
- Melhorar observabilidade local e documentação operacional.
- Evoluir relatórios e indicadores do dashboard.
- Avaliar integração real de e-mail para recuperação de senha.
- Investigar estratégia segura para uso de dados reais no módulo ML.
- Formalizar pipeline de validação contínua quando o projeto exigir.
