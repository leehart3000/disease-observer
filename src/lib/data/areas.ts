/**
 * The areas of a dataset that a chart can compare, and one area's weekly
 * series. Server-side only.
 *
 * Nothing here may run at build time, because the build has no database:
 * callers wait for a real request first (`connection()`).
 *
 * Caching is one entry for each area, not for each combination of areas
 * (310 choose 3 is about 5 million), so the cache holds at most about 330
 * small entries. Callers must only pass area codes that were checked
 * against `loadAreaIndex`, so a visitor cannot create unlimited entries.
 */
import "server-only";
import { sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { getDb } from "@/db";
import { getDataset, getDisease } from "@/lib/datasets/registry";
import type { DatasetDef } from "@/lib/datasets/types";
import type { AreaOption, AreaSeries } from "@/lib/series-types";
import { loadWithFallback, NoDataError, type LoadResult } from "./load";

/** The ONS code for England. */
export const ENGLAND_CODE = "E92000001";

/**
 * The areas that have values for a dataset, at the level its map uses,
 * by name. An area with no rows (eleven local authorities have none in the
 * COVID-19 feed) is not listed. Not cached.
 *
 * @throws {NoDataError} If there are no areas, so an empty list is not cached.
 */
export async function queryAreaIndex(dataset: DatasetDef): Promise<AreaOption[]> {
  const result = await getDb().execute<AreaOption>(sql`
    select distinct a.code, a.name
    from observations o
    join diseases d on d.id = o.disease_id
    join sources s on s.id = o.source_id
    join areas a on a.id = o.area_id
    where d.slug = ${dataset.diseaseSlug}
      and s.slug = ${dataset.sourceSlugs[0]}
      and o.metric = ${dataset.metric}
      and o.stratum = 'all'
      and o.period_type = ${dataset.periodType}
      and a.code_scheme = 'ons'
      and a.level = ${dataset.map.areaLevel}
    order by a.name`);
  if (result.rows.length === 0) throw new NoDataError(`areas of ${dataset.id}`);
  return result.rows.map(({ code, name }) => ({ code, name }));
}

type PointRow = {
  name: string;
  level: AreaSeries["level"];
  value: number;
  provisional: boolean;
  period_start: string;
  period_end: string;
};

/**
 * One area's weekly values from the chart's start date (the disease's
 * `chart.since`) to England's latest period. Only periods that end a whole
 * number of weeks before England's latest are kept, so the daily COVID-19
 * rate rows become one point a week, on the same weeks as England's. Not
 * cached.
 *
 * @throws {NoDataError} If England or the area has no values.
 */
export async function queryAreaSeries(dataset: DatasetDef, code: string): Promise<AreaSeries> {
  // The chart starts on the disease's `chart.since`.
  const since = getDisease(dataset.diseaseSlug)?.chart.since;
  if (!since) throw new Error(`Unknown disease ${dataset.diseaseSlug}`);
  const ended = dataset.completePeriodsOnly ? sql`and o.period_end < current_date` : sql``;
  const result = await getDb().execute<PointRow>(sql`
    with latest as (
      select o.period_end
      from observations o
      join diseases d on d.id = o.disease_id
      join sources s on s.id = o.source_id
      join areas a on a.id = o.area_id
      where d.slug = ${dataset.diseaseSlug}
        and s.slug = ${dataset.sourceSlugs[0]}
        and o.metric = ${dataset.metric}
        and o.stratum = 'all'
        and o.period_type = ${dataset.periodType}
        and a.code_scheme = 'ons'
        and a.code = ${ENGLAND_CODE}
        ${ended}
      order by o.period_start desc
      limit 1
    )
    select a.name, a.level, o.value, o.provisional,
           o.period_start::text as period_start, o.period_end::text as period_end
    from latest l
    join observations o on o.period_end <= l.period_end
      and (l.period_end - o.period_end) % 7 = 0
      and o.period_end >= ${since}::date
    join diseases d on d.id = o.disease_id
    join sources s on s.id = o.source_id
    join areas a on a.id = o.area_id
    where d.slug = ${dataset.diseaseSlug}
      and s.slug = ${dataset.sourceSlugs[0]}
      and o.metric = ${dataset.metric}
      and o.stratum = 'all'
      and o.period_type = ${dataset.periodType}
      and a.code_scheme = 'ons'
      and a.code = ${code}
    order by o.period_end`);
  if (result.rows.length === 0) throw new NoDataError(`series of ${code} for ${dataset.id}`);
  return {
    code,
    name: result.rows[0].name,
    level: result.rows[0].level,
    points: result.rows.map((row) => ({
      start: row.period_start,
      end: row.period_end,
      value: Number(row.value),
      provisional: row.provisional,
    })),
  };
}

/** The area index from the shared runtime cache (refreshed about once a day). One entry for each dataset. */
async function getCachedAreaIndex(datasetId: string): Promise<AreaOption[]> {
  "use cache: remote";
  cacheLife("days");
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error(`Unknown dataset ${datasetId}`);
  return queryAreaIndex(dataset);
}

/** One area's series from the shared runtime cache. One entry for each area. */
async function getCachedAreaSeries(datasetId: string, code: string): Promise<AreaSeries> {
  "use cache: remote";
  cacheLife("days");
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error(`Unknown dataset ${datasetId}`);
  return queryAreaSeries(dataset, code);
}

/**
 * Loads the areas that a dataset's chart can compare, without ever
 * throwing: from the cache, else from the database, else as an "error" or
 * "empty" result.
 */
export function loadAreaIndex(dataset: DatasetDef): Promise<LoadResult<AreaOption[]>> {
  return loadWithFallback(
    "Area index",
    () => getCachedAreaIndex(dataset.id),
    () => queryAreaIndex(dataset),
  );
}

/**
 * Loads one area's weekly series without ever throwing. `code` must be
 * England's or one that is in the dataset's area index.
 */
export function loadAreaSeries(dataset: DatasetDef, code: string): Promise<LoadResult<AreaSeries>> {
  return loadWithFallback(
    "Area series",
    () => getCachedAreaSeries(dataset.id, code),
    () => queryAreaSeries(dataset, code),
  );
}
