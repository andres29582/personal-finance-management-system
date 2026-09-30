# Frontend Expo

Frontend em Expo Router, React Native, TypeScript e axios.

Documento de referencia rapido do projeto: ver `../README.md`, `../docs/produto/MANUAL_DO_USUARIO.md`, `../docs/arquivo/relatorios-de-migracao/ROTEIRO_DEMO_ANTIGO.md` e `../docs/arquitetura/ARQUITETURA.md`.

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

## Teste em telefone com Expo Go

Em uma Wi-Fi de desenvolvimento confiavel, crie `frontend/.env` a partir de
`.env.example` e troque `localhost` pelo IPv4 LAN do computador:

```text
EXPO_PUBLIC_API_URL=http://<HOST_LAN_IP>:3000
```

Inicie a API, confirme `http://<HOST_LAN_IP>:3000/health` no navegador do
telefone e depois execute:

```powershell
npm run start:standard -- --lan
```

Escaneie o QR com Expo Go. Consulte `../docs/operacao/RUNBOOK.md` para
Firewall, CORS do navegador (opcional) e o smoke test minimo. `npm run start`
mantem o modo offline; para LAN, use `start:standard`.

## Desenvolvimento

Este projeto usa file-based routing do Expo Router, mas os arquivos em `app/` devem permanecer como adaptadores finos. A implementacao real fica em `src/modules`, `src/shared` ou `src/navigation`.
