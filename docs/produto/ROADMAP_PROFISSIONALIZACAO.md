# Roadmap de Profissionalização do Sistema Financeiro

## 1. Objetivo da fase de profissionalização

Este roadmap consolida a fase de profissionalização anteriormente tratada como Opção D durante o planejamento inicial.

A fase de profissionalização define a Fase 2 de profissionalização do sistema financeiro com foco em converter o MVP atual em um projeto reproduzível, pronto para deploy, testável e apresentável como solução profissional.

O objetivo não é introduzir grandes mudanças funcionais nem refactors arquitetônicos profundos nesta etapa. A prioridade é criar uma base operacional confiável para que o sistema possa ser executado, validado, demonstrado e eventualmente publicado de forma consistente.

Esta fase prioriza:

- reproducibilidad local;
- documentação clara de ambientes;
- contenedorizacion gradual;
- migrações e seed demo controlados;
- CI/CD completo;
- segurança base;
- deploy demo;
- documentação operativa;
- avaliação futura de integrações Open Finance.

## 2. Estado atual do sistema

O repositório já contém uma base técnica avançada para um MVP acadêmico/profissional:

- Backend NestJS en `backendnest/`.
- Frontend Expo/React Native Web en `frontend/`.
- Modulo ML/FastAPI en `ml-finance-tcc/`.
- Base PostgreSQL modelada com TypeORM e migrações SQL versionadas.
- Autenticação com JWT, refresh token, sessões e recuperação de senha.
- Logs de auditoria consultables por usuario.
- Seed demo existente para carga de datos de presentacion.
- Testes unitários e de integração em backend, frontend e ML.
- Workflow inicial de GitHub Actions para frontend y backend.
- Documentação de arquitetura, demo, manual de usuário e estabilização local.

A Fase 1 arquitetônica já deixou implementados padrões importantes como Repository Pattern, exceções tipificadas e response wrapper. Por isso, a fase de profissionalização se apoia nessa base e muda o foco para operações, reproducibilidade e entrega profissional.

## 3. Fortalezas já existentes

- Backend modular por domínios: auth, users, contas, categorias, transações, dashboard, orçamentos, relatórios, previsões, dívidas, metas, alertas, transferências e auditoria.
- TypeORM configurado con `synchronize: false`, reduciendo riesgo de alteraciones automaticas de schema.
- Migraciones SQL versionadas en `backendnest/migrations/`.
- Segurança básica já presente no backend: `helmet`, CORS por lista branca, throttling global, `ValidationPipe` com whitelist e rejeição de campos extras.
- Autenticação com access token, refresh token, rotação de refresh token e persistência de sessões.
- Tokens sensibles persistidos como hash en backend.
- Logs de auditoria com sanitização de campos sensíveis como token, senha/password, email e CPF.
- Frontend com separação progressiva entre rotas finas, módulos de domínio e camada compartilhada.
- Cliente Axios com unwrap do response wrapper e refresh automático de token.
- ML com contrato V2 estrito, validação de schema, manifesto de features e testes HTTP.
- Seed demo documentado en `docs/estabilizacion-local.md`.
- CI inicial existente en `.github/workflows/ci.yml`.
- Documentação reutilizável para arquitetura, demo, frontend e fechamento da Fase 1.

## 4. Brechas técnicas principais

As brechas principais não são de funcionalidade de negócio, mas de preparação operacional:

- Não existe Dockerfile nem `docker-compose` para levantar o sistema completo de forma reproduzível.
- CI actual no cubre el modulo ML ni una ejecucion e2e completa con PostgreSQL.
- No existe una estrategia formal de deploy demo.
- As migrações SQL existem, mas não há um fluxo único documentado e automatizável para aplicá-las em ambientes novos.
- O seed demo existe, mas precisa de contrato operacional: quando usar, onde, com quais variáveis e quais garantias oferece.
- `.gitignore` é mínimo e não protege suficientemente arquivos locais como `.env`, builds, caches ou artefatos temporários.
- Os `.env.example` existem, mas falta uma matriz formal de variáveis por ambiente e serviço.
- FastAPI ML permite CORS abierto, aceptable en local pero no en un entorno demo publico.
- Swagger atual é estático e pode ficar dessincronizado do backend real.
- README de backend todavia conserva contenido generico del starter de NestJS.
- Falta documentação operativa: runbook, rollback, troubleshooting, health checks e checklist pré-demo.
- Não há modelo formal de segurança base para segredos, CORS, logs, tokens, dependências e exposição pública.

