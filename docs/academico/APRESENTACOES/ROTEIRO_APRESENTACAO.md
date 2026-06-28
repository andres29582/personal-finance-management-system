# Roteiro de Apresentação

Objetivo: demonstrar que o Sistema de Gestao Financeira Pessoal funciona de ponta a ponta, com foco em valor para o usuario, integracao entre frontend/backend/ML e confiabilidade tecnica.

Tempo recomendado: 12 a 18 minutos.

## 0. Preparacao antes da banca

1. Verifique se o banco esta pronto e com as migracoes aplicadas.
2. Inicie o backend em `backendnest`:

```powershell
npm run start:dev
```

3. Inicie o frontend em `frontend`:

```powershell
npm run web
```

4. Se for demonstrar previsao de deficit, inicie a API de ML em `ml-finance-tcc`:

```powershell
python -m uvicorn api.app:app --host 0.0.0.0 --port 8000
```

5. Antes da apresentacao, rode a verificacao geral:

```powershell
.\scripts\verify-all.ps1 -SkipLocalhost
```

6. Tenha uma conta de demonstracao preparada ou use o cadastro ao vivo. Para reduzir risco, prefira uma conta ja populada e cadastre um usuario novo apenas se sobrar tempo.

## 1. Abertura

Mensagem sugerida:

> Este sistema centraliza a gestao financeira pessoal: contas, receitas, despesas, orcamentos, metas, dividas, relatorios, auditoria e previsao de deficit. A proposta e transformar dados financeiros dispersos em decisoes rapidas.

Mostre rapidamente:

- tela inicial ou login;
- arquitetura em uma frase: frontend Expo/React, backend NestJS, PostgreSQL e API de ML em Python/FastAPI;
- objetivo do MVP: registrar, organizar, analisar e prever.

Tempo: 1 minuto.

## 2. Autenticacao, seguranca e LGPD

Fluxo:

1. Abra a tela de cadastro.
2. Mostre campos obrigatorios, aceite de privacidade/LGPD e validacoes.
3. Faca login.
4. Explique que o backend retorna token JWT e o frontend usa esse token nas requisicoes autenticadas.
5. Mostre a tela de privacidade, se aplicavel.

O que destacar:

- usuario tem sessao protegida;
- existe recuperacao de senha;
- dados financeiros ficam associados ao usuario autenticado;
- ha preocupacao com privacidade e consentimento.

Tempo: 2 minutos.

## 3. Configuracao inicial do usuario

Fluxo:

1. Entre em `Contas`.
2. Crie uma conta principal, por exemplo:
   - Nome: Conta Corrente
   - Tipo: Corrente
   - Saldo inicial: 2500
3. Entre em `Categorias`.
4. Mostre que existem categorias padrao e que o usuario pode criar/editar categorias.

O que destacar:

- contas sao a base do saldo;
- categorias permitem classificar receitas e despesas;
- o saldo atual e calculado a partir do saldo inicial, transacoes e transferencias, em vez de ser apenas um valor manual.

Tempo: 2 minutos.

## 4. Fluxo principal: receita, despesa e dashboard

Fluxo:

1. Va para `Transacoes`.
2. Crie uma receita:
   - Tipo: Receita
   - Descricao: Salario
   - Valor: 5000
   - Conta: Conta Corrente
   - Categoria: Salario ou equivalente
3. Crie uma despesa:
   - Tipo: Despesa
   - Descricao: Mercado
   - Valor: 650
   - Conta: Conta Corrente
   - Categoria: Alimentacao ou equivalente
4. Volte ao `Dashboard`.
5. Mostre:
   - saldo total;
   - receitas do mes;
   - despesas do mes;
   - ultimas transacoes;
   - distribuicao por categoria, se visivel.

Mensagem sugerida:

> Aqui esta o ponto central do sistema: cada lancamento alimenta automaticamente os indicadores. O usuario nao precisa recalcular saldo nem montar planilhas manualmente.

O que destacar:

- integracao entre cadastro, transacoes e dashboard;
- validacao entre tipo da transacao e tipo da categoria;
- impacto imediato dos dados na visao consolidada.

Tempo: 3 minutos.

## 5. Planejamento: orcamentos, metas e alertas

Fluxo:

1. Abra `Orcamentos`.
2. Crie um orcamento mensal para uma categoria de despesa, por exemplo:
   - Categoria: Alimentacao
   - Mes atual
   - Limite: 800
3. Mostre o percentual utilizado apos a despesa cadastrada.
4. Abra `Metas`.
5. Crie uma meta simples, por exemplo:
   - Nome: Reserva de emergencia
   - Valor alvo: 10000
   - Valor atual: 2500
