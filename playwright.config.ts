import { defineConfig } from "@playwright/test";

const isCI = Boolean(process.env.CI);

/**
 * Locally, the site under test must use the `disease_observer_test`
 * database (see `pnpm test:e2e:db`), never the development one. This points
 * the server at it, using the server and login from `.env.local`. In CI the
 * workflow sets the database variables itself.
 */
function localTestDatabaseEnv(): Record<string, string> {
  if (isCI) return {};
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local file: the site runs without a database.
  }
  const configured = process.env.DATABASE_URL;
  if (!configured) return {};
  const url = new URL(configured);
  if (!["localhost", "127.0.0.1", "db"].includes(url.hostname)) {
    throw new Error(
      `The end-to-end tests only run against a local database, but DATABASE_URL uses "${url.hostname}".`,
    );
  }
  url.pathname = "/disease_observer_test";
  return { DATABASE_URL: url.toString(), DATABASE_URL_UNPOOLED: url.toString() };
}

const testDatabaseEnv = localTestDatabaseEnv();

/**
 * End-to-end test setup. The site is started automatically from a
 * production build: `pnpm build && pnpm start` locally, and `pnpm start` in
 * CI (the job builds first). Set CHROMIUM_PATH
 * to use a system Chromium instead of Playwright's own download.
 */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  // Locally, two tests at a time. The default (half the cores, 6 here) made
  // this sandbox's load average pass 20, and the map tests, which wait for
  // WebGL to draw, then timed out at random. Three still let the load reach
  // about 16 (even with no leftover processes) and the timeouts came back, so
  // two is what is reliable here. CI keeps Playwright's default.
  workers: isCI ? undefined : 2,
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
    // The tests run against a production build, as the live site does. The dev
    // server compiles each page on its first visit, which made tests time out
    // at random. CI has built the site already in an earlier step.
    command: isCI ? "pnpm start" : "pnpm build && pnpm start",
    url: "http://localhost:3000",
    // A server that is already running might use the development database,
    // so it is only reused when the tests do not point it at the test one.
    reuseExistingServer: !isCI && Object.keys(testDatabaseEnv).length === 0,
    // ERROR_PAGE_TEST turns on /error-test, which fails on purpose so the error
    // page can be tested. Without it (the live site) that address is a 404.
    env: { ...testDatabaseEnv, ERROR_PAGE_TEST: "1" },
    // Locally, this includes the build.
    timeout: isCI ? 120_000 : 300_000,
  },
});
