const path = require('node:path'),
  assert = require('node:assert/strict');
const backend = path.resolve(__dirname, '../..');
const target = path.resolve(process.argv[2]);
assert.ok(
  [
    path.join(__dirname, 'prepare.ts'),
    path.join(__dirname, 'u5.ts'),
    path.join(__dirname, 'u5-deployment.cjs'),
    path.join(backend, 'test/u4-browser-bootstrap.ts'),
  ].includes(target),
);
process.send?.({ milestone: 'register-entered' });
require(path.join(backend, 'node_modules/ts-node')).register({
  project: path.join(backend, 'tsconfig.json'),
  transpileOnly: true,
  compilerOptions: { incremental: false },
});
process.send?.({ milestone: 'typescript-loader-registered' });
require(target);
process.send?.({ milestone: 'entry-import-returned' });
