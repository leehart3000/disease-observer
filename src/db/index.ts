/**
 * Database client for server-side app code only (route handlers and server
 * components). Never import it from a client component.
 *
 * Scripts that run outside Next.js cannot import this file, because
 * `server-only` throws there. They use `createDb` from `./client.ts`.
 *
 * The pool is created on first use, so importing this file (for example
 * during `next build`) never connects to anything.
 */
import "server-only";
import { createDb, type Database } from "./client";

export type { Database };

const globalForDb = globalThis as unknown as { diseaseObserverDb?: Database };

/**
 * Returns the shared database client, creating it on first use.
 *
 * Connects with `DATABASE_URL` (the pooled URL in production). The pool is
 * set up for serverless: few connections, a short idle timeout and no
 * session state (no `SET`, advisory locks or temporary tables), because
 * Neon's pooler runs in transaction mode.
 *
 * @throws If `DATABASE_URL` is not set.
 */
export function getDb(): Database {
  if (!globalForDb.diseaseObserverDb) {
    globalForDb.diseaseObserverDb = createDb(process.env.DATABASE_URL, {
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    }).db;
  }
  return globalForDb.diseaseObserverDb;
}
