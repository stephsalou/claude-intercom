import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  snapshotPathTemplate: "{testDir}/golden/{arg}{ext}",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: [
    {
      command: "npx serve -l 4173 ../front-end",
      port: 4173,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "npm run build && npm run start -- -p 4174",
      port: 4174,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
