const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Parse maintained entrypoints without importing them or starting their harnesses.
function sourceFunction(file, name) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(path.join(__dirname, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const declaration = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  );
  assert.ok(declaration, `${file}: ${name} must exist`);
  return { source, declaration };
}

test('actual C6 dump invocation excludes live harness state, preserving application metadata checks', async () => {
  const { source, declaration } = sourceFunction('c6.cjs', 'main');
  let dump;
  const schemaDrops = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (
        node.expression.getText(source) === 'command' &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === 'pg_dump'
      )
        dump = node;
      if (
        node.expression.getText(source) === 'db.query' &&
        ts.isStringLiteral(node.arguments[0]) &&
        /^DROP SCHEMA/i.test(node.arguments[0].text)
      )
        schemaDrops.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(declaration);
  assert.ok(dump);
  const invocations = [];
  await vm.runInNewContext(`(async () => ${dump.getText(source)})()`, {
    command: async (name, args) => invocations.push({ name, args }),
    args: ['-h', '127.0.0.1', '-d', 'finance_e2e_synthetic'],
    path,
    root: 'synthetic-disposable',
  });
  assert.equal(invocations.length, 1);
  assert.equal(invocations[0].name, 'pg_dump');
  assert.ok(invocations[0].args.includes('--exclude-schema=e2e_harness'));
  assert.ok(invocations[0].args.includes('-Fc'));
  assert.deepEqual(schemaDrops, ['DROP SCHEMA public CASCADE']);
  const shape = sourceFunction('c6.cjs', 'shape').declaration.getText();
  assert.ok(shape.includes("table_schema='public'"));
  assert.ok(shape.includes("connamespace='public'::regnamespace"));
});

async function cleanupScenario({
  status = 'completed',
  cancelled = false,
  cleanupFailure = false,
} = {}) {
  const { declaration } = sourceFunction('runner.cjs', 'cleanup');
  const closes = [];
  const context = {
    cancellation: { cancelled, beginCleanup() {} },
    setPhase() {},
    settleCleanup: async (steps) => {
      const errors = [];
      for (const step of steps) {
        try {
          await step();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length)
        throw new AggregateError(errors, 'Synthetic cleanup failures');
    },
    commandChildren: new Set(),
    backendChild: undefined,
    backendExited: false,
    staticServer: cleanupFailure ? {} : undefined,
    sockets: new Set(
      cleanupFailure
        ? [
            {
              destroy() {
                throw new Error('Synthetic socket shutdown failure');
              },
            },
          ]
        : [],
    ),
    databaseLease: {
      close: async (options) => {
        closes.push(options.participantsStopped);
        if (!options.participantsStopped) throw new Error('Claim retained');
      },
    },
    proof: { status, cleanup: {} },
    pgStarted: false,
    fs: { existsSync: () => false },
    path,
    data: 'synthetic-disposable',
    free: async () => {},
    setTimeout() {
      throw new Error('Unexpected real timer in mock cleanup');
    },
    clearTimeout() {},
  };
  const cleanup = vm.runInNewContext(`(${declaration.getText()})`, context);
  let failure;
  try {
    await cleanup();
  } catch (error) {
    failure = error;
  }
  return { closes, failure };
}

test('browser/preparation failure retains claim even when participant processes have stopped', async () => {
  const result = await cleanupScenario({ status: 'failed' });
  assert.deepEqual(result.closes, [false]);
  assert.ok(result.failure);
});
test('a failure before the outer catch marks the run failed also retains claim', async () => {
  const result = await cleanupScenario({ status: 'running' });
  assert.deepEqual(result.closes, [false]);
  assert.ok(result.failure);
});
test('cancelled browser run never authorizes claim deletion', async () => {
  const result = await cleanupScenario({ cancelled: true });
  assert.deepEqual(result.closes, [false]);
  assert.ok(result.failure);
});
test('a previous cleanup failure retains claim despite stopped database participants', async () => {
  const result = await cleanupScenario({ cleanupFailure: true });
  assert.deepEqual(result.closes, [false]);
  assert.ok(result.failure);
});
test('only successful browser completion and preceding cleanup authorize release', async () => {
  const result = await cleanupScenario();
  assert.deepEqual(result.closes, [true]);
  assert.equal(result.failure, undefined);
});
