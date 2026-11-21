/** Types for a disease's weekly series, shared by the server (which loads it) and the chart. */

/** One week on the chart's time axis. */
export type SeriesPeriod = {
  /** First day of the period, as `YYYY-MM-DD`. */
  start: string;
  /** Last day of the period, as `YYYY-MM-DD`. */
  end: string;
  /** True while England's value for the period may still be revised. */
  provisional: boolean;
};

/** One place's values, one for each period (`null` where the source has none). */
export type SeriesLine = {
  code: string;
  name: string;
  level: "nation" | "region";
  values: Array<number | null>;
};

/** England and the UKHSA regions over time, one point a week. */
export type DiseaseSeries = {
  diseaseSlug: string;
  datasetId: string;
  /** Oldest first. */
  periods: SeriesPeriod[];
  /** England first, then the regions by name. */
  lines: SeriesLine[];
};
