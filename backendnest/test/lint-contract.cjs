const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');

async function main() {
  const name = process.argv[2];
  assert.ok(['backendnest', 'frontend'].includes(name), 'Select an application package');
  const cwd = path.resolve(__dirname, '../..', name);
  const { ESLint } = createRequire(path.join(cwd, 'package.json'))('eslint');
  const linter = new ESLint({ cwd });
  const files = name === 'backendnest'
    ? ['src/auth/auth.service.ts', 'src/auth/auth.service.spec.ts', 'test/e2e-runtime.cjs']
    : ['src/navigation/RootLayout.tsx', '__tests__/services/api.test.ts', 'tests/browser/session-server.cjs'];
  for (const file of files) assert.equal(await linter.isPathIgnored(path.join(cwd, file)), false, file);
  for (const file of name === 'frontend' ? ['dist/generated.js', 'smoke-web/generated.js', '.expo/generated.js'] : ['dist/generated.js'])
    assert.equal(await linter.isPathIgnored(path.join(cwd, file)), true, file);
  const filePath = path.join(cwd, files[2]);
  assert.equal((await linter.lintText('console.log(process.version);\n', { filePath }))[0].errorCount, 0);
  const invalid = (await linter.lintText('console.log(missingQualitySentinel);\n', { filePath }))[0];
  assert.ok(invalid.messages.some(message => message.ruleId === 'no-undef' && message.severity === 2));
  const config = await linter.calculateConfigForFile(path.join(cwd, files[0]));
  for (const rule of name === 'backendnest'
    ? ['@typescript-eslint/no-unsafe-assignment', '@typescript-eslint/no-unsafe-call', '@typescript-eslint/no-unsafe-member-access']
    : ['react-hooks/refs', 'react-hooks/set-state-in-effect'])
    assert.equal(config.rules[rule][0], 2, rule);
  console.log(JSON.stringify({ package: name, scope: 'maintained sources, tests and configuration', status: 'PASS' }));
}

void main().catch(error => { console.error(error.message); process.exitCode = 1; });
