import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "../../test-results/launcher",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4187",
    channel: process.env.CI ? undefined : "msedge",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  webServer: {
    command: "pnpm launcher:dev --mode fixture",
    url: "http://127.0.0.1:4187",
    reuseExistingServer: false,
    timeout: 120000,
    env: { VITE_LAUNCHER_FIXTURE: "1" },
  },
});
