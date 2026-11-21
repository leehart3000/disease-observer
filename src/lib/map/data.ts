/**
 * Loads the values for the map page: the latest COVID-19 rate by local
 * authority, the latest complete week of measles cases by region, and the
 * credits for the data sources.
 *
 * Server-side only. Nothing here may run at build time, because the build
 * has no database: callers wait for a real request first (`connection()`).
 */
import "server-only";
import { cacheLife } from "next/cache";
import { inArray, sql } from "drizzle-orm";
import { getDb, type Database } from "@/db";
import { sources } from "@/db/schema";
import type { AreaValue, MapData, MapDataset, SourceCredit } from "./types";

/** How long to wait for each attempt to load data. Allows for Neon waking from sleep. */
const ATTEMPT_TIMEOUT_MS = 8_000;

/** Thrown when the database has no values for either layer yet. */
class NoMapDataError extends Error {
  constructor() {
    super("The database has no map data yet");
    this.name = "NoMapDataError";
  }
}

type LatestQuery = {
  diseaseSlug: string;
  metric: string;
  areaLevel: "lower_tier_local_authority" | "region";
  periodType: "day" | "week";
  /** Only use periods that have already ended. */
  completeOnly: boolean;
};

type Row = {
  code: string;
  name: string;
  value: number;
  provisional: boolean;
  period_start: string;
  period_end: string;
};

/**
 * Finds the latest period (optionally the latest one that has ended) that
 * UKHSA has values for, and returns every area's value for it.
 *
 * @returns `null` if there are no values at all.
 */
async function queryLatest(db: Database, query: LatestQuery): Promise<MapDataset | null> {
  const ended = query.completeOnly ? sql`and o.period_end < current_date` : sql``;
  const result = await db.execute<Row>(sql`
    with matching as (
      select o.*
      from observations o
      join diseases d on d.id = o.disease_id
      join sources s on s.id = o.source_id
      where d.slug = ${query.diseaseSlug}
        and s.slug = 'ukhsa'
        and o.metric = ${query.metric}
        and o.stratum = 'all'
        and o.period_type = ${query.periodType}
        ${ended}
    ), latest as (
      select max(period_start) as period_start from matching
    )
    select a.code, a.name, m.value, m.provisional,
           m.period_start::text as period_start, m.period_end::text as period_end
    from latest l
    join matching m on m.period_start = l.period_start
    join areas a on a.id = m.area_id
    where a.code_scheme = 'ons' and a.level = ${query.areaLevel}
    order by a.name`);

  const rows = result.rows;
  if (rows.length === 0) return null;
  const values: AreaValue[] = rows.map((row) => ({
    code: row.code,
    name: row.name,
    value: Number(row.value),
    provisional: row.provisional,
  }));
  return { periodStart: rows[0].period_start, periodEnd: rows[0].period_end, values };
}

/** Reads the credit and licence for the sources whose data is on the map. */
async function querySources(db: Database): Promise<SourceCredit[]> {
  const rows = await db
    .select()
    .from(sources)
    .where(inArray(sources.slug, ["ukhsa", "ons-geography"]));
  // UKHSA first, then ONS, whatever order the database returns.
  return ["ukhsa", "ons-geography"].flatMap((slug) =>
    rows
      .filter((row) => row.slug === slug)
      .map(({ slug, name, url, licenceName, licenceUrl, attribution }) => ({
        slug,
        name,
        url,
        licenceName,
        licenceUrl,
        attribution,
      })),
  );
}

/**
 * Queries the database for everything the map page needs. No caching.
 *
 * @throws On any database error, so a failure is never cached.
 * @throws {NoMapDataError} If neither layer has values yet, so an empty
 *   result is not cached for a day.
 */
export async function queryMapData(): Promise<MapData> {
  const db = getDb();
  const [covid, measles, creditRows] = await Promise.all([
    queryLatest(db, {
      diseaseSlug: "covid-19",
      metric: "rate_per_100k",
      areaLevel: "lower_tier_local_authority",
      periodType: "week",
      completeOnly: false,
    }),
    queryLatest(db, {
      diseaseSlug: "measles",
      metric: "cases",
      areaLevel: "region",
      periodType: "week",
      completeOnly: true,
    }),
    querySources(db),
  ]);
  if (!covid && !measles) throw new NoMapDataError();
  return { covid, measles, sources: creditRows };
}

/**
 * The same data, from the shared runtime cache. The data only changes
 * weekly, so it is refreshed in the background once a day: new figures
 * appear on the map within about a day of the ETL.
 */
async function getCachedMapData(): Promise<MapData> {
  "use cache: remote";
  cacheLife("days");
  return queryMapData();
}

/** Rejects if `promise` has not settled after `ms` milliseconds. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function isNoDataError(error: unknown): boolean {
  return error instanceof Error && error.name === "NoMapDataError";
}

/** The outcome of loading the map data. Errors are logged here, never passed on. */
export type LoadResult =
  | { status: "ok"; data: MapData }
  | { status: "empty" }
  | { status: "error" };

/**
 * Loads the map data without ever throwing.
 *
 * It tries the cache first. If the cache fails or is too slow (for
 * example, if the host's runtime cache has been paused), it queries the
 * database directly. Only if that also fails does it report an error.
 * Error details go to the server log and nowhere else.
 */
export async function loadMapData(): Promise<LoadResult> {
  try {
    return { status: "ok", data: await withTimeout(getCachedMapData(), ATTEMPT_TIMEOUT_MS) };
  } catch (error) {
    if (!isNoDataError(error)) {
      console.error("Map data: cache path failed, querying directly", error);
    }
  }
  try {
    return { status: "ok", data: await withTimeout(queryMapData(), ATTEMPT_TIMEOUT_MS) };
  } catch (error) {
    if (isNoDataError(error)) return { status: "empty" };
    console.error("Map data: direct query failed", error);
    return { status: "error" };
  }
}
