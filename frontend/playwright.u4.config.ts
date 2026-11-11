import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser/u4', testMatch: 'integrated.spec.ts',
  fullyParallel: false, workers: 1, retries: 0, timeout: 45000, globalTimeout: 360000,
  reporter: [['list'], ['json', { outputFile: '../.tmp/stage2-u4-browser-20261011-bounded1/browser-report.json' }]],
  outputDir: '../.tmp/stage2-u4-browser-20261011-bounded1/browser-results',
  use: { baseURL: 'http://127.0.0.1:4178', browserName: 'chromium', channel: 'msedge', headless: true,
    trace: 'off', screenshot: 'off', video: 'off' },
});
