const { Client } = require('pg');

// Conservative signatures: unknown equivalent definitions need manual review.
const normalize = (definition) =>
  definition.replace(/'[^']*'|\s|[()]|::text|::numeric/g, (token) =>
    token.startsWith("'") ? token : '',
  );
const columns = {
  usuario: { id: ['uuid', true] },
  conta: { id: ['uuid', true], usuario_id: ['uuid', true] },
  categoria: { id: ['uuid', true], usuario_id: ['uuid', true] },
  transacao: {
    id: ['uuid', true],
    usuario_id: ['uuid', true],
    conta_id: ['uuid', true],
    categoria_id: ['uuid', true],
    valor: ['numeric(14,2)', true],
    descricao: ['text', false],
    excluido_em: ['timestamp without time zone', false],
  },
  orcamento: {
    id: ['uuid', true],
    usuario_id: ['uuid', true],
    mes_referencia: ['character varying(7)', true],
    valor_planejado: ['numeric(14,2)', true],
  },
};

async function inspectDatabase(config) {
  const client = new Client({
    ...config,
    connectionTimeoutMillis: 5000,
    query_timeout: 12000,
    options:
      '-c statement_timeout=10000 -c lock_timeout=2000 -c idle_in_transaction_session_timeout=15000',
  });
  try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const attributes = (
      await client.query(`SELECT t.relname AS table_name, a.attname AS column_name,
      format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull AS required
      FROM pg_attribute a JOIN pg_class t ON t.oid=a.attrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname='public' AND t.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`)
    ).rows;
    const constraints = (
      await client.query(`SELECT t.relname AS table_name, c.contype AS kind,
      c.convalidated AS validated, c.condeferrable AS deferred, i.indisvalid AS index_valid,
      pg_get_constraintdef(c.oid) AS definition, rt.relname AS referenced_table, rn.nspname AS referenced_schema,
      ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,pos)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.pos) AS columns,
      ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num,pos)
        JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.pos) AS referenced_columns
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      LEFT JOIN pg_class rt ON rt.oid=c.confrelid LEFT JOIN pg_namespace rn ON rn.oid=rt.relnamespace
      LEFT JOIN pg_index i ON i.indexrelid=c.conindid WHERE n.nspname='public'`)
    ).rows;
    const issues = [];
    for (const [table, expected] of Object.entries(columns)) {
      for (const [column, [type, required]] of Object.entries(expected)) {
        const actual = attributes.find(
          (item) => item.table_name === table && item.column_name === column,
        );
        if (!actual || actual.type !== type || actual.required !== required)
          issues.push(`${table}.${column}`);
      }
      if (
        !constraints.some(
          (c) =>
            c.table_name === table &&
            c.kind === 'p' &&
            c.index_valid &&
            c.columns.join(',') === 'id',
        )
      )
        issues.push(`${table}.primary_key`);
    }
    for (const [table, column, target] of [
      ['conta', 'usuario_id', 'usuario'],
      ['categoria', 'usuario_id', 'usuario'],
      ['transacao', 'usuario_id', 'usuario'],
      ['transacao', 'conta_id', 'conta'],
      ['transacao', 'categoria_id', 'categoria'],
      ['orcamento', 'usuario_id', 'usuario'],
    ]) {
      if (
        !constraints.some(
          (c) =>
            c.table_name === table &&
            c.kind === 'f' &&
            c.validated &&
            c.columns.join(',') === column &&
            c.referenced_schema === 'public' &&
            c.referenced_table === target &&
            c.referenced_columns.join(',') === 'id',
        )
      )
        issues.push(`${table}.${column}.fk`);
    }
    if (
      !constraints.some(
        (c) =>
          c.table_name === 'orcamento' &&
          c.kind === 'u' &&
          c.index_valid &&
          !c.deferred &&
          c.columns.join(',') === 'usuario_id,mes_referencia',
      )
    )
      issues.push('orcamento.unique_month');
    for (const [table, issue, expression] of [
      [
        'orcamento',
        'month_check',
        "CHECKmes_referencia~'^[0-9]{4}-(0[1-9]|1[0-2])$'",
      ],
      ['orcamento', 'amount_check', 'CHECKvalor_planejado>0'],
      ['transacao', 'amount_check', "CHECKvalor>0ANDvalor<>'NaN'"],
    ]) {
      if (
        !constraints.some(
          (c) =>
            c.table_name === table &&
            c.kind === 'c' &&
            c.validated &&
            normalize(c.definition) === expression,
        )
      )
        issues.push(`${table}.${issue}`);
    }
    let invalidAmounts = null;
    if (!issues.includes('transacao.valor')) {
      invalidAmounts = (
        await client.query(
          `SELECT count(*)::text AS count FROM public.transacao WHERE valor<=0 OR valor='NaN'::numeric`,
        )
      ).rows[0].count;
      if (invalidAmounts !== '0') issues.push('transacao.invalid_amounts');
    }
    await client.query('ROLLBACK');
    return {
      status: issues.length ? 'blocked' : 'ready',
      issues,
      invalidAmounts,
    };
  } finally {
    await client.end();
  }
}

async function main(args, env) {
  const database = args.length === 2 && args[0] === '--database' ? args[1] : '';
  const port = Number(env.DATA_CHECK_PORT ?? 5432);
  if (
    !database ||
    !env.DATA_CHECK_HOST ||
    !env.DATA_CHECK_USER ||
    !env.DATA_CHECK_PASSWORD ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !['disable', 'verify-full'].includes(env.DATA_CHECK_SSL_MODE)
  ) {
    console.log(
      JSON.stringify({
        status: 'blocked',
        error: 'EXPLICIT_CONNECTION_REQUIRED',
      }),
    );
    return 2;
  }
  try {
    const report = await inspectDatabase({
      database,
      port,
      host: env.DATA_CHECK_HOST,
      user: env.DATA_CHECK_USER,
      password: env.DATA_CHECK_PASSWORD,
      ssl:
        env.DATA_CHECK_SSL_MODE === 'verify-full'
          ? { rejectUnauthorized: true }
          : false,
    });
    console.log(JSON.stringify(report));
    return report.status === 'ready' ? 0 : 1;
  } catch {
    // Never echo driver messages: they may contain credentials or database values.
    console.log(
      JSON.stringify({ status: 'blocked', error: 'DATABASE_CHECK_FAILED' }),
    );
    return 2;
  }
}
module.exports = { inspectDatabase, main };
if (require.main === module)
  void main(process.argv.slice(2), process.env).then((code) => {
    process.exitCode = code;
  });
