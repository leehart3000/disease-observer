/**
 * Reads the state in a map page's URL: `?p=<period>` and `?areas=<code>`.
 * The dataset itself is in the path (`/diseases/covid-19/rate-by-local-authority/map`).
 *
 * Anything from the URL is checked before it is used. The period is checked
 * against the dataset, which also keeps unknown values out of the cache keys
 * of the data functions, so a visitor cannot create unlimited cache entries.
 */
import { offersPeriod } from "./registry.ts";
import type { DatasetDef, PeriodChoice } from "./types.ts";

/** The shape of `searchParams` in a page. */
export type SearchParams = Record<string, string | string[] | undefined>;

/** The first value of a query parameter, if there is one. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The longest an area code can be, and the characters it can have: ONS codes such as `E06000001`. */
const AREA_CODE = /^[A-Z0-9]{9}$/;

/**
 * Reads a list of area codes, such as `?areas=E06000001,E06000002`. Anything
 * that is not shaped like an area code is dropped, repeats are removed, and
 * only the first `limit` are kept. Whether a code is a real area of the
 * dataset is checked by the caller, against the values it has loaded.
 */
export function parseAreaCodes(value: string | string[] | undefined, limit: number): string[] {
  const codes = (firstValue(value) ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter((code) => AREA_CODE.test(code));
  return [...new Set(codes)].slice(0, limit);
}

/**
 * Reads a chart's time range, `?range=all` for the whole series. Anything
 * else (including a missing or repeated value) is the default, the last 12
 * months.
 */
export function parseChartRange(params: SearchParams): "12m" | "all" {
  return firstValue(params.range) === "all" ? "all" : "12m";
}

/** What a map page is showing, beyond its dataset. */
export type MapSelection = {
  period: PeriodChoice;
  /** The area codes in the URL (the map pins the first one that is in the data). */
  areas: string[];
};

/**
 * Works out the period and areas to show. A missing or unavailable period
 * gives `latest`. Up to ten area codes are read, so that a code that is not
 * in the data does not hide the next one.
 */
export function parseMapSelection(dataset: DatasetDef, params: SearchParams): MapSelection {
  const wanted = firstValue(params.p);
  const period = wanted !== undefined && offersPeriod(dataset, wanted) ? wanted : "latest";
  return { period, areas: parseAreaCodes(params.areas, 10) };
}
