const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../..'),
  backend = path.join(repo, 'backendnest'),
  frontend = path.join(repo, 'frontend');
const hash = (file) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function runnerSnapshot(selected) {
  const files = [];
  const walk = (dir) => {
    for (const x of fs.readdirSync(dir, { withFileTypes: true })) {
      if (x.name === '.expo' || x.name === 'node_modules') continue;
      const file = path.join(dir, x.name);
      assert.equal(x.isSymbolicLink(), false);
      if (x.isDirectory()) walk(file);
      else {
        assert.ok(
          !/^\.env(?:\.|$)/.test(x.name),
          'No dotenv in maintained source',
        );
        files.push(file);
      }
    }
  };
  for (const dir of [
    path.join(backend, 'src'),
    path.join(backend, 'test'),
    path.join(backend, 'migrations'),
    path.join(frontend, 'src'),
    path.join(frontend, 'components'),
    path.join(frontend, 'assets'),
    path.join(frontend, 'constants'),
    path.join(frontend, 'hooks'),
    path.join(frontend, 'types'),
    path.join(frontend, 'services'),
    path.join(frontend, 'storage'),
    path.join(frontend, 'utils'),
    path.join(frontend, 'tests/browser/u4'),
    ...(['U5', 'U5B', 'U5R'].includes(selected)
      ? [path.join(frontend, 'app'), path.join(frontend, '__tests__')]
      : []),
  ])
    walk(dir);
  for (const file of [
    'backendnest/tsconfig.json',
    'frontend/package.json',
    'frontend/package-lock.json',
    'frontend/app.json',
    ...(selected === 'U5D'
      ? ['.github/workflows/ci.yml', 'docs/operacao/U5_PREDEPLOY_CHECK.sql']
      : []),
  ])
    files.push(path.join(repo, file));
  return files.sort().map((file) => ({
    path: path.relative(repo, file).replaceAll(path.sep, '/'),
    sha256: hash(file),
  }));
}
module.exports = { runnerSnapshot };
