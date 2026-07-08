# Padroes de Formularios e Validacoes

Este documento define o padrao recomendado para formularios do frontend. Ele e
conceitual e nao cria codigo de producao.

## Objetivo

Padronizar estado, validacao, normalizacao de payload, tratamento de erro e
feedback visual em formularios React Native/Expo.

## Estado do formulario

Cada formulario deve separar:

- valores dos campos;
- erros por campo;
- mensagem geral;
- estado de carregamento inicial quando houver edicao;
- estado de envio (`submitting`);
- dados auxiliares carregados por services, como contas ou categorias.

Exemplo conceitual:

```ts
type FormValues = {
  nome: string;
  valor: string;
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;
```

## Erros por campo

Erros por campo devem ser armazenados em objeto proprio e exibidos proximo ao
campo correspondente, preferencialmente usando `GlassField` ou componente
equivalente.

Regras:

- limpar erro do campo quando o usuario alterar valor relevante;
- manter mensagem geral para erros de backend ou falhas nao atribuiveis a campo;
- evitar usar apenas `Alert.alert` como feedback principal.

## Loading e submitting

Use estados diferentes para:

- loading inicial: buscar dados para editar ou opcoes do formulario;
- submitting: envio do formulario;
- acao secundaria: excluir, desativar, sincronizar ou confirmar.

Durante `submitting`:

- desabilitar botao principal;
- evitar duplo submit;
- manter campos visiveis;
- exibir texto de acao em andamento quando fizer sentido.

## Normalizacao de payload

Antes de chamar o service, normalize os dados:

- trim em textos;
- conversao de moeda/numero para formato esperado pelo backend;
- conversao de datas para formato contratual;
- remocao de campos vazios opcionais;
- conversao de selecoes para ids;
- preservacao de tipos literais aceitos pelo backend.

Normalizacao deve ficar em funcao pequena e testavel quando a regra for
complexa.

## Validacao client-side

Validar no frontend quando:

- campo obrigatorio estiver vazio;
- formato basico for invalido, como email, data ou valor numerico;
- regra simples impedir envio inutil ao backend;
- confirmacao de senha ou aceite de termo for necessario;
- selecao local for obrigatoria.

Depender do backend quando:

- a regra exige banco de dados;
- ha permissao, ownership ou autenticacao envolvida;
- a regra e de dominio central;
- ha unicidade, saldo, status ou consistencia transacional;
- a validacao pode mudar sem depender da UI.

O ideal e combinar as duas camadas: frontend para feedback rapido e backend
como fonte final da regra.

## Tratamento de erro HTTP

Use `resolveApiError` para erros vindos de services:

```ts
const resolved = await resolveApiError(error, 'Nao foi possivel salvar.');
```

Padrao recomendado:

- usar fallback especifico da tela;
- exibir `resolved.message` como mensagem geral;
- se `resolved.unauthorized` for verdadeiro, redirecionar para `/login`;
- mapear status especificos quando a mensagem padrao melhorar a UX;
- preservar detalhes tecnicos fora da UI final.

## Feedback visual

Formularios devem ter:

- mensagem geral de erro quando o submit falhar;
- erros por campo;
- estado de loading inicial;
- estado de submitting;
- feedback de sucesso quando o fluxo nao navegar imediatamente;
- estado vazio quando dados auxiliares obrigatorios nao existirem.

Componentes preferidos:

- `GlassField` para campo com label e erro;
- `GlassButton` para acoes;
- `GlassStatusCard` para loading, erro, vazio e sucesso;
- `FinanceAppShell` e `FinanceAppHeader` em telas autenticadas.

## Testes recomendados

Para cada formulario relevante:

- renderizar campos obrigatorios;
- mostrar erro client-side ao enviar vazio;
- normalizar payload antes de chamar service;
- bloquear duplo envio enquanto `submitting`;
- mostrar erro de backend;
- redirecionar para login em `401`, quando aplicavel;
- navegar ou exibir sucesso apos submit bem-sucedido.

## Schemas declarativos

Como evolucao futura, avaliar schemas declarativos para validacao, como Zod ou
biblioteca equivalente. A decisao deve considerar:

- compatibilidade com Expo/React Native;
- facilidade de teste;
- reuso entre forms;
- compatibilidade com DTOs gerados pelo OpenAPI;
- custo de migrar forms existentes.

Enquanto nao houver schema declarativo oficial, manter validacoes pequenas,
explicitas e proximas ao formulario ou hook da tela.
