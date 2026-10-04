import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backendRoot = resolve(__dirname, '..');
const { scripts } = JSON.parse(
  readFileSync(resolve(backendRoot, 'package.json'), 'utf8'),
) as { scripts: Record<string, string> };
const workflow = readFileSync(
  resolve(backendRoot, '../.github/workflows/ci.yml'),
  'utf8',
);
const backendJob = workflow
  .split('\n  backend:')[1]
  .split('\n  backend-e2e:')[0];

describe('Backend verification scripts', () => {
  it('checks runtime lint with the existing CI scope and warning policy', () => {
    expect(scripts['lint:check']).toBe(
      'eslint "src/**/*.ts" --ignore-pattern "**/*.spec.ts" ' +
        '--rule "@typescript-eslint/no-unsafe-assignment: warn" ' +
        '--rule "@typescript-eslint/no-unsafe-call: warn" ' +
        '--rule "@typescript-eslint/no-unsafe-member-access: warn"',
    );
  });

  it('checks production types without emitted files or incremental cache', () => {
    expect(scripts.typecheck).toBe(
      'tsc --noEmit --incremental false -p tsconfig.build.json',
    );
  });

  it('uses the shared commands in the backend CI job', () => {
    expect(backendJob).toMatch(/^\s+run: npm run lint:check\s*$/m);
    expect(backendJob).toMatch(/^\s+run: npm run typecheck\s*$/m);
    expect(backendJob).not.toMatch(/npx (?:eslint|tsc)\b/);
  });

  it('preserves explicit autofix and adds no mutating verification hooks', () => {
    expect(scripts.lint).toBe('eslint "{src,apps,libs,test}/**/*.ts" --fix');
    for (const command of ['lint:check', 'typecheck']) {
      expect(scripts[`pre${command}`]).toBeUndefined();
      expect(scripts[`post${command}`]).toBeUndefined();
    }
  });
});
