/**
 * A disease's weekly series for the chart: its headline dataset's whole place
 * (England) and the areas at the disease's `chart.areas` level (the nine UKHSA
 * regions, if it has any), one point a week. Server-side only.
 *
 * Nothing here may run at build time, because the build has no database:
 * callers wait for a real request first (`connection()`).
 */
import "server-only";
import { sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { getDb } from "@/db";
import { chartAreas, getDataset, getDisease } from "@/lib/datasets/registry";
import type { DiseaseSeries, SeriesLine, SeriesPeriod } from "@/lib/series-types";
import { loadWithFallback, NoDataError, type LoadResult } from "./load";

type Row = {
  code: string;
  name: string;
  level: SeriesLine["level"];
  value: number;
  provisional: boolean;
  period_start: string;
  period_end: string;
};

/**
 * Reads the whole place and the areas for a disease's headline dataset, from
 * the chart's start date to the place's latest period. Only periods that end
 * a whole number of weeks before the place's latest are kept, so the daily
 * COVID-19 rate rows become one point a week (see `queryHeadlines`). Not
 * cached.
 *
 * @throws {NoDataError} If the place has no values, so an empty result is not
 *   cached for a day.
 * @throws On any database error, so a failure is never cached.
 */
export async function queryDiseaseSeries(
  slug: string,
  datasetId?: string,
): Promise<DiseaseSeries> {
  const disease = getDisease(slug);
  const dataset = disease && getDataset(datasetId ?? disease.headline.datasetId);
  if (!disease || !dataset || dataset.diseaseSlug !== slug) {
    throw new Error(`Unknown disease ${slug}`);
  }
  const { place } = dataset;
  // The whole place, and (unless the dataset's chart draws the place alone) its areas.
  const onlyPlace = sql`a.code_scheme = ${place.scheme} and a.code = ${place.code}`;
  const areas = chartAreas(dataset);
  const placeOrAreas = areas
    ? sql`(${onlyPlace}) or (a.code_scheme = ${dataset.map.areaScheme} and a.level = ${areas.level})`
    : onlyPlace;

  const ended = dataset.completePeriodsOnly ? sql`and o.period_end < current_date` : sql``;
  const result = await getDb().execute<Row>(sql`
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
        and a.code_scheme = ${place.scheme}
        and a.code = ${place.code}
        ${ended}
      order by o.period_start desc
      limit 1
    )
    select a.code, a.name, a.level, o.value, o.provisional,
           o.period_start::text as period_start, o.period_end::text as period_end
    from latest l
    join observations o on o.period_end <= l.period_end
      and (l.period_end - o.period_end) % 7 = 0
      and o.period_end >= ${disease.chart.since}::date
    join diseases d on d.id = o.disease_id
    join sources s on s.id = o.source_id
    join areas a on a.id = o.area_id
    where d.slug = ${dataset.diseaseSlug}
      and s.slug = ${dataset.sourceSlugs[0]}
      and o.metric = ${dataset.metric}
      and o.stratum = 'all'
      and o.period_type = ${dataset.periodType}
      and (${placeOrAreas})
    order by o.period_end, a.name`);

  const whole = result.rows.filter((row) => row.code === place.code);
  if (whole.length === 0) throw new NoDataError(`series for ${slug}`);
  const periods: SeriesPeriod[] = whole.map((row) => ({
    start: row.period_start,
    end: row.period_end,
    provisional: row.provisional,
  }));
  const indexOfEnd = new Map(periods.map((period, index) => [period.end, index]));

  const byCode = new Map<string, SeriesLine>();
  for (const row of result.rows) {
    const index = indexOfEnd.get(row.period_end);
    if (index === undefined) continue;
    let line = byCode.get(row.code);
    if (!line) {
      line = {
        code: row.code,
        name: row.name,
        level: row.level,
        values: periods.map(() => null),
      };
      byCode.set(row.code, line);
    }
    line.values[index] = Number(row.value);
  }
  const lines = [...byCode.values()].sort((a, b) =>
    a.code === place.code ? -1 : b.code === place.code ? 1 : a.name.localeCompare(b.name, "en-GB"),
  );
  return { diseaseSlug: slug, datasetId: dataset.id, periods, lines };
}

/**
 * The same series, from the shared runtime cache (refreshed about once a
 * day). The slug is the cache key, so callers must only pass slugs that
 * were checked against the registry.
 */
async function getCachedDiseaseSeries(slug: string, datasetId: string): Promise<DiseaseSeries> {
  "use cache: remote";
  cacheLife("days");
  return queryDiseaseSeries(slug, datasetId);
}

/**
 * Loads the series without ever throwing: from the cache, else from the
 * database, else as an "error" or "empty" result.
 */
export function loadDiseaseSeries(
  slug: string,
  datasetId?: string,
): Promise<LoadResult<DiseaseSeries>> {
  const id = datasetId ?? getDisease(slug)?.headline.datasetId ?? "";
  return loadWithFallback(
    "Disease series",
    () => getCachedDiseaseSeries(slug, id),
    () => queryDiseaseSeries(slug, id),
  );
}