## 5. Roadmap dividido en sprints

### Sprint 1: Configuração, gitignore, env examples e documentação de ambientes

Prioridad: Alta.

Objetivo: estabelecer uma base limpa e segura de configuração antes de contêineres ou deploy.

Alcance:

- Revisar e ampliar `.gitignore` para proteger `.env`, caches, builds, logs temporários e artefatos locais.
- Estandarizar `.env.example` por servicio.
- Criar documentação de variáveis obrigatórias, opcionais e sensíveis.
- Definir matriz de ambientes: local, test, CI, demo e futuro production.
- Definir convenções de portas, URLs internas e URLs públicas.
- Documentar secretos que nunca deben versionarse.

Critérios de aceitação:

- Existe uma documentação clara de variáveis por serviço.
- Un nuevo desarrollador puede preparar `.env` local sin adivinar valores.
- `.env` reales y secretos quedan protegidos por `.gitignore`.
- A matriz de ambientes diferencia local, CI e demo.
- No se modifica codigo fuente ni dependencias durante este sprint salvo que se apruebe explicitamente.

### Sprint 2: Docker local con PostgreSQL, backend, ML API y frontend

Prioridad: Alta.

Objetivo: permitir levantar o sistema completo com um fluxo local reproduzível.

Alcance:

- Definir Dockerfile para backend.
- Definir Dockerfile para ML API.
- Definir estrategia para frontend web en modo desarrollo o build estatico, segun necesidad.
- Crear `docker-compose` local con PostgreSQL, backend, ML API y frontend.
- Configurar healthchecks basicos.
- Definir red interna entre servicios.
- Documentar comandos de inicio, parada, logs y troubleshooting.

Critérios de aceitação:

- O stack local levanta com um comando documentado.
- Backend puede conectarse a PostgreSQL del compose.
- Backend puede consultar ML API por nombre de servicio interno.
- Frontend puede consumir backend mediante URL configurada.
- Healthchecks de backend y ML responden.
- O fluxo não exige instalar PostgreSQL local fora do Docker.

### Sprint 3: Migrações e seed demo reproduzível

Prioridad: Alta.

Objetivo: garantizar que una base nueva pueda pasar de cero a demo funcional con pasos controlados.

Alcance:

- Definir comando o script oficial para aplicar migraciones SQL en orden.
- Documentar precondiciones de migracion.
- Documentar rollback esperado o estrategia de recuperacion.
- Formalizar contrato del seed demo.
- Validar que seed demo no afecte usuarios no-demo.
- Documentar credenciales demo y datos generados.
- Integrar migraciones y seed al flujo Docker local, sin convertirlo aun en deploy productivo.

Critérios de aceitação:

- Una base vacia puede inicializarse con migraciones en orden.
- O seed demo deixa dados suficientes para dashboard, contas, transações, orçamentos, metas, dívidas, alertas e previsão.
- O usuário demo fica documentado.
- O seed é repetível sem destruir dados alheios.
- Existe documentação para resolver falhas comuns de migração.

### Sprint 4: CI/CD completo con backend, frontend, ML y e2e

Prioridad: Alta.

Objetivo: convertir la validacion automatica en una puerta confiable de calidad.

Alcance:

- Manter lint, typecheck, testes e build de backend.
- Manter lint, typecheck e testes de frontend.
- Agregar tests del modulo ML con `pytest`.
- Agregar job de backend e2e con servicio PostgreSQL en CI.
- Separar jobs por responsabilidad y cachear dependencias.
- Publicar artefactos utiles cuando falle: logs, coverage o reportes basicos.
- Definir checks obligatorios para merge.

