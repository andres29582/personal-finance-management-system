const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const http = require('node:http'),
  net = require('node:net'),
  { spawn } = require('node:child_process');
const { validateNegative, validateCleanup } = require('./c6-negative.cjs');
const e2eRuntime = require('../e2e-runtime.cjs');
const {
  createCancellation,
  settleCleanup,
  validateBinding,
  candidateHash,
  caps,
} = require('./u6-runtime.cjs');
const cancellation = createCancellation();
const binding = process.env.U6_COORDINATOR_BINDING
  ? JSON.parse(process.env.U6_COORDINATOR_BINDING)
  : null;
const repo = path.resolve(__dirname, '../../..'),
  backend = path.join(repo, 'backendnest'),
  frontend = path.join(repo, 'frontend');
const selected = process.argv[2];
assert.ok(
  ['C6', 'C6_SQL_ERROR', 'A8', 'C7C8', 'U5', 'U5B', 'U5R', 'U5D'].includes(
    selected,
  ),
  'Only current C6, C6_SQL_ERROR, A8, combined C7C8, U5, U5B, U5R or U5D is supported; future cases fail closed.',
);
assert.equal(process.argv.length, 3, 'Exactly one maintained case is required');
const nonce = crypto.randomUUID().replaceAll('-', ''),
  root = binding
    ? path.resolve(repo, binding.root)
    : path.join(
        repo,
        '.tmp',
        `session-harness-${selected.toLowerCase()}-${nonce}`,
      ),
  run = path.join(root, 'run'),
  data = path.join(root, 'data');
const bin =
  process.env.SESSION_HARNESS_PG_BIN ||
  path.join(process.env.ProgramFiles || '', 'PostgreSQL', '18', 'bin');
assert.ok(
  path.isAbsolute(bin),
  'Explicit installed PostgreSQL bin directory required.',
);
const exe = (name) =>
  path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
const role = `finance_e2e_current_${nonce.slice(0, 16)}_owner`,
  database = `finance_e2e_current_${nonce.slice(0, 16)}`;
const systemRoot = process.env.SystemRoot;
const env = {
  SystemRoot: systemRoot,
  WINDIR: systemRoot,
  PATH: [
    path.dirname(process.execPath),
    systemRoot && path.join(systemRoot, 'System32'),
    bin,
  ]
    .filter(Boolean)
    .join(path.delimiter),
  TEMP: root,
  TMP: root,
  TZ: 'UTC',
  NODE_PATH: path.join(backend, 'node_modules'),
};
const dbEnv = {
  NODE_ENV: 'test',
  DB_HOST: '127.0.0.1',
  DB_PORT: '55434',
  DB_NAME: database,
  DB_USERNAME: role,
  DB_PASSWORD: 'disposable-local-only',
  DB_SSL_MODE: 'disable',
  E2E_DB_HOST: '127.0.0.1',
  E2E_DB_PORT: '55434',
  E2E_DB_NAME: database,
  E2E_DB_USERNAME: role,
  E2E_DB_PASSWORD: 'disposable-local-only',
  E2E_DB_RESET_CONFIRM: database,
  JWT_ACCESS_SECRET: 'u4_disposable_access_secret_local_only',
  JWT_REFRESH_SECRET: 'u4_disposable_refresh_secret_local_only',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '30d',
  JWT_ISSUER: 'meu-sistema-financeiro',
  AUTH_MAX_ACTIVE_SESSIONS: '5',
  PASSWORD_CHANGED_WORKER_ENABLED: 'false',
  PASSWORD_CHANGED_RESEND_LIVE_ENABLED: 'false',
  PASSWORD_RESET_DELIVERY_URL: '',
  PASSWORD_RESET_DELIVERY_API_KEY: '',
  AUTH_RETURN_RESET_TOKEN: 'false',
  PORT: '4318',
  CORS_ORIGINS: 'http://127.0.0.1:4178',
  THROTTLE_LIMIT: '60',
  THROTTLE_TTL_MS: '60000',
  SESSION_HARNESS_ARTIFACTS: root,
  SESSION_HARNESS_PG_BIN: bin,
  SESSION_HARNESS_CASE: selected,
  U5D_DEST_DATABASE: `finance_e2e_restore_${nonce.slice(0, 16)}`,
  U5D_DEST_ROLE: `finance_e2e_restore_${nonce.slice(0, 16)}_owner`,
  U5D_NEG_DATABASE: `finance_e2e_negative_${nonce.slice(0, 16)}`,
  U5D_NEG_ROLE: `finance_e2e_negative_${nonce.slice(0, 16)}_owner`,
};
const proof = {
  case: selected,
  status: 'running',
  nonce,
  operations: [],
  limits: {
    goalsMs: ['C7C8', 'U5B', 'U5R'].includes(selected) ? 120000 : 180000,
    startupMs: 120000,
    browserWorkers: 1,
    browserRetries: 0,
    browserGlobalMs: 120000,
    officialExportMs: 180000,
  },
  cleanup: {},
  scope:
    'Owned local PG18.3 and actual Nest/AppModule; only selected case. C7C8 is bounded local concurrency/integrity observation, not production capacity. No separate-context offline race, native lifecycle or BFCache proof.',
};
const hash = (file) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const commandChildren = new Set();
const phaseCaps = caps(selected);
proof.aggregateCaps = phaseCaps;
let phase = 'setupMs',
  phaseDeadline = Date.now() + phaseCaps.setupMs;
