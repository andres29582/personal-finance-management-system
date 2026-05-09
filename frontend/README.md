# Frontend Expo

Frontend em Expo Router, React Native, TypeScript e axios.

Documento de referencia rapido do projeto: ver `../README.md`, `../docs/manual-do-usuario.md`, `../docs/roteiro-demo.md` e `../docs/resumo-arquitetura.md`.

## Arquitetura local

- `app/`: somente rotas finas do Expo Router.
- `src/modules/`: telas, services, types e testes por dominio.
- `src/shared/`: API client, hooks/tipos compartilhados e builders de teste.
- `src/navigation/`: layout raiz, guard de sessao e rota inicial.
- `services/`, `types/`, `hooks/`: shims temporarios para compatibilidade com imports antigos.

Novas regras de tela, service ou tipo devem entrar em `src/modules` ou `src/shared`, nao nos shims raiz.

## Comandos principais

```bash
npm install
npm test -- --runInBand
npm run lint
npx tsc --noEmit
npx expo start
```

## Desenvolvimento

Este projeto usa file-based routing do Expo Router, mas os arquivos em `app/` devem permanecer como adaptadores finos. A implementacao real fica em `src/modules`, `src/shared` ou `src/navigation`.
