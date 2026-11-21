/**
 * Loading data for pages: try the cache, fall back to the database, and
 * report a failure as a result instead of throwing. Server-side only.
 */
import "server-only";

/** How long to wait for each attempt. Allows for Neon waking from sleep. */
const ATTEMPT_TIMEOUT_MS = 8_000;

/** Thrown by a query when the database has no data for what was asked. */
export class NoDataError extends Error {
  constructor(what: string) {
    super(`No data yet: ${what}`);
    this.name = "NoDataError";
  }
}

/** The outcome of loading data. Errors are logged here, never passed on. */
export type LoadResult<T> =
  | { status: "ok"; data: T }
  | { status: "empty" }
  | { status: "error" };

/** Rejects if `promise` has not settled after `ms` milliseconds. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function isNoDataError(error: unknown): boolean {
  return error instanceof Error && error.name === "NoDataError";
}

/**
 * Loads data without ever throwing.
 *
 * It tries the cached function first. If the cache fails or is too slow
 * (for example, if the host's runtime cache has been paused), it runs the
 * query directly. Only if that also fails does it report an error. Error
 * details go to the server log and nowhere else.
 *
 * @param label - Names the data in log messages, such as "Map data".
 * @param cached - Reads the data through the cache.
 * @param direct - Reads the data straight from the database.
 */
export async function loadWithFallback<T>(
  label: string,
  cached: () => Promise<T>,
  direct: () => Promise<T>,
): Promise<LoadResult<T>> {
  try {
    return { status: "ok", data: await withTimeout(cached(), ATTEMPT_TIMEOUT_MS) };
  } catch (error) {
    // An error thrown inside a cached function loses its type, so "no data"
    // is also found by the direct query below.
    if (!isNoDataError(error)) {
      console.error(`${label}: cache path failed, querying directly`, error);
    }
  }
  try {
    return { status: "ok", data: await withTimeout(direct(), ATTEMPT_TIMEOUT_MS) };
  } catch (error) {
    if (isNoDataError(error)) return { status: "empty" };
    console.error(`${label}: direct query failed`, error);
    return { status: "error" };
  }
}
