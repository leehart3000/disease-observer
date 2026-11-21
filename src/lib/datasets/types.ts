/**
 * Types for the dataset registry (see `registry.ts`).
 *
 * The ETL imports the registry too, and runs under Node's type stripping,
 * so this file uses erasable TypeScript only and no `@/` imports.
 */

/** How the values of a dataset can be combined over time on the map. */
export type PeriodChoice = "latest" | "12w" | "ytd";

/** The kinds of area a dataset can be mapped at. */
export type AreaLevel = "nation" | "region" | "lower_tier_local_authority";

/** How the colours of the map are chosen from the values. */
export type ScaleConfig = {
  /** The most colour classes. There are fewer if the values do not vary enough. */
  classes: number;
  /**
   * How class boundaries are rounded so the legend reads cleanly: to two
   * significant figures (for rates) or up to whole numbers (for counts).
   */
  rounding: "2sf" | "integer";
  /** True if a value of zero gets a class of its own (for counts). */
  zeroClass: boolean;
};

/** One thing that can be shown on the map. */
export type DatasetDef = {
  /** Stable, URL-safe identifier. It is the `d` in `/map?d=covid-19-rate`. */
  id: string;
  diseaseSlug: string;
  /** The text in the dataset picker. Unique, so it is clear when closed. */
  label: string;
  /** The heading for the map, the legend and the table. */
  title: string;
  /** The metric name in the `observations` table. */
  metric: string;
  /** `rate` values can have decimals; `count` values are whole numbers. */
  valueKind: "rate" | "count";
  /** The unit. Counts use `one` and `many` ("case", "cases"). */
  unit: { label: string; one?: string; many?: string };
  /** How a period is written: "7 days to 18 November 2026", or a week of onset. */
  periodStyle: "trailing-week" | "onset-week";
  /** The period length stored in `observations.period_type`. */
  periodType: "day" | "week";
  /** The period choices on offer. Rates only offer `latest`, as they cannot be added. */
  periods: readonly PeriodChoice[];
  /** True if only periods that have already ended are used (for weekly counts). */
  completePeriodsOnly: boolean;
  /** The heading of the value column in the table, for each period choice on offer. */
  columnHeading: { latest: string; "12w"?: string; ytd?: string };
  map: {
    areaLevel: AreaLevel;
    /** The static boundary file for these areas. */
    boundaryUrl: string;
    /** What the areas are called, in the plural. */
    areaNoun: string;
  };
  scale: ScaleConfig;
  /** The country or area the data covers, such as "England". Used in the coverage line. */
  place: string;
  /** Who publishes the data, such as "UK Health Security Agency". Used in the coverage line. */
  publisher: string;
  /** The `sources` rows to credit: the data source first, then the boundaries. */
  sourceSlugs: readonly string[];
};

/** A disease that the site covers. */
export type DiseaseDef = {
  /** Stable, URL-safe identifier. It is in `/diseases/covid-19`. */
  slug: string;
  name: string;
  /** One sentence for the cards and the page description. British English. */
  summary: string;
  /** Short paragraphs for the disease page. British English. */
  about: readonly string[];
  /**
   * The figure shown on the disease's card and page: the latest value for
   * the dataset's whole place (England), in the dataset's metric and unit.
   */
  headline: { datasetId: string };
};
