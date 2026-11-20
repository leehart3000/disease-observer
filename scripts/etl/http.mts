/**
 * A small HTTP client for ETL scripts: requests go one at a time with a
 * pause between them, and failures that are likely to be temporary are
 * retried with a growing wait (about 5 s, 15 s, then 45 s) and some jitter.
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`, so
 * Node can run it directly.
 */

/** Sent with every request so that data providers can see who is calling. */
export const USER_AGENT = "disease-observer-etl/0.1 (+https://disease.observer)";

/** The server answered 404, which the caller may treat as "no such data". */
export class NotFoundError extends Error {
  constructor(url: string) {
    super(`Not found: ${url}`);
    this.name = "NotFoundError";
  }
}

/** The server answered with a status that is not worth retrying. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status}: ${url}`);
    this.name = "HttpError";
    this.status = status;
  }
}

/** Settings for {@link createHttpClient}. */
export type HttpClientOptions = {
  /** Least time between the starts of two requests. Default 500. */
  minIntervalMs?: number;
  /** Tries per request, including the first. Default 4. */
  maxAttempts?: number;
  /**
   * Wait before the second try, tripled for each later one (so about 5 s,
   * 15 s and 45 s by default), plus a little jitter. Default 5000.
   */
  baseDelayMs?: number;
  /** Longest wait the server can ask for with `Retry-After`. Default 60000. */
  maxRetryAfterMs?: number;
  /** How long to wait for one response. Default 30000. */
  timeoutMs?: number;
  /** Returns a number from 0 up to (not including) 1. Default `Math.random`. */
  random?: () => number;
};

/** The most jitter added to a wait, as a share of the wait. */
const MAX_JITTER_SHARE = 0.1;

/**
 * Works out how long to wait before the next try: the backoff for this
 * attempt plus up to 10% jitter. If the server sent `Retry-After`, wait at
 * least that long, but no more than `maxRetryAfterMs`.
 *
 * @param attempt - The try that just failed, counting from 1.
 */
export function retryDelayMs(
  attempt: number,
  retryAfterMs: number | undefined,
  options: Pick<HttpClientOptions, "baseDelayMs" | "maxRetryAfterMs" | "random"> = {},
): number {
  const baseDelayMs = options.baseDelayMs ?? 5000;
  const maxRetryAfterMs = options.maxRetryAfterMs ?? 60_000;
  const random = options.random ?? Math.random;
  const backoff = baseDelayMs * 3 ** (attempt - 1);
  const wait = backoff + random() * MAX_JITTER_SHARE * backoff;
  return Math.min(Math.max(wait, retryAfterMs ?? 0), Math.max(wait, maxRetryAfterMs));
}

/** A client that fetches JSON politely. */
export type HttpClient = {
  /**
   * Fetches a URL and returns the parsed JSON.
   *
   * @throws {NotFoundError} On a 404, without retrying.
   * @throws {HttpError} On other 4xx statuses, without retrying.
   * @throws {Error} When every try failed on a network error, a 429 or a 5xx.
   */
  getJson(url: string): Promise<unknown>;
  /** The number of HTTP requests made so far, including retries. */
  requestCount(): number;
};

type Attempt =
  | { kind: "ok"; body: unknown }
  | { kind: "retry"; reason: string; retryAfterMs?: number };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reads a `Retry-After` header, which is either a number of seconds or an
 * HTTP date. Returns milliseconds, or undefined if it is missing or invalid.
 */
export function parseRetryAfter(
  value: string | null,
  now: number = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - now);
}

/**
 * Creates an HTTP client. Requests are sequential if the caller awaits each
 * one, and the client also keeps `minIntervalMs` between request starts.
 */
export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const minIntervalMs = options.minIntervalMs ?? 500;
  const maxAttempts = options.maxAttempts ?? 4;
  const timeoutMs = options.timeoutMs ?? 30_000;
  let lastStart = 0;
  let requests = 0;

  async function attemptOnce(url: string): Promise<Attempt> {
    const wait = lastStart + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
    requests++;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { kind: "retry", reason: `network error (${message})` };
    }

    if (response.status === 404) throw new NotFoundError(url);
    if (response.status === 429 || response.status >= 500) {
      return {
        kind: "retry",
        reason: `HTTP ${response.status}`,
        retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
      };
    }
    if (!response.ok) throw new HttpError(response.status, url);

    try {
      return { kind: "ok", body: await response.json() };
    } catch {
      return { kind: "retry", reason: "the response was not valid JSON" };
    }
  }

  return {
    async getJson(url) {
      for (let attempt = 1; ; attempt++) {
        const result = await attemptOnce(url);
        if (result.kind === "ok") return result.body;
        if (attempt >= maxAttempts) {
          throw new Error(`Gave up after ${attempt} tries: ${result.reason}: ${url}`);
        }
        const delay = retryDelayMs(attempt, result.retryAfterMs, options);
        console.warn(
          `  Retrying in ${Math.round(delay / 100) / 10} s after ${result.reason} (try ${attempt} of ${maxAttempts})`,
        );
        await sleep(delay);
      }
    },
    requestCount: () => requests,
  };
}
