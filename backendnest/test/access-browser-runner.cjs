const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const runtime = require('./e2e-runtime.cjs');
const { runnerSnapshot } = require('./session-harness/u6-source.cjs');
const repo = path.resolve(__dirname, '../..');
const backend = path.join(repo, 'backendnest');
const frontend = path.join(repo, 'frontend');

function ports(env) {
  const api = Number(env.ACCESS_API_PORT || 4319);
  const web = Number(env.ACCESS_WEB_PORT || 4189);
  if (
    ![api, web].every(
      (port) => Number.isInteger(port) && port >= 1024 && port <= 65535,
    ) ||
    api === web
  )
    throw new Error('Two distinct unprivileged loopback ports are required.');
  return { api, web };
}

async function freePort(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

function staticFile(root, url) {
  const pathname = decodeURIComponent(
    new URL(url, 'http://127.0.0.1').pathname,
  );
  // URL paths use forward slashes on every host, including Linux CI.
  if (pathname.includes('\\')) throw new Error('Invalid static path.');
  const target = path.resolve(root, '.' + pathname);
  if (target !== root && !target.startsWith(root + path.sep))
    throw new Error('Invalid static path.');
  return target;
}

// Emit only fixed statuses, ordinal cases and source line numbers. Raw browser
// errors can contain credentials, request bodies and local paths; keep them private.
function browserFailures(report) {
  const failures = [];
  let ordinal = 0;
  const visit = (suites) => {
    if (!Array.isArray(suites)) return;
    for (const suite of suites) {
      for (const spec of Array.isArray(suite.specs) ? suite.specs : []) {
        ordinal++;
        for (const entry of Array.isArray(spec.tests) ? spec.tests : []) {
          for (const result of Array.isArray(entry.results)
            ? entry.results
            : []) {
            if (!['failed', 'timedOut', 'interrupted'].includes(result.status))
              continue;
            const locations = [
              result.errorLocation,
              ...(Array.isArray(result.errors)
                ? result.errors.map((error) => error.location)
                : []),
            ];
            const location = locations.find(
              (item) =>
                typeof item?.file === 'string' &&
                item.file.replaceAll('\\', '/').split('/').at(-1) ===
                  'access.spec.ts' &&
                Number.isInteger(item.line) &&
                item.line > 0 &&
                item.line < 10000,
            );
            failures.push({
              case: ordinal,
              status: result.status,
              line: location?.line ?? 0,
            });
          }
        }
      }
      visit(suite.suites);
    }
  };
  visit(report?.suites);
  return failures;
}

async function run(env = process.env) {
  // No resources or application dotenv are loaded before explicit confinement.
  const config = runtime.resolveConfig(env);
  const selected = ports(env);
  await Promise.all([freePort(selected.api), freePort(selected.web)]);
  const runId = crypto.randomUUID();
  const artifacts = path.join(repo, '.tmp', 'access-' + runId);
  await fs.mkdir(path.dirname(artifacts), { recursive: true });
  await fs.mkdir(artifacts);
  const webRoot = path.join(artifacts, 'web');
  const apiUrl = `http://127.0.0.1:${selected.api}`;
  const webUrl = `http://127.0.0.1:${selected.web}`;
  const sources = runnerSnapshot('U5');
  for (const relative of [
    'backendnest/package.json',
    'frontend/playwright.access.config.ts',
    'frontend/tests/access/access.spec.ts',
  ]) {
    sources.push({
      path: relative,
      sha256: crypto
        .createHash('sha256')
        .update(await fs.readFile(path.join(repo, relative)))
        .digest('hex'),
    });
  }
  sources.sort((left, right) => left.path.localeCompare(right.path));
  const binding = {
    scope: 'DISPOSABLE_ACCESS_WEB',
    runId,
    apiUrl,
    webUrl,
    sourceDigest: crypto
      .createHash('sha256')
      .update(JSON.stringify(sources))
      .digest('hex'),
    sources,
  };
  await fs.writeFile(
    path.join(artifacts, 'binding.json'),
    JSON.stringify(binding, null, 2),
  );
  console.log(JSON.stringify({ phase: 'starting', artifacts }));
  const children = new Set();
  const logs = [];
  let lease,
    server,
    primary,
    cancelled = false;
  const cleanupErrors = [];

  async function stop(child) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    if (child.connected) child.send('shutdown');
    else child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => child.once('close', resolve)),
      new Promise((resolve) => {
        const timer = setTimeout(resolve, 5000);
        timer.unref();
      }),
    ]);
    if (child.exitCode === null && child.signalCode === null) {
      if (process.platform === 'win32')
        execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
      else child.kill('SIGKILL');
      await new Promise((resolve) => child.once('close', resolve));
    }
  }

  async function child(args, cwd, name, childEnv, ready = false, cap = 180000) {
    const log = await fs.open(path.join(artifacts, name + '.log'), 'wx');
    logs.push(log);
    const processChild = spawn(process.execPath, args, {
      cwd,
      env: childEnv,
      windowsHide: true,
      stdio: ready
        ? ['ignore', log.fd, log.fd, 'ipc']
        : ['ignore', log.fd, log.fd],
    });
    children.add(processChild);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(name + ' exceeded its finite timeout.'));
      }, cap);
      processChild.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      processChild.once('close', (code, signal) => {
        clearTimeout(timer);
        children.delete(processChild);
        if (code === 0 && !ready) resolve(processChild);
        else
          reject(
            new Error(
              `${name} exited before completion (code=${code}, signal=${signal}); see its private log.`,
            ),
          );
      });
      if (ready)
        processChild.on('message', (message) => {
          if (
            message?.ready === true &&
            message.address?.port === selected.api
          ) {
            clearTimeout(timer);
            resolve(processChild);
          }
        });
    });
  }

  const abort = () => {
    cancelled = true;
    for (const processChild of children) void stop(processChild);
  };
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  try {
    lease = await runtime.acquireLease(config, { onLost: abort });
    const childEnv = runtime.configureEnvironment(config, {
      ...env,
      ...lease.environment,
      NODE_ENV: 'test',
      TZ: 'UTC',
      TS_NODE_TRANSPILE_ONLY: 'true',
      PORT: String(selected.api),
      CORS_ORIGINS: webUrl,
      THROTTLE_LIMIT: '1000',
      THROTTLE_TTL_MS: '60000',
      JWT_ACCESS_SECRET: 'access_disposable_signing_key_only_20261111',
      JWT_REFRESH_SECRET: 'refresh_disposable_signing_key_only_20261111',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '30d',
      AUTH_RETURN_RESET_TOKEN: 'true',
      PASSWORD_RESET_DELIVERY_URL: '',
      PASSWORD_RESET_DELIVERY_API_KEY: '',
      EXPO_NO_DOTENV: '1',
      EXPO_NO_TELEMETRY: '1',
      CI: '1',
      ACCESS_BINDING: path.join(artifacts, 'binding.json'),
      ACCESS_REPORT: path.join(artifacts, 'browser.json'),
    });
    await child(
      [
        '-r',
        'ts-node/register',
        '-r',
        'tsconfig-paths/register',
        'test/access-browser-prepare.ts',
      ],
      backend,
      'prepare',
      childEnv,
      false,
      60000,
    );
    const api = await child(
      [
        '-r',
        'ts-node/register',
        '-r',
        'tsconfig-paths/register',
        'test/u4-browser-bootstrap.ts',
      ],
      backend,
      'api',
      childEnv,
      true,
      120000,
    );
    const health = await fetch(apiUrl + '/health', {
      signal: AbortSignal.timeout(10000),
    });
    if (health.status !== 200)
      throw new Error('Disposable API health check failed.');
    await child(
      [
        'node_modules/expo/bin/cli',
        'export',
        '--clear',
        '--platform',
        'web',
        '--output-dir',
        webRoot,
      ],
      frontend,
      'export',
      {
        ...childEnv,
        NODE_ENV: 'production',
        EXPO_PUBLIC_API_URL: apiUrl,
      },
    );
    const mime = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.wasm': 'application/wasm',
    };
    server = http.createServer(async (request, response) => {
      if (request.url === '/_access-proof') {
        response.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        response.end(
          JSON.stringify({
            scope: binding.scope,
            runId,
            sourceDigest: binding.sourceDigest,
          }),
        );
        return;
      }
      try {
        const target = staticFile(webRoot, request.url);
        let file;
        for (const candidate of [
          target,
          target + '.html',
          path.join(target, 'index.html'),
        ]) {
          if (
            await fs.stat(candidate).then(
              (stat) => stat.isFile(),
              () => false,
            )
          ) {
            file = candidate;
            break;
          }
        }
        if (!file) {
          response.writeHead(404);
          response.end();
          return;
        }
        response.writeHead(200, {
          'Content-Type':
            mime[path.extname(file)] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        response.end(await fs.readFile(file));
      } catch {
        response.writeHead(400);
        response.end();
      }
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(selected.web, '127.0.0.1', resolve);
    });
    await child(
      [
        'node_modules/@playwright/test/cli.js',
        'test',
        '--config',
        'playwright.access.config.ts',
      ],
      frontend,
      'browser',
      childEnv,
      false,
      600000,
    );
    if (
      cancelled ||
      !lease.healthy ||
      api.exitCode !== null ||
      api.signalCode !== null
    )
      throw new Error('Access runtime ownership was lost or cancelled.');
  } catch (error) {
    primary = error;
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    for (const processChild of children) {
      try {
        await stop(processChild);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    for (const log of logs) await log.close();
    if (lease) {
      try {
        await lease.close({
          participantsStopped: !primary && cleanupErrors.length === 0,
        });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
    await fs.writeFile(
      path.join(artifacts, 'result.json'),
      JSON.stringify(
        {
          status: primary || cleanupErrors.length ? 'FAIL' : 'PASS',
          scope: binding.scope,
          sourceDigest: binding.sourceDigest,
          childrenStopped: children.size === 0,
          cleanupErrors: cleanupErrors.length,
          error: primary?.message,
        },
        null,
        2,
      ),
    );
  }
  if (primary) {
    try {
      const report = JSON.parse(
        await fs.readFile(path.join(artifacts, 'browser.json'), 'utf8'),
      );
      for (const failure of browserFailures(report))
        console.error('ACCESS_BROWSER_FAILURE:' + JSON.stringify(failure));
    } catch {
      console.error('ACCESS_BROWSER_REPORT_UNAVAILABLE');
    }
  }
  if (primary || cleanupErrors.length) throw primary || cleanupErrors[0];
  console.log(
    JSON.stringify({
      status: 'PASS',
      scope: binding.scope,
      sourceDigest: binding.sourceDigest,
      artifacts,
    }),
  );
}

module.exports = { run, ports, staticFile, browserFailures };
if (require.main === module)
  void run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
