const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const localDataRoot =
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const tempRoot = path.join(localDataRoot, 'meu-sistema-financeiro', 'frontend');
const cacheRoot = path.join(tempRoot, 'metro-cache');
const tmpRoot = path.join(tempRoot, 'tmp');

fs.mkdirSync(cacheRoot, { recursive: true });
fs.mkdirSync(tmpRoot, { recursive: true });

const passthroughArgs = process.argv.slice(2);
const args = ['expo', 'start'];

if (passthroughArgs.length > 0) {
  args.push(...passthroughArgs);
}

if (!args.includes('--offline')) {
  args.push('--offline');
}

if (!args.includes('--clear') && !args.includes('-c')) {
  args.push('--clear');
}

if (!args.includes('--max-workers')) {
  args.push('--max-workers', '1');
}

console.log(`Expo temp/cache root: ${tempRoot}`);

const child = spawn(
  process.execPath,
  [path.join(projectRoot, 'node_modules', 'expo', 'bin', 'cli'), ...args.slice(1)],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      EXPO_NO_TELEMETRY: '1',
      BROWSER: 'none',
      TMP: tmpRoot,
      TEMP: tmpRoot,
      TMPDIR: tmpRoot,
      METRO_CACHE_DIR: cacheRoot,
    },
    stdio: 'inherit',
  },
);

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code || 0);
});
