/**
 * Turns NHSN rows into observations: which jurisdictions are ours, which
 * area each one is, and which week of each series is provisional. Pure
 * functions, so they can be tested without a database or the network.
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`.
 */
import type { NhsnRow } from "./cdc-nhsn-api.mts";
import { addDays, type ObservationFields } from "./ukhsa-transform.mts";

/** The `metric` of every NHSN observation. */
export const METRIC = "admissions_per_100k";

/** Which column of a row is which disease's rate. */
export const DISEASE_COLUMNS = [
  { diseaseSlug: "influenza", column: "totalconfflunewadmper100k" },
  { diseaseSlug: "rsv", column: "totalconfrsvnewadmper100k" },
  { diseaseSlug: "covid-19", column: "totalconfc19newadmper100k" },
] as const;

/** The code scheme of the national row (`USA`): an ISO 3166-1 alpha-3 country. */
export const NATIONAL_SCHEME = "iso3166-1-alpha3";
/** The code scheme of the states (`US-AL`): ISO 3166-2. */
export const STATE_SCHEME = "iso3166-2";

/** The 50 states and the District of Columbia, as the source writes them. */
const STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(
    " ",
  ),
);

/**
 * The territories, which have no boundary in the states file (they are
 * countries in the countries file, so a state map would not draw them).
 */
const TERRITORIES = new Set(["AS", "GU", "MP", "PR", "VI"]);

/** The ten HHS regions (`Region 1` to `Region 10`), which the site does not show. */
const HHS_REGION = /^Region (?:[1-9]|10)$/;

/** The row of the `areas` table that a jurisdiction is stored against. */
export type AreaKey = { scheme: string; code: string };

/**
 * Says which area a jurisdiction is.
 *
 * @returns The national row, a state or DC, or `null` for a territory or an
 *   HHS region, which are left out on purpose.
 * @throws If the jurisdiction is none of these, so a new kind of row is not
 *   silently dropped or mixed in.
 */
export function resolveJurisdiction(jurisdiction: string): AreaKey | null {
  if (jurisdiction === "USA") return { scheme: NATIONAL_SCHEME, code: "USA" };
  if (STATES.has(jurisdiction)) return { scheme: STATE_SCHEME, code: `US-${jurisdiction}` };
  if (TERRITORIES.has(jurisdiction) || HHS_REGION.test(jurisdiction)) return null;
  throw new Error(`Unknown jurisdiction "${jurisdiction}"`);
}

/** One area's weekly values for one disease. */
export type Series = {
  area: AreaKey;
  diseaseSlug: string;
  /** Oldest first. The latest week is provisional. */
  observations: ObservationFields[];
};

/** The day a week ends, from the source's date-time text. */
function dayOf(weekendingdate: string): string {
  return weekendingdate.slice(0, 10);
}

/**
 * Builds the series from the rows: one for each area and disease that has any
 * value. A week with no figure (the rate is missing) is left out. The latest
 * week of each series is marked provisional, because hospitals can report
 * late (the source does not say so itself: this is our choice).
 *
 * A week is Sunday to Saturday and the source gives its last day, so the first
 * day is six days earlier.
 */
export function buildSeries(rows: readonly NhsnRow[]): Series[] {
  const byKey = new Map<string, Series>();
  for (const row of rows) {
    const area = resolveJurisdiction(row.jurisdiction);
    if (area === null) continue;
    const end = dayOf(row.weekendingdate);
    for (const { diseaseSlug, column } of DISEASE_COLUMNS) {
      const value = row[column];
      if (value === undefined) continue;
      const key = `${area.scheme}|${area.code}|${diseaseSlug}`;
      let series = byKey.get(key);
      if (!series) {
        series = { area, diseaseSlug, observations: [] };
        byKey.set(key, series);
      }
      series.observations.push({
        metric: METRIC,
        stratum: "all",
        periodType: "week",
        periodStart: addDays(end, -6),
        periodEnd: end,
        value,
        provisional: false,
      });
    }
  }

  for (const series of byKey.values()) {
    // The same week twice would break the insert, so keep the last one seen.
    const byWeek = new Map(series.observations.map((o) => [o.periodStart, o]));
    series.observations = [...byWeek.values()].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    const latest = series.observations[series.observations.length - 1];
    latest.provisional = true;
  }
  return [...byKey.values()];
}

/** The areas that the series are stored against, without repeats. */
export function areasOf(series: readonly Series[]): AreaKey[] {
  const seen = new Map<string, AreaKey>();
  for (const { area } of series) seen.set(`${area.scheme}|${area.code}`, area);
  return [...seen.values()];
}
