/** Types for a disease's weekly series, shared by the server (which loads it) and the chart. */

/** One week on the chart's time axis. */
export type SeriesPeriod = {
  /** First day of the period, as `YYYY-MM-DD`. */
  start: string;
  /** Last day of the period, as `YYYY-MM-DD`. */
  end: string;
  /** True while the whole place's value (England's) for the period may still be revised. */
  provisional: boolean;
};

/** One place's values, one for each period (`null` where the source has none). */
export type SeriesLine = {
  code: string;
  name: string;
  level: "nation" | "region" | "lower_tier_local_authority" | "country";
  values: Array<number | null>;
};

/** An area that can be chosen for a chart: its code and its name. */
export type AreaOption = {
  code: string;
  name: string;
  /** The name of the region that contains the area, or `null` if it is not known. */
  region: string | null;
};

/**
 * One area's weekly values, as the area's own database rows give them.
 * Weeks the area has no row for are simply not here. `composeSeries` lines
 * these up with the weeks of the dataset's whole place (England).
 */
export type AreaSeries = {
  code: string;
  name: string;
  level: SeriesLine["level"];
  /** Oldest first, one point a week, ending no later than the whole place's latest week. */
  points: Array<{ start: string; end: string; value: number; provisional: boolean }>;
};

/** A whole place (England) and some of its areas over time, one point a week. */
export type DiseaseSeries = {
  diseaseSlug: string;
  datasetId: string;
  /** Oldest first. */
  periods: SeriesPeriod[];
  /** The whole place first, then the areas. */
  lines: SeriesLine[];
};
