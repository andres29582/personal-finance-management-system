# Resumo de arquitetura

## Visao geral

O sistema esta dividido em duas aplicacoes:

- `frontend`: Expo Router, React Native Web, TypeScript, axios e armazenamento local para sessao.
- `backendnest`: NestJS, TypeORM e PostgreSQL.

## Fluxo principal

1. O usuario se cadastra ou faz login pelo frontend.
2. O backend devolve `access_token` e os dados basicos do usuario.
3. O frontend salva a sessao e envia o token em cada requisicao autenticada.
4. A API valida o JWT e resolve dados financeiros por dominio.

## Dominios do backend

- `auth`: cadastro, login e alteracao de senha.
- `contas`: contas com `saldoAtual` calculado na leitura.
- `categorias`: catalogo editavel com seed padrao para novos usuarios.
- `transacoes`: receitas e despesas.
- `dashboard`: resumo mensal consolidado.
- `orcamentos`: orcamento mensal por usuario.
- `relatorios`: leitura agregada por periodo.
- `metas`, `alertas`, `transferencias`, `dividas`, `pagos-divida`: modulos complementares do MVP.

## Decisoes-chave

- `transacoes` e a fonte para receitas e despesas.
- `transferencias` afetam o saldo das contas, mas nao entram em relatorios de receitas e despesas.
- `pagos-divida` cria e exclui sua `transacao` associada dentro de uma transacao de banco de dados.
- `saldoAtual` nao e persistido na tabela `conta`; ele e calculado a partir do saldo inicial, transacoes e transferencias.

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
