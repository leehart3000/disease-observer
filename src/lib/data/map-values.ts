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
  period_start: string;
  period_end: string;
};

/**
 * Finds the latest period that the data source has values for (the latest
 * one that has ended, if the dataset asks for that) and returns every
 * area's value for it. Not cached.
 *
 * @throws {NoDataError} If there are no values at all, so an empty result
 *   is not cached for a day.
 * @throws On any database error, so a failure is never cached.
 */
export async function queryMapValues(
  dataset: DatasetDef,
  period: PeriodChoice,
): Promise<MapDataset> {
  // Only the latest period is offered so far.
  if (period !== "latest") throw new Error(`The period "${period}" is not supported yet`);
  const sourceSlug = dataset.sourceSlugs[0];
  const ended = dataset.completePeriodsOnly ? sql`and o.period_end < current_date` : sql``;
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
    )
    select a.code, a.name, m.value, m.provisional,
           m.period_start::text as period_start, m.period_end::text as period_end
    from latest l
    join matching m on m.period_start = l.period_start
    join areas a on a.id = m.area_id
    where a.code_scheme = 'ons' and a.level = ${dataset.map.areaLevel}
    order by a.name`);

  const rows = result.rows;
  if (rows.length === 0) throw new NoDataError(dataset.id);
  const values: AreaValue[] = rows.map((row) => ({
    code: row.code,
    name: row.name,
    value: Number(row.value),
    provisional: row.provisional,
  }));
  return { periodStart: rows[0].period_start, periodEnd: rows[0].period_end, values };
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
