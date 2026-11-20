/**
 * Builds a database client from a connection string.
 *
 * This file does not import `server-only`, so plain Node scripts (the seed
 * and the ETL) can use it. App code (route handlers, server components)
 * must use `getDb` from `@/db` instead. An ESLint rule enforces this.
 *
 * It uses relative imports with `.ts` extensions, because Node scripts
 * cannot resolve the `@/` alias.
 */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema.ts";

/** The typed Drizzle client for this project's schema. */
export type Database = NodePgDatabase<typeof schema>;

/**
 * Creates a connection pool and a Drizzle client that uses it.
 *
 * Nothing connects until the first query. Callers that create a pool
 * themselves, such as scripts, must call `pool.end()` when they finish so
 * that the process can exit.
 *
 * @param url - The Postgres connection string.
 * @param poolOptions - Extra `pg` pool settings, for example `max`.
 * @throws If `url` is empty or not set.
 */
export function createDb(
  url: string | undefined,
  poolOptions: Omit<PoolConfig, "connectionString"> = {},
): { db: Database; pool: Pool } {
  if (!url) {
    throw new Error("The database connection string is not set");
  }
  const pool = new Pool({ ...poolOptions, connectionString: url });
  // An idle client can be dropped by the server. Without a listener, the
  // pool's "error" event would be thrown and crash the process.
  pool.on("error", (error) => {
    console.error("Unexpected error on an idle database connection:", error);
  });
  return { db: drizzle({ client: pool, schema }), pool };
}
