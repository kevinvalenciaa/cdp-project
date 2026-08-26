import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  // One retry, because the suite talks to a real server over a real network
  // stack. Not a licence for flaky assertions: the webServer below is a
  // production build precisely so the on-demand-compilation failures that used
  // to sink whole runs cannot happen.
  retries: 1,
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
    // A production build, not `next dev`.
    //
    // Under next dev the suite compiled routes on demand mid-run, which produced
    // hard 500s ("__webpack_modules__[moduleId] is not a function") and aborted
    // navigations after the dev server restarted on a config change. The suite
    // meant to prove the happy path was failing for reasons that had nothing to
    // do with the app. LIFT_PUBLIC_DEMO is required because `next start` sets
    // NODE_ENV=production, where serving anonymously must be opted into.
    command:
      "LIFT_PUBLIC_DEMO=true LIFT_INVESTIGATION_STATE_PATH=../../.context/e2e-investigations-state.json pnpm exec next start -H 127.0.0.1 -p 3011",
    url: "http://127.0.0.1:3011/api/health",
    timeout: 180_000,
    reuseExistingServer: false,
  },
  globalSetup: "./e2e/global-setup.ts",
});
