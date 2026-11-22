/**
 * The values for the map: every area's value for the latest period of a
 * dataset, from the registry. Server-side only.
 *
 * Nothing here may run at build time, because the build has no database:
 * callers wait for a real request first (`connection()`).
 */
import "server-only";
import { sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { getDb } from "@/db";
import { getDataset } from "@/lib/datasets/registry";
import type { DatasetDef, PeriodChoice } from "@/lib/datasets/types";
import type { AreaValue, MapDataset } from "@/lib/map/types";
import { loadWithFallback, NoDataError, type LoadResult } from "./load";

type Row = {
  code: string;
  name: string;
  value: number;
  provisional: boolean;
  weeks: number;
  weeks_expected: number;
  period_start: string;
  period_end: string;
};

/** How many days before the latest week's start the last 12 weeks begin (11 weeks). */
const TWELVE_WEEKS_BACK_DAYS = 77;

/**
 * Finds the latest period that the data source has values for (the latest
 * one that has ended, if the dataset asks for that) and returns every
 * area's value for the chosen period. Not cached.
 *
 * - `latest`: the latest week (or, for a rate, the latest 7 days).
 * - `12w`: the 12 weeks ending at the latest week, added up.
 * - `ytd`: the weeks that start in the same calendar year as the latest
 *   week's start, added up.
 *
 * It is one query for all three: the window starts at the latest week, 77
 * days before it, or the start of its year. A total is provisional if any
 * week in it is. An area with no row for some week in the window (the
 * source may leave out a week with no cases) is added up from the weeks it
 * has, and says how many that was, so the page can say "11 of 12 weeks
 * reported". Only the latest period is offered for rates, which cannot be
 * added together.
 *
 * @throws {NoDataError} If there are no values at all, so an empty result
 *   is not cached for a day.
 * @throws On any database error, so a failure is never cached.
 */
export async function queryMapValues(
  dataset: DatasetDef,
  period: PeriodChoice,
): Promise<MapDataset> {
  const sourceSlug = dataset.sourceSlugs[0];
  const ended = dataset.completePeriodsOnly ? sql`and o.period_end < current_date` : sql``;
  // Chosen from a fixed list, never built from the request.
  const windowStart =
    period === "12w"
      ? sql`l.period_start - ${TWELVE_WEEKS_BACK_DAYS}::int`
      : period === "ytd"
        ? sql`date_trunc('year', l.period_start)::date`
        : sql`l.period_start`;
  const result = await getDb().execute<Row>(sql`
    with matching as (
      select o.*
      from observations o
      join diseases d on d.id = o.disease_id
      join sources s on s.id = o.source_id
      where d.slug = ${dataset.diseaseSlug}
        and s.slug = ${sourceSlug}
        and o.metric = ${dataset.metric}
        and o.stratum = 'all'
        and o.period_type = ${dataset.periodType}
        ${ended}
    ), latest as (
      select max(period_start) as period_start from matching
    ), windowed as (
      select m.area_id, m.value, m.provisional, m.period_start, m.period_end
      from latest l
      join matching m on m.period_start between ${windowStart} and l.period_start
    ), in_window as (
      select a.code, a.name, w.value, w.provisional, w.period_start, w.period_end
      from windowed w
      join areas a on a.id = w.area_id
      where a.code_scheme = 'ons' and a.level = ${dataset.map.areaLevel}
    ), weeks as (
      select count(distinct period_start)::int as expected from in_window
    )
    select code, name,
           sum(value) as value,
           bool_or(provisional) as provisional,
           count(*)::int as weeks,
           (select expected from weeks) as weeks_expected,
           min(period_start)::text as period_start,
           max(period_end)::text as period_end
    from in_window
    group by code, name
    order by name`);

  const rows = result.rows;
  if (rows.length === 0) throw new NoDataError(dataset.id);
  const values: AreaValue[] = rows.map((row) => ({
    code: row.code,
    name: row.name,
    value: Number(row.value),
    provisional: row.provisional,
    weeks: Number(row.weeks),
  }));
  return {
    period,
    weeksExpected: Number(rows[0].weeks_expected),
    // The whole period, from the first week that any area has to the last.
    periodStart: rows.map((row) => row.period_start).sort()[0],
    periodEnd: rows.map((row) => row.period_end).sort().at(-1) as string,
    values,
  };
}

/**
 * The same values, from the shared runtime cache. The data only changes
 * weekly, so it is refreshed in the background once a day: new figures
 * appear on the map within about a day of the ETL.
 *
 * Both arguments are strings, so they are the cache key. Callers must only
 * pass values that were checked against the registry (see
 * `parseMapSelection`), so the number of entries stays small.
 */
async function getCachedMapValues(datasetId: string, period: string): Promise<MapDataset> {
  "use cache: remote";
  cacheLife("days");
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error(`Unknown dataset ${datasetId}`);
  return queryMapValues(dataset, period as PeriodChoice);
}

/**
 * Loads the map values without ever throwing: from the cache, else from the
 * database, else as an "error" or "empty" result.
 */
export function loadMapValues(
  dataset: DatasetDef,
  period: PeriodChoice,
): Promise<LoadResult<MapDataset>> {
  return loadWithFallback(
    "Map data",
    () => getCachedMapValues(dataset.id, period),
    () => queryMapValues(dataset, period),
  );
}
