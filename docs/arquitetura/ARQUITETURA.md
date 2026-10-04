# Arquitetura do Sistema Financeiro

## Visao geral

O sistema combina tres aplicacoes e um banco relacional:

| Componente | Responsabilidade e comunicacao |
| --- | --- |
| `frontend` | Expo Router, React Native Web e TypeScript; envia requisicoes HTTP autenticadas para a API NestJS. |
| `backendnest` | API REST NestJS; aplica regras financeiras, autenticacao e autorizacao, persiste via TypeORM e prepara features para o ML. |
| `ml-finance-tcc` | Servico FastAPI separado e pipeline de classificacao; recebe features da API em `POST /predict` e devolve previsao/probabilidade no contrato V2. |
| PostgreSQL | Persistencia de usuarios, sessoes, dados financeiros e auditoria do backend. |

A integracao ML passa pela API NestJS, nao por acesso direto do frontend ao
modelo. Esta descricao registra componentes integrados no codigo; nao comprova
execucao de containers, deploy ou estado de uma base real. Detalhes ficam em
[BACKEND.md](BACKEND.md) e no [README do ML](../../ml-finance-tcc/README.md).

## Fluxo principal

1. O usuario se cadastra ou faz login pelo frontend.
2. O login cria uma sessao e devolve `access_token`, `refresh_token` e dados do usuario.
3. O frontend envia o access token em requisicoes autenticadas.
4. A API valida o JWT e sua sessao ativa antes de resolver dados por dominio.
5. O refresh valida a sessao e rotaciona o refresh token; logout revoga a sessao,
   e reset de senha revoga as sessoes existentes.

O backend guarda apenas o hash do refresh token. Consulte o fluxo e os limites
de compatibilidade em [BACKEND.md](BACKEND.md), sem interpretar a existencia
desses mecanismos como certificacao de seguranca ou operacao real.

## Dominios do backend

- `auth`: cadastro, login, refresh, sessoes, logout e reset de senha.
- `contas`: contas com `saldoAtual` calculado na leitura.
- `categorias`: catalogo editavel com seed padrao para novos usuarios.
- `transacoes`: receitas e despesas.
- `dashboard`: resumo mensal consolidado.
- `orcamentos`: orcamento mensal global por usuario; alocacoes por categoria permanecem no backlog.
- `relatorios`: leitura agregada por periodo.
- `previsoes`: features historicas e integracao com o servico ML.
- `planejamentos`: planejamentos compartilhados, participantes, gastos e acertos.
- `metas`, `alertas`, `transferencias`, `dividas`, `pagos-divida`: modulos complementares do MVP.

## Decisoes-chave

- `transacoes` e a fonte para receitas e despesas; seu CRUD audita a mutacao na mesma transacao SQL.
- `transferencias` afetam o saldo das contas, mas nao entram em relatorios de receitas e despesas.
- `pagos-divida` cria e exclui sua `transacao` associada dentro de uma transacao de banco de dados.
- `saldoAtual` nao e persistido na tabela `conta`; ele e calculado a partir do saldo inicial, transacoes e transferencias.

As decisoes historicas de Planejamentos estao no
[ADR do modulo](../specs/planejamentos-compartilhados/adr-decisoes-implementacao.md).
Ele preserva contexto e clarificacoes posteriores; nao substitui o contrato HTTP.
Os limites de auditoria por modulo ficam em [BACKEND.md](BACKEND.md).

## Frontend

A arquitetura do frontend foi organizada de forma incremental por rotas finas, modulos de dominio e camada compartilhada.

- `app`: adaptadores finos do Expo Router. Cada arquivo exporta uma tela real ou layout de `src`.
- `src/modules`: dominios funcionais com `screens`, `services`, `types`, `components`, `hooks` e `__tests__` quando aplicavel.
- `src/shared`: infraestrutura reutilizavel, incluindo API client, hooks compartilhados, tipos compartilhados e builders de teste.
- `src/navigation`: layout raiz, guards de autenticacao e rota inicial.
- `services`, `types`, `hooks`: shims temporarios de compatibilidade para imports antigos; a logica nova deve importar de `src/modules` ou `src/shared`.
- `storage`: token, refresh token, usuario e listeners de sessao.
- `components`: blocos visuais reutilizaveis ainda compartilhados na raiz enquanto a migracao visual continua.
- `utils`: formatacao, validacao de entradas brasileiras, confirmacao e tratamento de erros.

Fluxo esperado nas telas:

```text
app/rota.tsx
  -> src/modules/<dominio>/screens/*Screen.tsx
  -> estado local/hook da tela
  -> src/modules/<dominio>/services/*Service.ts
  -> src/shared/services/api.ts
  -> backendnest
```

Os shims raiz existem apenas para compatibilidade temporaria; nao devem receber regras de negocio novas.
