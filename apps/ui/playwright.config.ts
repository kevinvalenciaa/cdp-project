import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  outputDir: "../../.context/playwright-results",
  expect: { timeout: 12_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3011",
    browserName: "chromium",
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command:
      "LIFT_INVESTIGATION_STATE_PATH=../../.context/e2e-investigations-state.json pnpm exec next dev -H 127.0.0.1 -p 3011",
    url: "http://127.0.0.1:3011/api/health",
    timeout: 120_000,
    reuseExistingServer: false,
  },
  globalSetup: "./e2e/global-setup.ts",
});
