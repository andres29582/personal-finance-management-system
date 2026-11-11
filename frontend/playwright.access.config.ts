import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";

const proofFile = process.env.ACCESS_BINDING;
const report = process.env.ACCESS_REPORT;
if (!proofFile || !report)
  throw new Error("Use the confined access browser runner.");
const proof = JSON.parse(readFileSync(proofFile, "utf8")) as {
  scope: string;
  webUrl: string;
  apiUrl: string;
  runId: string;
};
if (
  proof.scope !== "DISPOSABLE_ACCESS_WEB" ||
  ![proof.webUrl, proof.apiUrl].every((url) =>
    /^http:\/\/127\.0\.0\.1:\d{4,5}$/.test(url),
  )
)
  throw new Error("Invalid disposable access binding.");

export default defineConfig({
  testDir: "./tests/access",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: 0,
  timeout: 45000,
  globalTimeout: 480000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["json", { outputFile: report }]],
  outputDir: report + ".results",
  use: {
    baseURL: proof.webUrl,
    browserName: "chromium",
    channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true,
    viewport: { width: 390, height: 844 },
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
