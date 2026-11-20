/**
 * Pure functions that turn UKHSA data points into rows for our tables, and
 * the list of datasets the ETL loads. Nothing here touches the network or
 * the database.
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`.
 */
import type { AREA_LEVELS } from "../../src/db/schema.ts";
import type { UkhsaPoint } from "./ukhsa-api.mts";

/** How a UKHSA metric becomes one of our metrics and periods. */
export type SeriesConfig = {
  /** The metric name in the UKHSA API. */
  ukhsaMetric: string;
  /** Our metric name. */
  metric: string;
  periodType: "day" | "week";
  /** Works out the first and last day of the period from the point's date. */
  period: (date: string) => { start: string; end: string };
};

/** A set of series for one disease and one type of geography. */
export type DatasetConfig = {
  /** Used in logs. */
  name: string;
  diseaseSlug: string;
  subTheme: string;
  topic: string;
  geographyType: string;
  areaLevel: (typeof AREA_LEVELS)[number];
  /**
   * True if the API should be asked for one calendar year at a time. This
   * suits long daily series. False fetches the whole history in one go.
   */
  byYear: boolean;
  series: SeriesConfig[];
};

/** A row for the `observations` table, before the area and source are known. */
export type ObservationFields = {
  metric: string;
  stratum: string;
  periodType: "day" | "week";
  periodStart: string;
  periodEnd: string;
  value: number;
  provisional: boolean;
};

/** Adds days to a `YYYY-MM-DD` date, using UTC so daylight saving cannot interfere. */
export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/**
 * The datasets to load.
 *
 * - COVID-19 daily cases: one value per day.
 * - COVID-19 rate: UKHSA documents `COVID-19_cases_rateRollingMean` as the
 *   "rate per 100,000 people of reported new cases in the 7-day period
 *   ending on the dates shown". So the window is trailing: the 7 days that
 *   end on the point's date, and the period starts 6 days earlier.
 * - Measles: cases by week of onset. The dates in the data are Mondays, so
 *   the week runs from that Monday to the following Sunday. UKHSA's
 *   documentation pages that I could reach do not describe this metric, so
 *   the Monday start is inferred from the data.
 */
export const DATASETS: DatasetConfig[] = [
  {
    name: "COVID-19 by lower tier local authority",
    diseaseSlug: "covid-19",
    subTheme: "respiratory",
    topic: "COVID-19",
    geographyType: "Lower Tier Local Authority",
    areaLevel: "lower_tier_local_authority",
    byYear: true,
    series: [
      {
        ukhsaMetric: "COVID-19_cases_casesByDay",
        metric: "cases",
        periodType: "day",
        period: (date) => ({ start: date, end: date }),
      },
      {
        ukhsaMetric: "COVID-19_cases_rateRollingMean",
        metric: "rate_per_100k",
        periodType: "week",
        period: (date) => ({ start: addDays(date, -6), end: date }),
      },
    ],
  },
  {
    name: "Measles by UKHSA region",
    diseaseSlug: "measles",
    subTheme: "vaccine_preventable",
    topic: "Measles",
    geographyType: "UKHSA Region",
    areaLevel: "region",
    byYear: false,
    series: [
      {
        ukhsaMetric: "measles_cases_casesByOnsetWeek",
        metric: "cases",
        periodType: "week",
        period: (date) => ({ start: date, end: addDays(date, 6) }),
      },
    ],
  },
];

/**
 * Describes the slice of the population that a point covers, using our
 * `stratum` format. A point with no breakdown is `all`. The series we load
 * have no breakdown, but this keeps points that did have one from
 * overwriting each other.
 */
export function strataLabel(point: Pick<UkhsaPoint, "stratum" | "sex" | "age">): string {
  const parts: string[] = [];
  if (point.age !== "all") parts.push(`age:${point.age}`);
  if (point.sex !== "all") parts.push(`sex:${point.sex}`);
  if (point.stratum !== "default") parts.push(`stratum:${point.stratum}`);
  return parts.length > 0 ? parts.join(",") : "all";
}

/**
 * Converts one data point to observation fields.
 *
 * @returns `null` if the point has no value (the source hid it).
 */
export function toObservationFields(
  point: UkhsaPoint,
  series: SeriesConfig,
): ObservationFields | null {
  if (point.metric_value === null) return null;
  const { start, end } = series.period(point.date);
  return {
    metric: series.metric,
    stratum: strataLabel(point),
    periodType: series.periodType,
    periodStart: start,
    periodEnd: end,
    value: point.metric_value,
    provisional: point.in_reporting_delay_period,
  };
}

/**
 * Removes rows that share a natural key (everything except the area, which
 * the caller holds constant, and the value). The last row wins. Postgres
 * refuses to update the same row twice in one `INSERT ... ON CONFLICT`
 * statement, and the API has been seen to return a row twice.
 */
export function dedupeObservations(rows: ObservationFields[]): ObservationFields[] {
  const byKey = new Map<string, ObservationFields>();
  for (const row of rows) {
    byKey.set(
      [row.metric, row.stratum, row.periodType, row.periodStart].join("|"),
      row,
    );
  }
  return [...byKey.values()];
}

/**
 * The calendar years to fetch in the default mode: this year, plus last
 * year in January, because late data for December can still arrive.
 */
export function yearsForDefaultRun(now: Date): number[] {
  const year = now.getUTCFullYear();
  return now.getUTCMonth() === 0 ? [year - 1, year] : [year];
}

/**
 * The calendar years for a backfill, from `fromYear` to this year.
 *
 * @throws If `fromYear` is later than this year.
 */
export function yearsForBackfill(fromYear: number, now: Date): number[] {
  const year = now.getUTCFullYear();
  if (fromYear > year) throw new Error(`--from=${fromYear} is in the future`);
  return Array.from({ length: year - fromYear + 1 }, (_, i) => fromYear + i);
}
