import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests/browser', testMatch: 'session-contexts.spec.ts', fullyParallel: false, workers: 1, retries: 0,
    timeout: 30000, globalTimeout: 210000, reporter: [['list'], ['json', { outputFile: '../.tmp/stage2-u3-expo-browser/browser-report.json' }]], outputDir: '../.tmp/stage2-u3-expo-browser/browser-results',
    use: {
        baseURL: 'http://127.0.0.1:4177', browserName: 'chromium', channel: 'msedge', headless: true,
        trace: 'off', screenshot: 'off', video: 'off'
    },
    webServer: {
        command: 'node tests/browser/session-server.cjs', url: 'http://127.0.0.1:4177/__health',
        reuseExistingServer: false, timeout: 120000, env: { EXPO_NO_DOTENV: '1' }
    },
});
