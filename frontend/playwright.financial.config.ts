import { defineConfig } from "@playwright/test";
if (!process.env.FINANCIAL_WEB_URL || !process.env.FINANCIAL_ARTIFACTS)
  throw new Error("Owned financial supervisor configuration required");
export default defineConfig({
  testDir: "./tests/financial",
  testMatch: "categories.spec.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60000,
  globalTimeout: 150000,
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: process.env.FINANCIAL_ARTIFACTS + "/browser-report.json" },
    ],
  ],
  outputDir: process.env.FINANCIAL_ARTIFACTS + "/browser-results",
  use: {
    baseURL: process.env.FINANCIAL_WEB_URL,
    browserName: "chromium",
    channel: "msedge",
    headless: true,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
