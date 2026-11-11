const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
// An isolated Expo app avoids production config and private dotenv files.
const frontend = path.resolve(__dirname, '../..');
const output = path.resolve(frontend, '../.tmp/stage2-u3-expo-browser/dist');
const cli = path.join(frontend, 'node_modules/expo/node_modules/@expo/cli/build/bin/cli');
const nonce = randomUUID();
let refreshEffects = 0;
const cases = {};
const server = http.createServer(async (request, response) => {
  if (request.url === '/__health') {
    response.setHeader('Content-Type', 'application/json');
    return response.end(JSON.stringify({ harness: 'u3-official-expo', nonce, pid: process.pid }));
  }
  if (request.url === '/__stats') {
    response.setHeader('Content-Type', 'application/json');
    return response.end(JSON.stringify({ refreshEffects, cases }));
  }
  if (request.url === '/auth/refresh' && request.method === 'POST') {
    // Synthetic post-effect response loss, not a database commit.
    for await (const chunk of request) { if (chunk.length > 16384) { response.destroy(); return; } }
    refreshEffects++;
    const caseId = request.headers['x-u3-case'] ?? 'unidentified';
    const stats = cases[caseId] ??= { effects: 0, responsesStarted: 0 };
    stats.effects++;
    // Begin a response, then lose its body: do not model a pre-header socket rejection.
    response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '4096' });
    response.flushHeaders();
    response.write('{');
    stats.responsesStarted++;
    fs.appendFileSync(path.join(path.dirname(output), 'stub-effects.jsonl'), JSON.stringify({ caseId, requestId: randomUUID(), effect: stats.effects, responseStarted: true }) + '\n');
    setTimeout(() => response.destroy(), 50);
    return;
  }
  const pathname = new URL(request.url, 'http://127.0.0.1:4177').pathname;
  const file = path.resolve(output, '.' + pathname);
  if (!file.startsWith(output + path.sep) && file !== output) { response.writeHead(400); return response.end(); }
  const asset = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(output, 'index.html');
  response.setHeader('Content-Type', asset.endsWith('.js') ? 'text/javascript' : asset.endsWith('.css') ? 'text/css' : 'text/html');
  fs.createReadStream(asset).pipe(response);
});
// Bind before build: occupied ports fail; unknown services are never reused.
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(4177, '127.0.0.1', () => {
  console.log('Isolated Expo export: dotenv disabled, offline, web only.');
  const build = spawnSync(process.execPath, [cli, 'export', '--platform', 'web', '--max-workers', '1', '--output-dir', output], {
    cwd: path.join(__dirname, 'expo'), encoding: 'utf8', maxBuffer: 10485760, timeout: 120000, windowsHide: true,
    env: { ...process.env, EXPO_NO_DOTENV: '1', EXPO_OFFLINE: '1', EXPO_NO_TELEMETRY: '1', EXPO_PUBLIC_API_URL: 'http://127.0.0.1:4177' },
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(path.join(path.dirname(output), 'expo-export.log'), (build.stdout ?? '') + (build.stderr ?? ''));
  if (build.error || build.status !== 0) {
    console.error(build.error?.message ?? 'Expo export exited ' + build.status);
    server.close(() => { process.exitCode = 1; });
  }
});
const stop = () => server.close(() => process.exit(0));
process.on('SIGTERM', stop); process.on('SIGINT', stop);
