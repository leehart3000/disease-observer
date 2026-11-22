/**
 * The headline figure of each disease: the latest value for the headline
 * dataset's whole place (England), and the last 26 weekly values for a
 * sparkline. Server-side only.
 *
 * Nothing here may run at build time, because the build has no database:
 * callers wait for a real request first (`connection()`).
 */
import "server-only";
import { sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { cache } from "react";
import { getDb } from "@/db";
import { DISEASES, getDataset } from "@/lib/datasets/registry";
import type { DatasetDef } from "@/lib/datasets/types";
import { loadWithFallback, NoDataError, type LoadResult } from "./load";

/** How many weekly values the sparkline holds, counting the latest. */
export const SPARKLINE_WEEKS = 26;

/** The latest figure for one disease, with its recent history. */
export type Headline = {
  diseaseSlug: string;
  datasetId: string;
  /** First day of the latest period, as `YYYY-MM-DD`. */
  periodStart: string;
  /** Last day of the latest period, as `YYYY-MM-DD`. */
  periodEnd: string;
  value: number;
  /** True while the source says the value may still be revised. */
  provisional: boolean;
  /** Up to 26 weekly values, oldest first, ending with `value`. */
  points: number[];
};

type Row = {
  value: number;
  provisional: boolean;
  period_start: string;
  period_end: string;
  weeks_back: number;
};

/**
 * Reads one disease's figure for its dataset's whole place (such as England).
 * The latest period is the one with the
 * latest start (and, if the dataset asks for it, that has already ended).
 * The history is every row whose period ends a whole number of weeks before
 * the latest one, so overlapping daily rows (the COVID-19 rate is one row a
 * day, each covering 7 days) become non-overlapping weeks.
 *
 * @returns `null` if the place has no values for the disease.
 */
async function queryHeadline(dataset: DatasetDef): Promise<Headline | null> {
  const ended = dataset.completePeriodsOnly ? sql`and o.period_end < current_date` : sql``;
  const result = await getDb().execute<Row>(sql`
    with matching as (
      select o.value, o.provisional, o.period_start, o.period_end
      from observations o
      join diseases d on d.id = o.disease_id
      join sources s on s.id = o.source_id
      join areas a on a.id = o.area_id
      where d.slug = ${dataset.diseaseSlug}
        and s.slug = ${dataset.sourceSlugs[0]}
        and o.metric = ${dataset.metric}
        and o.stratum = 'all'
        and o.period_type = ${dataset.periodType}
        and a.code_scheme = ${dataset.place.scheme}
        and a.code = ${dataset.place.code}
        ${ended}
    ), latest as (
      select period_end from matching order by period_start desc limit 1
    )
    select m.value, m.provisional,
           m.period_start::text as period_start, m.period_end::text as period_end,
           ((l.period_end - m.period_end) / 7)::int as weeks_back
    from latest l
    join matching m on m.period_end <= l.period_end
      and (l.period_end - m.period_end) % 7 = 0
      and (l.period_end - m.period_end) / 7 < ${SPARKLINE_WEEKS}
    order by m.period_end desc`);

  const rows = result.rows;
  if (rows.length === 0) return null;
  const [latest] = rows;
  return {
    diseaseSlug: dataset.diseaseSlug,
    datasetId: dataset.id,
    periodStart: latest.period_start,
    periodEnd: latest.period_end,
    value: Number(latest.value),
    provisional: latest.provisional,
    points: rows.map((row) => Number(row.value)).reverse(),
  };
}

/**
 * The headline of every disease that has one and has data for its place. Not
 * cached.
 *
 * @throws {NoDataError} If no disease has any, so an empty result is not
 *   cached for a day.
 * @throws On any database error, so a failure is never cached.
 */
export async function queryHeadlines(): Promise<Headline[]> {
  const datasets = DISEASES.flatMap(({ headline }) => {
    const dataset = getDataset(headline.datasetId);
    return dataset ? [dataset] : [];
  });
  const found = await Promise.all(datasets.map(queryHeadline));
  const headlines = found.filter((headline) => headline !== null);
  if (headlines.length === 0) throw new NoDataError("headlines");
  return headlines;
}

/** The same figures, from the shared runtime cache (refreshed about once a day). */
async function getCachedHeadlines(): Promise<Headline[]> {
  "use cache: remote";
  cacheLife("days");
  return queryHeadlines();
}

/**
 * Loads the headlines without ever throwing: from the cache, else from the
 * database, else as an "error" or "empty" result. Within one request the
 * answer is shared, so many cards cost one lookup.
 */
export const loadHeadlines = cache(
  (): Promise<LoadResult<Headline[]>> =>
    loadWithFallback("Headlines", getCachedHeadlines, queryHeadlines),
);