function setPhase(name) {
  phase = name;
  phaseDeadline = Date.now() + phaseCaps[name];
}
function remaining(cap) {
  const value = Math.min(cap, phaseDeadline - Date.now());
  assert.ok(value > 0, 'Aggregate ' + phase + ' exhausted');
  return value;
}
async function ownedHandshake() {
  if (!binding) return;
  assert.equal(process.connected, true);
  assert.deepEqual(Object.keys(binding).sort(), [
    'candidate',
    'case',
    'root',
    'runnerCandidate',
    'token',
  ]);
  assert.equal(binding.case, selected);
  assert.match(binding.root, /^\.tmp\/u6-runtime-[a-f0-9-]{36}$/);
  assert.match(binding.token, /^[a-f0-9-]{36}$/);
  assert.equal(
    candidateHash(require('./u6.cjs').inventory()),
    binding.candidate,
  );
  assert.equal(candidateHash(snapshot()), binding.runnerCandidate);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error('Owner handshake timeout')),
      remaining(30000),
    );
    process.on('message', (message) => {
      try {
        if (message?.type === 'cancel') {
          validateBinding(message, binding, 'cancel');
          cancellation.cancel();
          clearTimeout(timer);
          reject(Error('Owner cancelled'));
        } else {
          validateBinding(message, binding, 'go');
          clearTimeout(timer);
          resolve();
        }
      } catch {
        cancellation.cancel();
        clearTimeout(timer);
        reject(Error('Owner binding rejected'));
      }
    });
    process.once('disconnect', () => {
      cancellation.cancel();
      clearTimeout(timer);
      reject(Error('Owner disconnected'));
    });
    process.send({ schemaVersion: 2, type: 'owned', ...binding });
  });
  proof.binding = binding;
}
if (selected === 'C7C8')
  proof.cases = [
    { case: 'C7', status: 'NOT RUN' },
    { case: 'C8', status: 'NOT RUN' },
  ];
function confined(file) {
  return require('./u6-owned.cjs').confined(file, root);
}
const write = (name, value) =>
  fs.writeFileSync(
    confined(path.join(root, name + '.json')),
    JSON.stringify(value, null, 2),
    { flag: 'wx' },
  );