6. Abra `Alertas` e mostre o modulo de acompanhamento.

O que destacar:

- o sistema nao apenas registra o passado;
- ele apoia planejamento financeiro;
- orcamento alerta quando o consumo se aproxima do limite;
- metas ajudam o usuario a acompanhar objetivos.

Tempo: 3 minutos.

## 6. Transferencias, dividas e pagamentos

Fluxo:

1. Crie uma segunda conta, por exemplo `Poupanca`.
2. Abra `Transferencias`.
3. Transfira um valor da Conta Corrente para a Poupanca.
4. Explique que transferencias alteram saldos, mas nao entram como receita/despesa nos relatorios.
5. Abra `Dividas`.
6. Cadastre uma divida simples.
7. Mostre `Pagamentos de Divida`, se a tela estiver disponivel no ambiente.

O que destacar:

- transferencias preservam a leitura correta do fluxo financeiro;
- dividas e pagamentos ampliam a gestao alem de gastos comuns;
- o sistema diferencia movimentacao patrimonial de despesa real.

Tempo: 2 minutos.

## 7. Relatorios e tomada de decisao

Fluxo:

1. Abra `Relatorios`.
2. Filtre por periodo mensal ou intervalo.
3. Mostre resumo de receitas, despesas e categorias.
4. Compare rapidamente o que foi lancado com o que aparece no relatorio.

Mensagem sugerida:

> A diferenca entre registrar dados e gerar valor esta aqui: o sistema transforma os lancamentos em informacao para decidir onde cortar gastos, quanto sobrou e como o mes esta evoluindo.

O que destacar:

- filtros por periodo;
- agregacao por categoria;
- base para decisao financeira.

Tempo: 2 minutos.

## 8. Previsao de deficit com Machine Learning

Fluxo:

1. Abra `Previsao de Deficit`.
2. Informe ou carregue os dados necessarios.
3. Execute a previsao.
4. Explique o resultado como apoio a decisao, nao como verdade absoluta.

O que destacar:

- ha um servico separado de ML em Python/FastAPI;
- o backend NestJS integra esse servico;
- o modelo usa dados financeiros mensais para estimar risco de deficit;
- o modulo mostra evolucao do MVP para analise preditiva.

Tempo: 2 minutos.

## 9. Auditoria e confiabilidade

Fluxo:

1. Abra `Logs de Auditoria`.
2. Mostre eventos registrados, como criacao ou alteracao de dados.
3. Explique que isso melhora rastreabilidade.

Depois, se estiver em uma apresentacao tecnica, mostre no terminal:

```powershell
.\scripts\verify-all.ps1 -SkipLocalhost
```

O que destacar:

- testes automatizados no backend;
- testes automatizados no frontend;
- build do backend;
- logs de auditoria para transparencia;
- arquitetura modular por dominio.

Tempo: 2 minutos.

## 10. Fechamento

Mensagem sugerida:

> O sistema cumpre o ciclo completo da gestao financeira pessoal: entrada segura do usuario, configuracao das contas, registro de movimentacoes, calculo automatico de indicadores, planejamento, relatorios, auditoria e previsao de deficit. Isso mostra um MVP funcional, integrado e preparado para evolucao.

Finalize reforcando:

- problema resolvido: controle financeiro centralizado;
- valor entregue: visao clara de saldo, gastos, orcamentos, metas e dividas;
- diferencial tecnico: full stack integrado com modulo de ML;
- qualidade: testes, validacoes, autenticacao, auditoria e documentacao.

## Plano B para evitar riscos ao vivo

Se algo falhar durante a apresentacao:

1. Use uma conta ja preparada em vez de cadastrar do zero.
2. Se a API de ML nao iniciar, mostre os artefatos em `ml-finance-tcc/reports` e explique a integracao.
3. Se o frontend demorar, mostre as rotas estaticas em `frontend/smoke-web`.
4. Se o banco estiver sem dados, demonstre o fluxo minimo: login, conta, receita, despesa, dashboard.
5. Se os testes demorarem, mostre o script `scripts/verify-all.ps1` e mencione que ele executa testes de backend, build e testes de frontend.

## Checklist rapido no dia

- Backend rodando.
- Frontend rodando.
- Banco com dados de demo.
- ML rodando, se for usado.
- Usuario de demo anotado.
- Internet desnecessaria para o fluxo principal.
- Terminal aberto na raiz do projeto.
- Navegador aberto na tela de login.
- Roteiro aberto para consulta.
