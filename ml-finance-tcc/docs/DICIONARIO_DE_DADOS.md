# Dicionário de dados — CSV mensal (`ml-finance-tcc`) ↔ backend Nest (`backendnest`)

Descreve como cada coluna usada no pipeline de ML **se alinha conceitualmente** às entidades e regras já implementadas no `backendnest`.
Referências de código (leitura): `transacoes/entities/transacao.entity.ts`, `contas/entities/conta.entity.ts`, `categorias/entities/categoria.entity.ts`, `dashboard/dashboard.service.ts`, `relatorios/relatorios.service.ts`, `contas/contas.service.ts` (método `attachCurrentBalances`).

**Granularidade alvo:** uma linha = **um mês de referência** `M` (ex.: `2026-04`) e **um utilizador** `usuario_id` (no CSV de treino pode estar implícito se for export single-user).

**Nota de domínio:** no dashboard, `receitasMes` e `despesasMes` vêm **apenas** de `transacao` no intervalo do mês (`data` entre início e fim de `M`). **Transferências** alteram `saldoAtual` da conta (`contas.service.ts`) mas **não entram** em receitas/despesas do dashboard — alinhar qualquer export ML a essa mesma convenção, salvo decisão explícita em contrário no TCC.

---

## Tabela coluna ↔ entidade / origem ↔ fórmula ou regra

| Coluna no CSV / `features.json` | Origem no modelo de dados (Nest / TypeORM) | Fórmula ou derivação (alinhada ao código) |
|---------------------------------|---------------------------------------------|-------------------------------------------|
| `receita_mes` | `Transacao` + `TipoTransacao.RECEITA` | Soma de `transacao.valor` (numérico) para `transacao.usuario_id = U` e `transacao.data` dentro do mês `M`, com `transacao.tipo = 'receita'`. Espelha `totalReceitas` em `DashboardService.getDashboard` (linhas 55–57). Opcional no export: excluir `transacao.ehAjuste = true` se quiser previsão só sobre movimentos “normais” (campo existe na entidade; o dashboard atual **não** filtra por `ehAjuste`). |
| `despesa_mes` | `Transacao` + `TipoTransacao.DESPESA` | Soma de `transacao.valor` com `tipo = 'despesa'`, mesmo filtro de mês e utilizador. Espelha `totalDespesas` em `DashboardService.getDashboard` (linhas 58–60). Coerente com totais em `RelatoriosService.getRelatorio` para o período. |
| `saldo_inicial_mes` | `Conta` + `Transacao` + `Transferencia` | Ver **§ Definição contratual — `saldo_inicial_mes`** abaixo: património líquido **consolidado no encerramento do mês civil anterior** a `M`, **recomputável** a partir das tabelas existentes (sem histórico mensual persistido). |
| `num_transacoes_despesa` | `Transacao` | `COUNT(*)` de linhas em `transacao` com `tipo = 'despesa'`, `usuario_id = U`, `data` em `M`. |
| `num_transacoes_receita` | `Transacao` | `COUNT(*)` com `tipo = 'receita'`, mesmo critério temporal. |
| `volatilidade_despesa` | `Transacao` | Estatística **derivada**: por exemplo **desvio padrão amostral** dos valores `transacao.valor` só para `tipo = 'despesa'` em `M` (se houver menos de 2 despesas, definir convencionalmente `0` ou `NULL` imputado). Não existe campo único equivalente na API; é feature de engenharia para captar irregularidade de gastos. |
| `deficit_mes` (alvo) | `Transacao` (agregados) | **Rótulo binário para treino:** `1` se `despesa_mes > receita_mes`, senão `0` — coerente com `economiaMes = receitasMes - despesasMes < 0` no dashboard **quando** receitas/despesas seguem a mesma definição (apenas transações do mês). `0` inclui equilíbrio e superavit. |

---

## Definição contratual — `saldo_inicial_mes` (para defesa no TCC)

O nome da coluna evoca “saldo no início do mês `M`”, mas **não** corresponde ao campo `conta.saldo_inicial` (que é apenas o valor **cadastrado** na criação/edição da conta). Aqui **`saldo_inicial_mes` é uma feature de contexto patrimonial** logo **antes** de observar o fluxo de receitas/despesas do mês `M`.

### 1. Data de corte (fixa e auditável)

