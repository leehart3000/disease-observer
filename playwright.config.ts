import { defineConfig } from "@playwright/test";

const isCI = Boolean(process.env.CI);

/**
 * End-to-end test setup. The site is started automatically: `pnpm dev`
 * locally, and `pnpm start` in CI (run `pnpm build` first). Set CHROMIUM_PATH
 * to use a system Chromium instead of Playwright's own download.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    colorScheme: "light",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
    },
  },
  projects: [
    {
      name: "desktop",
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      // iPhone SE size. Chromium is used here, not WebKit.
      name: "iphone-se",
      use: {
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: isCI ? "pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