async function free(port) {
  assert.notEqual(port, 5432);
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    const timer = setTimeout(() => {
      server.close();
      reject(Error('Port readback timeout'));
    }, remaining(2000));
    server.once('error', reject);
    server.once('error', () => clearTimeout(timer));
    server.listen(port, '127.0.0.1', () =>
      server.close(() => {
        clearTimeout(timer);
        resolve();
      }),
    );
  });
}
async function command(
  label,
  executable,
  args,
  extra = {},
  timeout = 60000,
  cwd = run,
) {
  cancellation.check();
  timeout = remaining(timeout);
  const out = fs.openSync(
      confined(path.join(root, label + '.stdout.log')),
      'wx',
    ),
    err = fs.openSync(confined(path.join(root, label + '.stderr.log')), 'wx'),
    began = Date.now();
  try {
    const status = await new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        cwd,
        env: { ...env, ...extra },
        shell: false,
        windowsHide: true,
        stdio: ['ignore', out, err],
      });
      commandChildren.add(child);
      child.once('exit', () => commandChildren.delete(child));
      let timedOut = false,
        hardTimer;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
        hardTimer = setTimeout(
          () => reject(Error(label + ' termination unconfirmed')),
          2000,
        );
      }, timeout);
      child.once('error', (e) => {
        clearTimeout(timer);
        clearTimeout(hardTimer);
        commandChildren.delete(child);
        reject(e);
      });
      child.once('exit', (code, signal) => {
        clearTimeout(timer);
        clearTimeout(hardTimer);
        resolve({ code, signal, pid: child.pid, timedOut });
      });
    });
    proof.operations.push({ label, ...status, elapsedMs: Date.now() - began });
    assert.equal(status.timedOut, false, label + ' timeout');
    assert.equal(status.signal, null, label + ' signal');
    assert.equal(status.code, 0, label + ' nonzero');
    cancellation.check();
    return fs
      .readFileSync(path.join(root, label + '.stdout.log'), 'utf8')
      .trim();
  } finally {
    fs.closeSync(out);
    fs.closeSync(err);
  }
}
function snapshot() {
  return require('./u6-source.cjs').runnerSnapshot(selected);
}
function integrity(records) {
  for (const record of records)
    assert.equal(
      hash(path.join(repo, record.path)),
      record.sha256,
      'Frozen source drift: ' + record.path,
    );
}
async function external(label) {
  assert.equal(
    process.platform,
    'win32',
    'External PostgreSQL-service readback currently supports Windows only.',
  );
  const script =
    "$tcp=@(Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue | Sort-Object LocalAddress | Select-Object LocalAddress,LocalPort,OwningProcess); $ids=@($tcp | Select-Object -ExpandProperty OwningProcess -Unique); $processes=@(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -in $ids } | Sort-Object ProcessId | Select-Object ProcessId,CreationDate,ExecutablePath); $services=@(Get-CimInstance Win32_Service | Where-Object Name -eq 'postgresql-x64-18' | Select-Object Name,State,ProcessId,PathName); @{tcp=$tcp;processes=$processes;services=$services} | ConvertTo-Json -Depth 6 -Compress";
  return JSON.parse(
    await command(
      label,
      path.join(systemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
      ['-NoProfile', '-NonInteractive', '-Command', script],
    ),
  );
}
let backendChild,
  backendExited = false,
  pgStarted = false,
  staticServer,
  databaseLease;
const sockets = new Set(),
  counts = {};
async function backendStart() {
  cancellation.check();
  setPhase('startupMs');
  const began = Date.now();
  proof.startup = { budgetMs: proof.limits.startupMs, milestones: [] };
  const out = fs.openSync(path.join(root, 'backend.stdout.log'), 'wx'),
    err = fs.openSync(path.join(root, 'backend.stderr.log'), 'wx');
  backendChild = spawn(
    process.execPath,
    [
      path.join(__dirname, 'register.cjs'),
      path.join(backend, 'test/u4-browser-bootstrap.ts'),
    ],
    {
      cwd: run,
      env: { ...env, ...dbEnv },
      shell: false,
      windowsHide: true,
      stdio: ['ignore', out, err, 'ipc'],
    },
  );
  proof.startup.milestones.push({
    event: 'process-spawned',
    elapsedMs: Date.now() - began,
    pid: backendChild.pid,
  });
  fs.closeSync(out);
  fs.closeSync(err);
  backendChild.once('exit', () => {
    backendExited = true;
  });
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error('Backend readiness timeout')),
      proof.limits.startupMs,
    );
    backendChild.once('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    backendChild.once('exit', () => {
      clearTimeout(timer);
      reject(Error('Backend exited before ready'));
    });
    backendChild.on('message', (m) => {
      if (m.milestone) {
        proof.startup.milestones.push({
          event: m.milestone,
          elapsedMs: Date.now() - began,
        });
        return;
      }
      if (!m.ready) return;
      proof.startup.milestones.push({
        event: 'nest-listening-ipc',
        elapsedMs: Date.now() - began,
      });
      clearTimeout(timer);
      resolve(m);
    });
  });
  assert.equal(ready.pid, backendChild.pid);
  assert.equal(ready.address.address, '127.0.0.1');
  assert.equal(ready.address.port, 4318);
  assert.equal(
    (
      await fetch('http://127.0.0.1:4318/health', {
        signal: AbortSignal.timeout(
          Math.max(
            1,
            Math.min(12000, proof.limits.startupMs - (Date.now() - began)),
          ),
        ),
      })
    ).status,
    200,
  );
  assert.ok(
    Date.now() - began <= proof.limits.startupMs,
    'Entire measured startup must stay within declared budget',
  );
  proof.startup.milestones.push({
    event: 'http-health-ready',
    elapsedMs: Date.now() - began,
  });
  proof.startup.elapsedMs = Date.now() - began;
  proof.backend = ready;
}
async function webStart() {
  const output = path.join(root, 'dist');
  staticServer = http.createServer((req, res) => {
    if (req.url === '/__stats') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(counts));
    }
    if (req.url.startsWith('/api/')) {
      const target = req.url.slice(4),
        key = req.method + ' ' + target.split('?')[0];
      counts[key] = (counts[key] || 0) + 1;
      const proxy = http.request(
        {
          host: '127.0.0.1',
          port: 4318,
          path: target,
          method: req.method,
          headers: { ...req.headers, host: '127.0.0.1:4318' },
        },
        (response) => {
          const k = key + ' ' + response.statusCode;
          counts[k] = (counts[k] || 0) + 1;
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      proxy.on('error', () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      req.pipe(proxy);
      return;
    }
    let requested;
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, 'http://127.0.0.1:4178').pathname,
      );
      requested = path.resolve(output, '.' + pathname);
    } catch {
      res.writeHead(400);
      return res.end();
    }
    if (requested !== output && !requested.startsWith(output + path.sep)) {
      res.writeHead(400);
      return res.end();
    }
    const asset =
      fs.existsSync(requested) && fs.statSync(requested).isFile()
        ? requested
        : path.join(output, 'index.html');
    res.setHeader(
      'Content-Type',
      asset.endsWith('.js')
        ? 'text/javascript'
        : asset.endsWith('.css')
          ? 'text/css'
          : asset.endsWith('.ttf')
            ? 'font/ttf'
            : asset.endsWith('.png')
              ? 'image/png'
              : 'text/html',
    );
    fs.createReadStream(asset)
      .on('error', () => res.destroy())
      .pipe(res);
  });
  staticServer.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error('Owned web listen timeout')),
      remaining(2000),
    );
    staticServer.once('error', reject);
    staticServer.once('error', () => clearTimeout(timer));
    staticServer.listen(4178, '127.0.0.1', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
async function cleanup() {
  cancellation.beginCleanup();
  setPhase('cleanupMs');
  let cleanupSucceeded = true;
  await settleCleanup(
    [
      async () => {
        for (const child of commandChildren) {
          child.kill();
          await new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(Error('Owned command exit unconfirmed')),
              5000,
            );
            child.once('exit', () => {
              clearTimeout(timer);
              resolve();
            });
          });
        }
        proof.cleanup.commandChildrenExited = commandChildren.size === 0;
      },
      async () => {
        if (backendChild && !backendExited) {
          if (backendChild.connected) backendChild.send('shutdown');
          await new Promise((resolve, reject) => {
            let hardTimer;
            const timer = setTimeout(() => {
              backendChild.kill();
              hardTimer = setTimeout(
                () => reject(Error('Owned backend exit unconfirmed')),
                2000,
              );
            }, 10000);
            backendChild.once('exit', () => {
              clearTimeout(timer);
              clearTimeout(hardTimer);
              resolve();
            });
          });
        }
        proof.cleanup.backendExited = backendExited;
      },
      async () => {
        if (staticServer) {
          for (const socket of sockets) socket.destroy();
          await new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(Error('Owned web close timeout')),
              remaining(5000),
            );
            staticServer.close(() => {
              clearTimeout(timer);
              resolve();
            });
          });
          proof.cleanup.webClosed = true;
        }
      },
      async () => {
        if (databaseLease) {
          await databaseLease.close({
            participantsStopped:
              proof.status === 'completed' &&
              !cancellation.cancelled &&
              cleanupSucceeded &&
              commandChildren.size === 0 &&
              (!backendChild || backendExited),
          });
        }
      },
      async () => {
        if (pgStarted || fs.existsSync(path.join(data, 'postmaster.pid'))) {
          confined(data);
          const lines = fs
              .readFileSync(path.join(data, 'postmaster.pid'), 'utf8')
              .split(/\r?\n/),
            pid = Number(lines[0]);
          assert.ok(Number.isSafeInteger(pid) && pid > 0);
          assert.equal(
            path.resolve(lines[1]).toLowerCase(),
            data.toLowerCase(),
          );
          assert.equal(Number(lines[3]), 55434);
          assert.equal(lines[5], '127.0.0.1');
          process.kill(pid, 0);
          await command('pg-stop', exe('pg_ctl'), [
            '-D',
            data,
            '-m',
            'fast',
            '-w',
            '-t',
            '30',
            'stop',
          ]);
          proof.cleanup.pgStopped = true;
        }
      },
      async () => {
        for (const port of [4178, 4318, 55434]) await free(port);
        proof.cleanup.portsFree = true;
      },
    ].map((step) => async () => {
      try {
        await step();
      } catch (error) {
        cleanupSucceeded = false;
        throw error;
      }
    }),
  );
}
async function main() {
  cancellation.check();
  await ownedHandshake();
  confined(root);
  assert.equal(fs.existsSync(root), false);
  fs.mkdirSync(run, { recursive: true });
  assert.deepEqual(fs.readdirSync(run), []);
  for (const port of [4178, 4318, 55434]) await free(port);
  const frozen = snapshot();
  write('candidate', frozen);
  proof.sourceManifestSha256 = hash(path.join(root, 'candidate.json'));
  proof.artifacts = path.relative(repo, root).replaceAll(path.sep, '/');
  let primaryFailure;
  let primaryFailed = false;
  try {
    proof.externalBefore = await external('external-before');
    assert.ok(
      proof.externalBefore.tcp.length > 0,
      'Existing external PostgreSQL identity expected',
    );
    proof.pgVersion = await command('pg-version', exe('postgres'), [
      '--version',
    ]);
    assert.match(proof.pgVersion, /18\.3/);
    await command('initdb', exe('initdb'), [
      '-D',
      data,
      '-U',
      'postgres',
      '--auth=trust',
      '--encoding=UTF8',
      '--no-locale',
    ]);
    await command('pg-start', exe('pg_ctl'), [
      '-D',
      data,
      '-l',
      path.join(root, 'postgres.log'),
      '-o',
      '-h 127.0.0.1 -p 55434 -c max_connections=24',
      '-w',
      '-t',
      '30',
      'start',
    ]);
    pgStarted = true;
    let sql = `CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;\nALTER ROLE ${role} SET timezone='UTC';\nCREATE DATABASE ${database} OWNER ${role};\nCOMMENT ON DATABASE ${database} IS 'finance-e2e-disposable';\nREVOKE CONNECT ON DATABASE postgres FROM PUBLIC;\nREVOKE CONNECT ON DATABASE template1 FROM PUBLIC;\nREVOKE ALL ON DATABASE ${database} FROM PUBLIC;\nGRANT CONNECT,CREATE,TEMPORARY ON DATABASE ${database} TO ${role};\n`;
    if (selected === 'U5D')
      for (const [db, owner] of [
        [dbEnv.U5D_DEST_DATABASE, dbEnv.U5D_DEST_ROLE],
        [dbEnv.U5D_NEG_DATABASE, dbEnv.U5D_NEG_ROLE],
      ])
        sql += `CREATE ROLE ${owner} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;\nALTER ROLE ${owner} SET timezone='UTC';\nCREATE DATABASE ${db} OWNER ${owner};\nCOMMENT ON DATABASE ${db} IS 'finance-e2e-disposable';\nREVOKE ALL ON DATABASE ${db} FROM PUBLIC;\nGRANT CONNECT,CREATE,TEMPORARY ON DATABASE ${db} TO ${owner};\n`;
    fs.writeFileSync(path.join(root, 'bootstrap.sql'), sql, { flag: 'wx' });
    await command('pg-bootstrap', exe('psql'), [
      '-X',
      '-h',
      '127.0.0.1',
      '-p',
      '55434',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      path.join(root, 'bootstrap.sql'),
    ]);
    databaseLease = await e2eRuntime.acquireLease(
      e2eRuntime.resolveConfig(dbEnv),
      {
        onLost: () => {
          cancellation.cancel();
          backendChild?.kill();
          for (const child of commandChildren) child.kill();
        },
      },
    );
    Object.assign(dbEnv, databaseLease.environment);
    e2eRuntime.configureEnvironment(e2eRuntime.resolveConfig(dbEnv), dbEnv);
    cancellation.check();
    proof.database = JSON.parse(
      await command(
        'prepare',
        process.execPath,
        [
          path.join(__dirname, 'register.cjs'),
          path.join(__dirname, 'prepare.ts'),
        ],
        dbEnv,
      ),
    );
    if (!['U5D', 'C6_SQL_ERROR'].includes(selected)) await backendStart();
    setPhase('goalsMs');
    if (selected === 'C6_SQL_ERROR') proof.backendNotStarted = true;
    if (selected === 'U5D') {
      if (binding) write('u5d-owner', binding);
      await command(
        'u5-deployment',
        process.execPath,
        [
          path.join(__dirname, 'register.cjs'),
          path.join(__dirname, 'u5-deployment.cjs'),
        ],
        {
          ...dbEnv,
          ...(binding
            ? { U6_COORDINATOR_BINDING: JSON.stringify(binding) }
            : {}),
        },
        proof.limits.goalsMs,
      );
      const result = JSON.parse(
        fs.readFileSync(path.join(root, 'u5d-proof.json'), 'utf8'),
      );
      assert.equal(result.status, 'PASS');
      proof.cases = result.cases;
    } else if (selected === 'U5') {
      await command(
        'u5',
        process.execPath,
        [path.join(__dirname, 'register.cjs'), path.join(__dirname, 'u5.ts')],
        dbEnv,
        180000,
      );
      const result = JSON.parse(
        fs.readFileSync(path.join(root, 'u5-proof.json'), 'utf8'),
      );
      assert.equal(result.status, 'PASS');
      proof.cases = result.cases.map(({ name, status }) => ({
        case: name,
        status,
      }));
    } else if (['C6', 'C6_SQL_ERROR'].includes(selected)) {
      await command(
        'c6',
        process.execPath,
        [path.join(__dirname, 'c6.cjs')],
        dbEnv,
        180000,
      );
      const file =
        selected === 'C6' ? 'c6-proof.json' : 'c6-sql-error-proof.json';
      const result = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
      assert.equal(result.case, selected);
      assert.equal(result.status, 'completed');
      if (selected === 'C6_SQL_ERROR') {
        validateNegative(result);
        proof.counts = result.counts;
        proof.cases = [{ case: selected, status: 'PASS' }];
      } else {
        assert.deepEqual(result.counts, {
          fixtures: 4,
          passed: 4,
          accepted: 1,
          denied: 3,
        });
        assert.equal(result.customPG18DumpRestore, true);
        assert.equal(result.schemaMetadataEqual, true);
        assert.equal(result.exactAuthorityEquality.rows, 4);
        assert.equal(result.cases.length, 4);
        assert.deepEqual(
          result.cases.map((entry) => entry.passed),
          [true, true, true, true],
        );
        proof.counts = result.counts;
      }
    } else if (selected === 'C7C8') {
      await command(
        'c7-c8',
        process.execPath,
        [path.join(__dirname, 'load.cjs')],
        dbEnv,
        proof.limits.goalsMs,
      );
      const result = JSON.parse(
        fs.readFileSync(path.join(root, 'load-proof.json'), 'utf8'),
      );
      assert.equal(result.status, 'completed');
      assert.deepEqual(
        result.cases.map((c) => c.status),
        ['PASS', 'PASS'],
      );
      proof.cases = result.cases.map(({ case: name, status }) => ({
        case: name,
        status,
      }));
    } else {
      setPhase('exportMs');
      await command(
        'expo-export',
        process.execPath,
        [
          path.join(
            frontend,
            'node_modules/expo/node_modules/@expo/cli/build/bin/cli',
          ),
          'export',
          '--platform',
          'web',
          '--max-workers',
          '1',
          '--output-dir',
          path.join(root, 'dist'),
        ],
        {
          EXPO_NO_DOTENV: '1',
          EXPO_OFFLINE: '1',
          EXPO_NO_TELEMETRY: '1',
          CI: '1',
          EXPO_PUBLIC_API_URL: 'http://127.0.0.1:4178/api',
          NODE_PATH: path.join(frontend, 'node_modules'),
        },
        180000,
        path.join(frontend, 'tests/browser/u4'),
      );
      const output = [];
      const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          e.isDirectory()
            ? walk(p)
            : output.push({
                path: path.relative(root, p).replaceAll(path.sep, '/'),
                sha256: hash(p),
              });
        }
      };
      walk(path.join(root, 'dist'));
      write('export-manifest', {
        officialInstalledExpo: true,
        sourceManifestSha256: proof.sourceManifestSha256,
        files: output,
      });
      integrity(frozen);
      await webStart();
      setPhase('goalsMs');
      await command(
        ['U5B', 'U5R'].includes(selected) ? 'u5-browser' : 'a8-browser',
        process.execPath,
        [
          path.join(frontend, 'node_modules/@playwright/test/cli.js'),
          'test',
          '--config',
          path.join(__dirname, 'browser.config.cjs'),
          '--workers',
          '1',
          '--retries',
          '0',
        ],
        dbEnv,
        130000,
      );
      proof.requestCounts = counts;
      if (['U5B', 'U5R'].includes(selected)) {
        const result = JSON.parse(
          fs.readFileSync(path.join(root, 'u5-browser-proof.json'), 'utf8'),
        );
        assert.equal(result.status, 'PASS');
        proof.cases = result.cases;
      }
    }
    cancellation.check();
    proof.status = 'completed';
  } catch (error) {
    primaryFailed = true;
    primaryFailure = error;
  }
  // Preserve primary failures and attempt every cleanup/readback independently.
  cancellation.beginCleanup();
  if (cancellation.cancelled) proof.status = 'cancelled';
  proof.requestCounts = { ...counts };
  await settleCleanup([
    async () => {
      if (primaryFailed) throw primaryFailure;
    },
    async () => {
      if (
        ['U5B', 'U5R'].includes(selected) &&
        fs.existsSync(path.join(root, 'u5-browser-proof.json'))
      ) {
        proof.cases = JSON.parse(
          fs.readFileSync(path.join(root, 'u5-browser-proof.json'), 'utf8'),
        ).cases;
      }
    },
    cleanup,
    async () => {
      if (
        selected === 'C7C8' &&
        fs.existsSync(path.join(root, 'load-proof.json'))
      ) {
        const result = JSON.parse(
          fs.readFileSync(path.join(root, 'load-proof.json'), 'utf8'),
        );
        proof.cases = result.cases.map(({ case: name, status }) => ({
          case: name,
          status,
        }));
      }
    },
    async () => {
      integrity(frozen);
      proof.frozenSourceUnchanged = true;
    },
    async () => {
      if (proof.externalBefore) {
        proof.externalAfter = await external('external-after');
        assert.deepEqual(proof.externalAfter, proof.externalBefore);
        proof.externalUnchanged = true;
      }
    },
    async () => {
      if (selected === 'C6_SQL_ERROR' && proof.status === 'completed')
        validateCleanup(proof);
    },
    async () => {
      if (cancellation.cancelled) throw Error('Owned runtime cancelled');
    },
  ]);
}
main()
  .catch((e) => {
    proof.status = 'failed';
    proof.error = e.message;
    process.exitCode = 1;
  })
  .finally(() => {
    if (fs.existsSync(root)) write('runtime-proof', proof);
    if (binding && process.connected) {
      if (proof.status === 'completed')
        process.send({ schemaVersion: 2, type: 'complete', ...binding });
      process.disconnect();
    }
    console.log(
      JSON.stringify({
        status: proof.status,
        case: selected,
        artifacts: root,
        error: proof.error,
        cleanup: proof.cleanup,
      }),
    );
  });