Critérios de aceitação:

- CI valida backend, frontend y ML.
- CI ejecuta e2e contra PostgreSQL efimero.
- Fallas entregan diagnostico suficiente.
- Não há passos que modifiquem código durante CI.
- Os comandos de CI estão documentados e podem ser reproduzidos localmente.

### Sprint 5: Segurança base

Prioridad: Alta.

Objetivo: reduzir riscos evidentes antes de expor um deploy demo.

Alcance:

- Revisar CORS de backend y ML por entorno.
- Revisar exposicion de tokens en frontend web.
- Definir política mínima de segredos.
- Revisar logs para evitar datos sensibles.
- Definir checklist OWASP basico para API.
- Revisar headers HTTP.
- Revisar rate limiting e endpoints públicos de auth.
- Definir prática de secret scanning antes de deploy.
- Revisar dependencias con auditoria disponible del ecosistema.

Critérios de aceitação:

- CORS no queda abierto en entorno demo.
- Variáveis sensíveis são documentadas como segredos.
- No se imprimen secretos reales en logs de deploy.
- Endpoints públicos ficam inventariados.
- Existe checklist de segurança base antes de demo.

### Sprint 6: Deploy demo

Prioridad: Media-Alta.

Objetivo: publicar uma versão demo estável para apresentação profissional.

Alcance:

- Elegir estrategia de hosting para backend, frontend, ML y PostgreSQL.
- Definir si ML se despliega como servicio separado o queda opcional para demo.
- Configurar variables del entorno demo.
- Ejecutar migraciones en demo.
- Cargar seed demo controlado.
- Validar smoke test post-deploy.
- Documentar URLs públicas e credenciais demo.
- Definir criterio de disponibilidad minima para presentacion.

Critérios de aceitação:

- Existe una URL demo documentada para frontend.
- Backend demo responde health check.
- ML demo responde health check si se incluye en el alcance.
- Usuario demo puede iniciar sesion.
- Dashboard muestra datos.
- Fluxo mínimo de demo funciona: login, dashboard, contas, transações, relatórios e previsão se ML estiver ativo.
- Existe procedimiento de redeploy o recuperacion.

### Sprint 7: Documentacion operativa

Prioridad: Media.

Objetivo: dejar el proyecto entendible, mantenible y demostrable sin depender de memoria informal.

Alcance:

- Crear runbook local.
- Crear runbook de demo.
- Crear guia de troubleshooting.
- Crear checklist pre-demo.
- Actualizar README raiz.
- Reemplazar contenido generico del README de backend por contenido especifico del proyecto.
- Consolidar referencias a docs existentes.
- Documentar arquitectura final de Fase 2.

Critérios de aceitação:

- Um terceiro pode levantar o projeto localmente seguindo a documentação.
- Un tercero puede ejecutar la demo siguiendo un guion claro.
- Problemas comunes tienen pasos de diagnostico.
- README raiz explica stack, arquitetura, comandos e docs principais.
- README de backend deja de depender del texto generico del starter.

### Sprint 8: Evaluacion futura de Open Finance

Prioridad: Media-Baja.

Objetivo: avaliar integração futura com Open Finance sem comprometer a segurança nem o alcance atual.

Alcance:

- Investigar requisitos técnicos e regulatórios de Open Finance.
- Separar datos manuales actuales de datos importados futuros.
- Identificar domínios impactados: contas, transações, consentimentos, auditoria e privacidade.
- Definir riscos de privacidade, consentimento, retenção e revogação.
- Proponer una arquitectura inicial de integracion futura.
- Crear ADR de decision: integrar ahora, postergar o simular con importacion controlada.

Critérios de aceitação:

- Existe documento de avaliação com opções e riscos.
- No se implementan integraciones reales en esta fase.
- Define-se quais dados poderiam ser importados e sob quais regras.
- São identificadas dependências legais e de segurança antes de qualquer desenvolvimento.

## 6. Prioridad de cada sprint

