const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { Client } = require('pg');
const runtime = require('./e2e-runtime.cjs');

const repo = path.resolve(__dirname, '../..');
const backend = path.join(repo, 'backendnest');
const frontend = path.join(repo, 'frontend');
const pgBin = 'C:/Program Files/PostgreSQL/18/bin';
const ports = { postgres: 55438, api: 4328, web: 4188 };
function ownedData(root, data) {
  const parent = path.join(repo, '.tmp');
  if (
    !root.startsWith(parent + path.sep) ||
    path.dirname(data) !== root ||
    path.basename(data) !== 'data'
  )
    throw new Error('Owned cluster path required');
  return data;
}
function releaseAllowed(success, cancelled, cleanupErrors, stopped) {
  return success && !cancelled && cleanupErrors.length === 0 && stopped;
}
function assertOwner(owner, root, data) {
  ownedData(root, data);
  if (
    !/^[a-f0-9]{32}$/.test(owner.nonce) ||
    path.basename(root) !== 'financial-runtime-' + owner.nonce ||
    owner.data !== data ||
    owner.port !== ports.postgres
  )
    throw new Error('Owned cluster sentinel mismatch');
}
function assertServer(identity, data) {
  if (
    path.resolve(identity.directory) !== data ||
    Number(identity.port) !== ports.postgres
  )
    throw new Error('Connected server is not the owned cluster');
}
function cleanEnvironment(root) {
  return {
    SystemRoot: process.env.SystemRoot,
    WINDIR: process.env.SystemRoot,
    PATH: [
      path.dirname(process.execPath),
      path.join(process.env.SystemRoot, 'System32'),
      pgBin,
    ].join(path.delimiter),
    TEMP: root,
    TMP: root,
    TMPDIR: root,
    TZ: 'UTC',
    NODE_ENV: 'test',
    NODE_PATH: path.join(backend, 'node_modules'),
    EXPO_NO_DOTENV: '1',
    EXPO_NO_TELEMETRY: '1',
    CI: '1',
  };
}
async function available(port) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function main() {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const root = path.join(repo, '.tmp', 'financial-runtime-' + nonce);
  const data = ownedData(root, path.join(root, 'data'));
  fs.mkdirSync(root);
  const sentinel = path.join(root, 'owner.json');
  fs.writeFileSync(
    sentinel,
    JSON.stringify({ nonce, data, port: ports.postgres }),
    { flag: 'wx' },
  );
  const confirmOwner = () => {
    assertOwner(JSON.parse(fs.readFileSync(sentinel, 'utf8')), root, data);
    if (fs.realpathSync(root) !== root || fs.realpathSync(data) !== data)
      throw new Error('Owned cluster path was redirected');
  };
  const env = cleanEnvironment(root);
  const dbName = 'finance_e2e_rules_' + nonce.slice(0, 16);
  const role = dbName + '_owner';
  const password = crypto.randomBytes(24).toString('hex');
  const adminPassword = crypto.randomBytes(24).toString('hex');
  const secret = path.join(root, 'init-password');
  const proof = {
    status: 'running',
    root: path.relative(repo, root),
    ports,
    phases: [],
    cleanup: {},
    source: {},
  };
  for (const p of [
    'backendnest/test/financial-business-rules.e2e-spec.ts',
    'backendnest/test/budget-allocation-concurrency.e2e-spec.ts',
    'frontend/tests/financial/categories.spec.ts',
    'backendnest/test/financial-closure-runner.cjs',
  ])
    proof.source[p] = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(repo, p)))
      .digest('hex');
  const children = new Set();
  let pgStarted = false,
    lease,
    server,
    backendChild,
    success = false,
    cancelled = false,
    primary;
  const cleanupErrors = [];
  const abort = () => {
    cancelled = true;
    for (const c of children) c.kill('SIGTERM');
  };
  const overall = setTimeout(abort, 22 * 60 * 1000);
  process.on('SIGINT', abort);
  process.on('SIGTERM', abort);
  const save = () =>
    fs.writeFileSync(
      path.join(root, 'proof.json'),
      JSON.stringify(proof, null, 2),
    );
  function launch(label, executable, args, options = {}) {
    if (cancelled) throw new Error('Owned execution cancelled');
    const out = fs.openSync(path.join(root, label + '.log'), 'wx');
    const child = spawn(executable, args, {
      cwd: options.cwd || backend,
      env: options.env || env,
      windowsHide: true,
      shell: false,
      stdio: ['ignore', out, out, ...(options.ipc ? ['ipc'] : [])],
    });
    fs.closeSync(out);
    children.add(child);
    child.completion = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => {
        children.delete(child);
        child.finished = true;
        code === 0 && !signal
          ? resolve()
          : reject(new Error(label + ' failed: ' + (signal || code)));
      });
    });
    // Shutdown can occur while the owning phase waits for readiness instead of completion.
    void child.completion.catch(() => {});
    return child;
  }
  async function run(label, executable, args, options = {}) {
    const child = launch(label, executable, args, options);
    const timer = setTimeout(() => {
      child.timedOut = true;
      child.kill('SIGTERM');
    }, options.timeout || 120000);
    const hard = setTimeout(
      () => child.kill('SIGKILL'),
      (options.timeout || 120000) + 5000,
    );
    let deadline;
    try {
      await Promise.race([
        child.completion,
        new Promise((_, reject) => {
          deadline = setTimeout(
            () => reject(new Error(label + ' child exit unconfirmed')),
            (options.timeout || 120000) + 10000,
          );
        }),
      ]);
      if (child.timedOut) throw new Error(label + ' deadline exceeded');
      proof.phases.push({ label, status: 'passed' });
      save();
    } finally {
      clearTimeout(timer);
      clearTimeout(hard);
      clearTimeout(deadline);
    }
  }
  async function stopChild(child) {
    if (!child || child.finished) return;
    if (child.connected) child.send('shutdown');
    else child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
    let deadline;
    try {
      await Promise.race([
        child.completion.catch(() => {}),
        new Promise((_, reject) => {
          deadline = setTimeout(
            () => reject(new Error('Owned child shutdown unconfirmed')),
            14000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
      clearTimeout(deadline);
    }
    if (!child.finished) throw new Error('Owned child still running');
  }
  try {
    for (const port of Object.values(ports)) await available(port);
    for (const name of ['initdb', 'pg_ctl', 'postgres', 'psql'])
      if (!fs.existsSync(path.join(pgBin, name + '.exe')))
        throw new Error('Installed PostgreSQL tool missing');
    fs.writeFileSync(secret, adminPassword, { flag: 'wx', mode: 0o600 });
    await run('initdb', path.join(pgBin, 'initdb.exe'), [
      '-D',
      data,
      '-U',
      'postgres',
      '--auth=scram-sha-256',
      '--pwfile=' + secret,
      '--encoding=UTF8',
      '--no-locale',
    ]);
    fs.unlinkSync(secret);
    // Mark startup attempted so finally also handles a partially successful pg_ctl.
    pgStarted = true;
    await run(
      'pg-start',
      path.join(pgBin, 'pg_ctl.exe'),
      [
        '-D',
        data,
        '-l',
        path.join(root, 'postgres.log'),
        '-o',
        '-h 127.0.0.1 -p 55438 -c max_connections=30',
        '-w',
        '-t',
        '30',
        'start',
      ],
      { timeout: 60000 },
    );
    const pid = fs
      .readFileSync(path.join(data, 'postmaster.pid'), 'utf8')
      .trim()
      .split(/\r?\n/);
    if (path.resolve(pid[1]) !== data || Number(pid[3]) !== ports.postgres)
      throw new Error('Owned cluster identity mismatch');
    const admin = new Client({
      host: '127.0.0.1',
      port: ports.postgres,
      database: 'postgres',
      user: 'postgres',
      password: adminPassword,
      connectionTimeoutMillis: 5000,
    });
    try {
      await admin.connect();
      confirmOwner();
      const identity = await admin.query(
        "SELECT current_setting('data_directory') AS directory, inet_server_port() AS port",
      );
      assertServer(identity.rows[0], data);
      await admin.query(
        `CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
      );
      await admin.query(`CREATE DATABASE ${dbName} OWNER ${role}`);
      await admin.query(
        `COMMENT ON DATABASE ${dbName} IS 'finance-e2e-disposable'`,
      );
      await admin.query(`REVOKE ALL ON DATABASE ${dbName} FROM PUBLIC`);
    } finally {
      await admin.end();
    }
    const appEnv = {
      ...env,
      E2E_DB_HOST: '127.0.0.1',
      E2E_DB_PORT: String(ports.postgres),
      E2E_DB_NAME: dbName,
      E2E_DB_USERNAME: role,
      E2E_DB_PASSWORD: password,
      E2E_DB_RESET_CONFIRM: dbName,
      JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      JWT_ACCESS_SECRET: crypto.randomBytes(32).toString('hex'),
      JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '30d',
      JWT_ISSUER: 'meu-sistema-financeiro',
      AUTH_MAX_ACTIVE_SESSIONS: '5',
      PORT: String(ports.api),
      CORS_ORIGINS: 'http://127.0.0.1:' + ports.web,
      THROTTLE_LIMIT: '1000',
      THROTTLE_TTL_MS: '60000',
      PASSWORD_RESET_DELIVERY_URL: '',
      PASSWORD_RESET_DELIVERY_API_KEY: '',
    };
    runtime.configureEnvironment(runtime.resolveConfig(appEnv), appEnv);
    await run(
      'financial-e2e',
      process.execPath,
      [
        path.join(
          path.dirname(process.execPath),
          'node_modules/npm/bin/npm-cli.js',
        ),
        'run',
        'test:e2e',
        '--',
        '--runTestsByPath',
        'test/financial-business-rules.e2e-spec.ts',
        'test/budget-allocation-concurrency.e2e-spec.ts',
      ],
      { env: appEnv, timeout: 16 * 60 * 1000 },
    );
    lease = await runtime.acquireLease(runtime.resolveConfig(appEnv), {
      onLost: abort,
    });
    Object.assign(appEnv, lease.environment);
    runtime.configureEnvironment(runtime.resolveConfig(appEnv), appEnv);
    backendChild = launch(
      'backend',
      process.execPath,
      [
        path.join(__dirname, 'session-harness/register.cjs'),
        path.join(__dirname, 'u4-browser-bootstrap.ts'),
      ],
      { env: appEnv, ipc: true },
    );
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Owned Nest startup deadline')),
        120000,
      );
      backendChild.on('message', (message) => {
        if (message?.ready) {
          clearTimeout(timer);
          resolve();
        }
      });
      backendChild.completion
        .then(() => reject(new Error('Nest exited before readiness')), reject)
        .finally(() => clearTimeout(timer));
    });
    const web = path.join(root, 'web');
    const webEnv = {
      ...appEnv,
      EXPO_PUBLIC_API_URL: 'http://127.0.0.1:' + ports.api,
      NODE_ENV: 'production',
      METRO_CACHE_DIR: path.join(root, 'metro'),
      BABEL_CACHE_PATH: path.join(root, 'babel.json'),
    };
    await run(
      'expo-export',
      process.execPath,
      [
        path.join(frontend, 'node_modules/expo/bin/cli'),
        'export',
        '--platform',
        'web',
        '--output-dir',
        web,
        '--max-workers',
        '1',
      ],
      { env: webEnv, cwd: frontend, timeout: 180000 },
    );
    server = http.createServer((req, res) => {
      let file;
      try {
        file = path.resolve(
          web,
          '.' +
            decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname),
        );
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }
      if (file !== web && !file.startsWith(web + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile())
        file = fs.existsSync(file + '.html')
          ? file + '.html'
          : path.join(web, 'index.html');
      res.setHeader(
        'Content-Type',
        file.endsWith('.js')
          ? 'text/javascript'
          : file.endsWith('.css')
            ? 'text/css'
            : file.endsWith('.png')
              ? 'image/png'
              : file.endsWith('.ttf')
                ? 'font/ttf'
                : 'text/html',
      );
      fs.createReadStream(file)
        .on('error', () => res.destroy())
        .pipe(res);
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(ports.web, '127.0.0.1', resolve);
    });
    await run(
      'financial-browser',
      process.execPath,
      [
        path.join(frontend, 'node_modules/@playwright/test/cli.js'),
        'test',
        '--config',
        'playwright.financial.config.ts',
      ],
      {
        cwd: frontend,
        env: {
          ...appEnv,
          FINANCIAL_WEB_URL: 'http://127.0.0.1:' + ports.web,
          FINANCIAL_API_URL: 'http://127.0.0.1:' + ports.api,
          FINANCIAL_ARTIFACTS: root,
          FINANCIAL_TEST_PASSWORD:
            'Aa1!' + crypto.randomBytes(12).toString('hex'),
        },
        timeout: 180000,
      },
    );
    success = true;
  } catch (error) {
    primary = error;
    proof.error = error.message;
  } finally {
    const attempt = async (label, work) => {
      try {
        await work();
        proof.cleanup[label] = 'confirmed';
      } catch (error) {
        cleanupErrors.push(error);
        proof.cleanup[label] = 'unconfirmed';
      }
    };
    await attempt('children', async () => {
      for (const child of [...children]) await stopChild(child);
    });
    await attempt('web', async () => {
      if (server?.listening) {
        server.closeAllConnections();
        await new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    });
    await attempt('lease', async () => {
      if (lease)
        await lease.close({
          participantsStopped: releaseAllowed(
            success,
            cancelled,
            cleanupErrors,
            children.size === 0,
          ),
        });
    });
    await attempt('cluster', async () => {
      if (!pgStarted) return;
      confirmOwner();
      const pidFile = path.join(data, 'postmaster.pid');
      if (!fs.existsSync(pidFile)) return;
      const pid = fs.readFileSync(pidFile, 'utf8').trim().split(/\r?\n/);
      if (path.resolve(pid[1]) !== data || Number(pid[3]) !== ports.postgres)
        throw new Error('Shutdown identity mismatch');
      // Cleanup commands remain allowed after cancellation, but only for this exact owned data directory.
      const previous = cancelled;
      cancelled = false;
      try {
        await run(
          'pg-stop',
          path.join(pgBin, 'pg_ctl.exe'),
          ['-D', data, '-m', 'fast', '-w', '-t', '30', 'stop'],
          { timeout: 45000 },
        );
      } finally {
        cancelled = previous;
      }
      if (fs.existsSync(pidFile))
        throw new Error('Owned postmaster shutdown unconfirmed');
    });
    if (fs.existsSync(secret)) fs.unlinkSync(secret);
    clearTimeout(overall);
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
    proof.status =
      success && !cancelled && cleanupErrors.length === 0 ? 'passed' : 'failed';
    proof.cleanupErrors = cleanupErrors.map((e) => e.message);
    save();
    console.log(JSON.stringify({ status: proof.status, evidence: proof.root }));
  }
  const failure = runtime.combine(primary, cleanupErrors);
  if (failure || proof.status !== 'passed')
    throw failure || new Error('Financial validation failed closed');
}
module.exports = {
  ownedData,
  assertOwner,
  assertServer,
  releaseAllowed,
  cleanEnvironment,
};
if (require.main === module)
  main().catch(() => {
    console.error(
      'Financial closure failed; retain the owned evidence and cluster. No retry or claim takeover.',
    );
    process.exitCode = 1;
  });
