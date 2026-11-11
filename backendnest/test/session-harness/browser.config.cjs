const path = require('node:path');
const { defineConfig } = require(
  path.resolve(__dirname, '../../../frontend/node_modules/@playwright/test'),
);
const root = process.env.SESSION_HARNESS_ARTIFACTS;
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ['U5B', 'U5R'].includes(process.env.SESSION_HARNESS_CASE)
    ? 'u5-browser.spec.ts'
    : 'a8.spec.ts',
  workers: 1,
  retries: 0,
  grep:
    process.env.SESSION_HARNESS_CASE === 'U5R'
      ? /U5 offline pre-send and actual post-commit response loss hide private content without replay$/
      : undefined,
  maxFailures: ['U5B', 'U5R'].includes(process.env.SESSION_HARNESS_CASE)
    ? 1
    : undefined,
  fullyParallel: false,
  timeout: 90000,
  globalTimeout: 120000,
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(root, 'browser-report.json') }],
  ],
  outputDir: path.join(root, 'browser-results'),
  use: {
    baseURL: 'http://127.0.0.1:4178',
    browserName: 'chromium',
    channel: 'msedge',
    headless: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
