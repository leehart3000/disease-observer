/**
 * Prepares the local database that the end-to-end tests use. It creates
 * `disease_observer_test` in the local database server if it is missing,
 * then runs the migrations, the seed, the boundary loader and the fixture
 * loader against it. Safe to run more than once.
 *
 * The test database is a different database on the same server as your
 * development one, so the tests never touch your development data. The
 * server is found from `DATABASE_URL_UNPOOLED` in `.env.local`, and it must
 * be a local one (`localhost`, `127.0.0.1` or `db`).
 *
 * Run with `pnpm test:e2e:db`.
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`.
 */
import { execFileSync } from "node:child_process";
import pg from "pg";
import { assertTestDatabase, TEST_DATABASE_NAME } from "./load.mts";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local file: use the real environment.
}

const developmentUrl = process.env.DATABASE_URL_UNPOOLED;
if (!developmentUrl) throw new Error("DATABASE_URL_UNPOOLED is not set");

/** The same server and login, with a different database name. */
function withDatabase(connectionString: string, name: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${name}`;
  return url.toString();
}

const testUrl = assertTestDatabase(withDatabase(developmentUrl, TEST_DATABASE_NAME));

// Create the database, using the server's maintenance database to connect.
const admin = new pg.Client({ connectionString: withDatabase(developmentUrl, "postgres") });
await admin.connect();
try {
  const existing = await admin.query("select 1 from pg_database where datname = $1", [
    TEST_DATABASE_NAME,
  ]);
  if (existing.rowCount === 0) {
    // The name is a constant that was checked above, and CREATE DATABASE
    // cannot take a parameter.
    await admin.query(`create database ${TEST_DATABASE_NAME}`);
    console.log(`Created the database ${TEST_DATABASE_NAME}.`);
  } else {
    console.log(`The database ${TEST_DATABASE_NAME} already exists.`);
  }
} finally {
  await admin.end();
}

// Run each step against the test database only.
const env = { ...process.env, DATABASE_URL: testUrl, DATABASE_URL_UNPOOLED: testUrl };
for (const script of ["db:migrate", "db:seed", "db:boundaries", "e2e:fixtures"]) {
  console.log(`\n> pnpm ${script}`);
  execFileSync("pnpm", [script], { stdio: "inherit", env });
}
console.log(`\nThe test database is ready. Run: pnpm test:e2e`);