Seja `M` o mês de referência da linha (ex. abril de 2026). Define-se a **data de corte** `D` como o **último dia civil do mês imediatamente anterior** a `M`:

- Ex.: se `M = 2026-04`, então `D = 2026-03-31`.

Todas as transações e transferências consideradas nos somatórios abaixo respeitam `data <= D`, usando **`transacao.data`** e **`transferencia.data`** (ambas colunas `date` nas entidades TypeORM — ver `transferencia.entity.ts`).

### 2. Saldo por conta na data `D` (mesma lógica que `ContasService.attachCurrentBalances`)

Para cada conta `c` do utilizador `U` (recomenda-se restringir a `conta.ativa = true`, coerente com listagens habituais):

1. **Componente transacional** (como em `attachCurrentBalances`): soma dos `transacao.valor` com `conta_id = c.id`, `usuario_id = U` e `transacao.data <= D`, somando `+valor` se `tipo = receita` e `-valor` se `tipo = despesa`.

2. **Componente de transferências** (como em `attachCurrentBalances`): para cada `transferencia` do utilizador com data **até** `D` (na convenção escolhida), aplicar `-valor - comissao` na conta origem e `+valor` na conta destino.

3. **Saldo na data `D`:**

   `saldo_conta(c, D) = conta.saldo_inicial + delta_transacoes(c, D) + delta_transferencias(c, D)`.

Isto é **exatamente** a mesma composição usada para `saldoAtual` no serviço de contas, mas **truncada no tempo** em `D` em vez de “hoje”.

### 3. Valor da coluna `saldo_inicial_mes` na linha do mês `M`

**Definição defendida no TCC:**

`saldo_inicial_mes = Σ_c saldo_conta(c, D)` — soma dos saldos por conta na data de corte `D`, ou seja, **património líquido consolidado no encerramento do mês anterior a `M`**.

Interpretação para o modelo: captura **quanto “colchão” financeiro** existia antes do mês corrente, **incluindo** o efeito de transferências entre contas (por coerência com o saldo que o utilizador vê na app), mas **sem** misturar receitas/despesas do mês `M` (estas entram em `receita_mes` / `despesa_mes`).

### 4. O que **não** é esta coluna (evitar críticas na banca)

- **Não** é apenas `SUM(conta.saldo_inicial)` — ignoraria todo o histórico.
- **Não** é o `saldoTotal` devolvido pelo dashboard “hoje” — seria vazamento temporal se usado para prever o mês `M` sem recortar a `D`.
- **Não** exige nova tabela mensual: exige **export/ETL** que reproduza a fórmula acima (ou materialize snapshots em job noturno, se um dia for política de produto).

### 5. Relação com o CSV sintético

No dataset sintético atual, `saldo_inicial_mes` é um **número compatível em escala** com a narrativa de “colchão” antes do mês; ao substituir por dados reais, deve **obedecer estritamente** à §2–3 para manter a interpretabilidade do modelo.

---

## Chaves e relacionamentos (contexto `backendnest`)

| Conceito | Onde vive |
|----------|-----------|
| Utilizador dono dos dados | `transacao.usuario_id`, `conta.usuario_id`, `categoria.usuario_id` |
| Ligação transação → conta / categoria | `transacao.conta_id` → `conta.id`; `transacao.categoria_id` → `categoria.id` |
| Tipo de movimento | `transacao.tipo` ∈ `receita` \| `despesa` (`TipoTransacao`) |
| Valor monetário | `transacao.valor` (`decimal`) |
| Dia do movimento | `transacao.data` (`date`) — usado com `Between(startDate,endDate)` no dashboard |
| Saldo inicial cadastrado da conta | `conta.saldo_inicial` — componente do `saldoAtual`, não substitui agregados mensais de receita/despesa |

---

## O que o CSV sintético atual faz

O ficheiro `data/monthly_finance_sample.csv` gerado por `domain/data_loader.py` **imita** as colunas acima com números fictícios; a coluna `deficit_mes` é criada por regra **despesa > receita** no gerador, alinhada semanticamente à definição de déficit baseada em agregados de transações.

---

## Próximo passo sugerido (fora do âmbito deste ficheiro)

Implementar um **export** (script ou endpoint futuro) que materialize, por `(usuario_id, mês)`, as colunas desta tabela a partir de SQL ou repositórios Nest — **sem** alterar o presente dicionário até a query estar validada.
