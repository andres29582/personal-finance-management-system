# U5: controles antes da ativação

**Não há autorização ou prova de deploy real.** O destino de hosting, origens,
TLS, proxies e versão publicada de rollback ainda não foram definidos. As
migrations 0016/0017 continuam não autorizadas no banco da aplicação.

Preparação sem destino definido: [resultado local U6](../validacao/SEGURANCA_SESSOES_ETAPA_2_U6_RESULTADO.md), implementado com provas parciais em 2026-10-12. Na raiz, `node backendnest/test/session-harness/u6.cjs` executa apenas checks offline finitos e produz `PARTIAL_PASS`, nunca autorização de produção. [Pesquisa/plano original](../planejamento/SEGURANCA_SESSOES_ETAPA_2_U6_PESQUISA.md). Reutiliza este guia; não autoriza executar o procedimento abaixo nem converte prova local em aceite de produção.

## Procedimento manual futuro

1. Identificar destino, identidade do banco e permissões, sem registrar credenciais.
   Aprovar backup, janela de manutenção e release compatível de rollback.
2. Drenar escritores anteriores antes de 0016: sessões legadas sem proveniência
   são invalidadas, nunca recebem deadlines inventados. Aplicar migrations somente
   no destino explicitamente autorizado; o startup não aplica SQL automaticamente.
3. Executar `psql -X -v ON_ERROR_STOP=1 -f docs/operacao/U5_PREDEPLOY_CHECK.sql`
   usando conexão autorizada, fornecida fora dos logs. O script é somente leitura,
   schema `public` fixo, limites 10 s/2 s; não contém credenciais nem destino.
   Exigir exit 0 e notice `U5_SCHEMA_READY`. Ausência ou divergência de tabela,
   tipos, constraints validadas/não diferíveis, FK/PK ou índice bloqueia esta etapa.
4. Confirmar configurações e testes do destino abaixo antes de admitir tráfego.
   `/health` responde de forma estática: **não substitui** o gate de schema.

O gate compara as definições catalogadas exatas de 0016/0017. Uma diferença de
renderização PostgreSQL também falha fechada: não normalizar SQL arbitrariamente
para obter PASS. Ele não comprova toda a infraestrutura, dados ou runtime.

## Ensaio privado mantido

`node backendnest/test/session-harness/runner.cjs U5D`

Um cluster novo PostgreSQL 18.3, apenas loopback 55434, três roles restritas sem
memberships e cada qual dona de um único banco marcado descartável: origem com
17 migrations, destino vazio e controle negativo com somente 16. As migrations
e o restore só ocorrem nesses bancos, com identidade conferida antes das ações.

- O controle negativo deve rejeitar o gate, aplicar 0017 privadamente e passar.
- Quatro sessões são criadas pelo repositório atual com policy 900/43200/v1;
  fixtures UTC conhecidas exercitam ativa, idle expirada, absoluta expirada e
  revogada. A janela por conta é preenchida com cinco reservas reais.
- `pg_dump -Fc` e `pg_restore --no-owner --no-privileges` para o outro banco;
  igualdade exata de autoridade/microssegundos, janela/contador, hashes de todas
  as linhas, contagens, colunas, constraints/FKs e índices. Só o par conhecido
  de renderizações de `password_changed_outbox.password_changed_state` é aceito.
- Após restore, o repositório atual deve negar a sexta reserva se o relógio real
  ainda estiver na janela de 60 s; se ela expirou naturalmente, deve abrir nova
  janela com contador 1. Não retroceder relógio nem estender deadlines para testar.
- Nenhuma sessão expirada/revogada revive; consulta da ativa não renova atividade.
  Não usa Nest, HTTP, navegador, réplica adicional ou release antigo neste seletor.

Limites: preparo/comandos 60 s, goals 180 s, dump/restore 45 s cada e encerramento
PG 30 s. Uma tentativa; falha fica preservada e não autoriza retry automático.
`candidate.json`/`runtime-proof.json` registram freeze e cleanup;
`u5d-proof.json`, `u5d-before.json` e `u5d-after.json` guardam provas com hashes
redigidos. O dump binário contém **somente dados sintéticos** e fica em `.tmp`,
nunca publicado, exportado para provider ou confundido com backup real.

## CI e lacunas de plataforma

### Resultado local em 2026-10-12

Uma execução U5D: **10/10 PASS** e quatro checks puros PASS. Dump/restauro reais
privados preservaram 21 tabelas, 36 FKs, quatro linhas de autoridade e uma quota
com cinco tentativas. A sexta reserva foi negada ainda na janela real de 60 s;
deadline/atividade não renovados. Gate negou 0016 sem 0017 e passou em origem,
controle atualizado e destino restaurado. [Prova local](../../.tmp/session-harness-u5d-2a418cf519f441518c3ebc42493847c4/u5d-proof.json).
Isso permite encerrar o ensaio local, **não** executar migrations/deploy real,
aprovar CI remota PG16 ou provar rollback com release publicada.

| Controle               | Estado / próximo requisito                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CI E2E                 | Definição corrigida: bootstrap efêmero, owner sem superuser e confirmação exata. PostgreSQL **16 preservado**. Validação local PG18 não prova execução PG16; GitHub Actions remoto **NOT RUN**.                                      |
| CI deploy              | Workflow mantém somente checks; nenhum target ou job de deploy adicionado.                                                                                                                                                           |
| Readiness              | Gate manual separado; não transforma `/health` ou startup em schema readiness.                                                                                                                                                       |
| JWT em staging exposto | Validação atual segura aplica a `production`/`demo`, não a `staging`. Usar perfil `NODE_ENV=production` em staging exposto, ou aprovar correção própria; nenhuma policy global foi alterada aqui.                                    |
| TLS/CORS/segredos      | Certificados, origens reais e provisionamento privado ainda **NOT RUN**.                                                                                                                                                             |
| Proxy/IP               | Express permanece sem trust proxy explícito; primeiro XFF de auditoria é não confiável. Definir topologia/CIDRs antes de mudar trust proxy ou afirmar quota por IP no destino.                                                       |
| Reset/Resend           | Entrega real não validada; worker/live Resend permanecem desligados.                                                                                                                                                                 |
| Rollback               | Retenção aditiva de 0016/0017, deadlines, revogações e quota é obrigatória. Compatibilidade com binário antigo publicado **UNAVAILABLE**, pois nenhuma release foi identificada. Não remover enforcement U4 nem ressuscitar sessões. |
| Capacidade             | Duas instâncias Nest, SLO/CPU/memória/timeout e comportamento sob carga no destino **NOT RUN**.                                                                                                                                      |

O resultado local deste seletor não fecha U3/U4/U5 ou etapa 2. Ver resultado
consolidado em [validação U5](../validacao/SEGURANCA_SESSOES_ETAPA_2_U5_RESULTADO.md).
