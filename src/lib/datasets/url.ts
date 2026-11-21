/**
 * Reads and builds the map's URL: `/map?d=<dataset>&p=<period>`.
 *
 * Anything from the URL is checked against the registry before it is used.
 * That also keeps unknown values out of the cache keys of the data
 * functions, so a visitor cannot create unlimited cache entries.
 */
import { DEFAULT_DATASET_ID, getDataset, offersPeriod } from "./registry.ts";
import type { DatasetDef, PeriodChoice } from "./types.ts";

/** The shape of `searchParams` in a page. */
export type SearchParams = Record<string, string | string[] | undefined>;

/** The first value of a query parameter, if there is one. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** What the map is showing. */
export type MapSelection = { dataset: DatasetDef; period: PeriodChoice };

/**
 * Works out which dataset and period to show. A missing or unknown dataset
 * gives the default one, and a missing or unavailable period gives `latest`.
 */
export function parseMapSelection(params: SearchParams): MapSelection {
  const requested = firstValue(params.d);
  const dataset =
    (requested !== undefined ? getDataset(requested) : undefined) ??
    (getDataset(DEFAULT_DATASET_ID) as DatasetDef);
  const wanted = firstValue(params.p);
  const period = wanted !== undefined && offersPeriod(dataset, wanted) ? wanted : "latest";
  return { dataset, period };
}

/** The URL of the map for a dataset. The period is left out when it is `latest`. */
export function mapHref(datasetId: string, period: PeriodChoice = "latest"): string {
  const query = new URLSearchParams({ d: datasetId });
  if (period !== "latest") query.set("p", period);
  return `/map?${query}`;
}