| Sprint | Tema | Prioridad | Razon |
| --- | --- | --- | --- |
| 1 | Configuração e ambientes | Alta | Base necessária para evitar erros e segredos expostos |
| 2 | Docker local | Alta | Reproducibilidad del sistema completo |
| 3 | Migraciones y seed demo | Alta | Demo confiable desde base limpia |
| 4 | CI/CD completo | Alta | Calidad automatizada antes de deploy |
| 5 | Seguridad base | Alta | Requisito antes de exponer demo |
| 6 | Deploy demo | Média-Alta | Entrega apresentável e validável |
| 7 | Documentação operativa | Média | Sustentabilidade e transferência |
| 8 | Open Finance futuro | Média-Baixa | Exploratório, não bloqueia a profissionalização inicial |

## 7. Critérios de aceitação gerais

A fase de profissionalização se considera completada quando:

- O projeto pode ser levantado localmente com documentação clara.
- Existe un flujo Docker local funcional para los servicios principales.
- Um banco PostgreSQL vazio pode ser inicializado com migrações e seed demo.
- CI valida backend, frontend, ML y e2e.
- Existe uma versão demo publicada ou um procedimento de deploy demo validado.
- Os segredos e variáveis de ambiente estão documentados e não versionados.
- CORS, logs e endpoints públicos têm uma revisão mínima de segurança.
- A documentação permite operar o projeto sem depender do autor original.
- Queda documentada la decision sobre Open Finance como evaluacion futura, no como implementacion inmediata.

## 8. Fora do alcance por enquanto

Não fazem parte da fase de profissionalização inicial:

- Implementar CQRS en modulos de negocio.
- Agregar Redis cache.
- Migrar de TypeORM a otro ORM.
- Implementar microservicios.
- Implementar Open Finance real.
- Implementar OAuth bancario o integraciones externas reguladas.
- Crear apps nativas publicadas en stores.
- Rehacer la UI completa.
- Cambiar el modelo ML o reentrenarlo con datos reales.
- Implementar observabilidad avanzada con OpenTelemetry, Prometheus o Grafana.
- Automatizar deploy productivo multiambiente con alta disponibilidad.
- Introducir cambios funcionales grandes de negocio.

Estos temas pueden evaluarse en fases posteriores, cuando la base operacional ya este estable.

## 9. Riscos técnicos

- Docker puede revelar inconsistencias de configuracion local que hoy estan ocultas por ejecuciones manuales.
- Migrações SQL manuais podem falhar em bancos parcialmente inicializados se não for definido um runner e um estado esperado.
- E2E en CI puede ser sensible a tiempos de arranque de PostgreSQL.
- ML usa artefactos `pickle/joblib`; esto exige control estricto del origen de los modelos cargados.
- CORS aberto em ML não deve chegar à demo pública.
- Tokens en `localStorage` son una superficie de riesgo para frontend web si existe XSS.
- O seed demo imprime credenciais; deve se limitar a ambientes controlados.
- Swagger estatico puede quedar desactualizado respecto a la API real.
- O deploy demo pode introduzir diferenças entre Windows local e Linux remoto.
- Agregar CI completo puede revelar deuda de tests intermitentes o dependencias implicitas.

## 10. Próximos passos recomendados

1. Aprovar a fase de profissionalização como alcance oficial da Fase 2.
2. Crear issues por sprint con criterios de aceptacion concretos.
3. Ejecutar Sprint 1 antes de cualquier Docker o CI nuevo.
4. Definir quem será owner de configuração, Docker, CI, segurança e documentação.
5. Manter mudanças pequenas e revisáveis por sprint.
6. Evitar mezclar refactors de negocio con infraestructura.
7. Registrar decisiones importantes como ADRs.
8. Validar cada sprint com uma demo técnica curta.
9. Solo despues de Sprint 6 evaluar si conviene retomar CQRS, Redis u observabilidad avanzada.
10. Manter Open Finance como investigação documentada até que existam requisitos legais, técnicos e de segurança suficientes.
