# Contratos de API do Frontend

Este documento define como o frontend deve consumir o backend e manter
compatibilidade com o contrato oficial da API.

## Fonte oficial

A fonte oficial do contrato backend e:

```text
backendnest/swagger.yaml
```

Documentos em `docs/validacao` sao relatorios de auditoria. Eles ajudam a
entender divergencias e historico, mas nao substituem o OpenAPI oficial.

## Problema atual

Hoje o frontend mantem DTOs e types manualmente em
`frontend/src/modules/**/types`. Isso funciona, mas cria risco de divergencia
silenciosa entre backend e frontend.

Riscos principais:

- campo novo no backend sem type correspondente no frontend;
- campo removido ou renomeado no backend ainda usado pela tela;
- endpoint alterado sem ajuste no service;
- resposta envelopada confundida com dado ja desembrulhado;
- formato de erro tratado de forma incompleta.

## API client

O client HTTP principal fica em:

```text
frontend/src/shared/services/api.ts
```

Responsabilidades:

- configurar `baseURL` por `EXPO_PUBLIC_API_URL`;
- anexar bearer token em requisicoes protegidas;
- ignorar refresh automatico em endpoints publicos de auth;
- tentar refresh em `401`;
- limpar sessao quando refresh falhar;
- repetir a requisicao original uma unica vez;
- desembrulhar respostas de sucesso.

## Envelope de sucesso

O backend pode responder sucesso no formato:

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-07-08T00:00:00.000Z",
  "requestId": "..."
}
```

O interceptor do frontend desembrulha esse envelope. Portanto, como regra
padrao, services de dominio devem retornar o dado consumivel pela tela, nao o
envelope inteiro.

Exemplo conceitual:

```ts
const response = await api.get<Conta[]>('/contas');
return response.data;
```

## Tipo transportado e tipo consumido

Tipo transportado pela API e o formato bruto definido pelo backend/OpenAPI.
Tipo consumido pela tela e o dado que o service entrega depois de unwrap,
normalizacao ou mapeamento simples.

Regra recomendada:

- types de dominio representam o dado consumido pela aplicacao;
- types de request representam payload enviado ao backend;
- envelope de sucesso so deve ser tipado quando algum codigo realmente precisar
  de `timestamp`, `requestId` ou `success`;
- mappers devem ser usados quando a tela precisa de modelo de apresentacao
  diferente do DTO.

## Services

Services devem:

- ficar em `frontend/src/modules/<dominio>/services`;
- importar `api` de `frontend/src/shared/services/api`;
- conter apenas chamadas HTTP e adaptacao minima;
- retornar dados ja desembrulhados;
- nao manipular estado de tela;
- nao exibir alerta visual;
- nao conhecer componentes;
- ter teste dedicado.

## Endpoints

Padrao de nomes:

- listar: `list<Recurso>()`;
- buscar por id: `get<Recurso>ById(id)`;
- criar: `create<Recurso>(data)`;
- atualizar: `update<Recurso>(id, data)`;
- desativar: `deactivate<Recurso>(id)`;
- remover: `delete<Recurso>(id)`.

Endpoints devem seguir os paths reais do Swagger. Evite criar paths em telas.
Telas devem chamar services.

### Planejamentos

O modulo `frontend/src/modules/planejamentos` consome os endpoints oficiais de
planejamento, participantes, gastos, resumo, lifecycle e acertos. A politica de
capacidade usada na UI e nos formularios deve permanecer alinhada ao backend:

- proprietario por `usuarioCriadorId`;
- participante compartilhado somente com `usuarioId` correspondente,
  `tipo = VINCULADO` e `status = ATIVO`;
- criacao de gasto permitida ao vinculado ativo em planejamento `ABERTO`;
- edicao/cancelamento de gasto, participantes e lifecycle exclusivos do
  proprietario;
- sincronizacao compartilhada em `ABERTO` ou `FECHADO`;
- pagamento pelo proprietario ou pelo participante devedor;
- recurso inacessivel ocultado como `404 PLANEJAMENTO_NOT_FOUND`.

As funcoes puras em
`frontend/src/modules/planejamentos/authorization/planejamentoAuthorization.ts`
sao reutilizadas pelo detalhe e pelos formularios. Deep links nao devem expor
formularios operacionais antes de identidade e agregado serem carregados. O
backend continua sendo a autoridade final.

## Erros HTTP

O helper comum para transformar erro em mensagem de UI e:

```text
frontend/utils/api-error.ts
```

Telas, hooks de tela e fluxos de formulario devem usar `resolveApiError` para:

- extrair mensagem do backend;
- tratar `401`;
- limpar sessao quando necessario;
- decidir redirecionamento para login;
- aplicar fallback seguro quando o backend nao enviar mensagem.

## Formatos possiveis de erro

O backend pode emitir pelo menos dois formatos:

Erro de dominio envelopado:

```json
{
  "success": false,
  "error": {
    "code": "DOMAIN_ERROR",
    "message": "Mensagem",
    "details": {}
  },
  "timestamp": "...",
  "requestId": "..."
}
```

Erro HTTP/Nest comum:

```json
{
  "statusCode": 400,
  "message": "Mensagem",
  "error": "Bad Request"
}
```

O frontend deve tratar ambos. Quando `message` vier como lista, a primeira
mensagem pode ser usada como texto principal de UI.

## Recomendacao futura

Avaliar geracao de types e/ou client a partir de `backendnest/swagger.yaml`.
Isso reduziria a manutencao manual de DTOs e aumentaria confianca em mudancas
de contrato.

Uma alternativa intermediaria e criar validacao automatizada que compare
services usados pelo frontend com paths e schemas do OpenAPI.

## Checklist para novo endpoint

1. Confirmar endpoint, metodo, request, response e seguranca no Swagger.
2. Criar ou atualizar type de dominio/request em `src/modules/<dominio>/types`.
3. Criar ou atualizar service em `src/modules/<dominio>/services`.
4. Garantir que o service retorna dado ja desembrulhado.
5. Tratar erro na tela ou hook com `resolveApiError`.
6. Adicionar teste do service.
7. Adicionar teste de tela ou hook quando o fluxo for critico.
8. Atualizar documentacao quando houver nova rota, risco ou regra de contrato.
