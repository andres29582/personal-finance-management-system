const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const localDataRoot =
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const devRoot = path.join(localDataRoot, 'meu-sistema-financeiro', 'backendnest');
const outDir = path.join(devRoot, 'dist');
const generatedTsconfig = path.join(projectRoot, 'tsconfig.onedrive-safe.json');

fs.mkdirSync(devRoot, { recursive: true });

const toTsPath = (value) => value.replace(/\\/g, '/');

const generatedTsconfigContent = `${JSON.stringify(
  {
    extends: './tsconfig.build.json',
    compilerOptions: {
      outDir: toTsPath(outDir),
      incremental: false,
    },
    exclude: ['node_modules', 'test', 'dist', '.dev-dist', '**/*spec.ts'],
  },
  null,
  2,
)}\n`;

if (
  !fs.existsSync(generatedTsconfig) ||
  fs.readFileSync(generatedTsconfig, 'utf8') !== generatedTsconfigContent
) {
  fs.writeFileSync(generatedTsconfig, generatedTsconfigContent);
}

console.log(`Nest dev output: ${outDir}`);

const nestBin = path.join(projectRoot, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
const child = spawn(
  process.execPath,
  [nestBin, 'start', '--watch', '--path', path.basename(generatedTsconfig)],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_PATH: path.join(projectRoot, 'node_modules'),
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
