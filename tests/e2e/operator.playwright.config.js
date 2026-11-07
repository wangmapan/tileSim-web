import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "operator-authoring.spec.js",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  outputDir: "../../test-results/operator",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4185",
    headless: true,
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
    launchOptions: { executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" },
    screenshot: "only-on-failure",
  },
});
