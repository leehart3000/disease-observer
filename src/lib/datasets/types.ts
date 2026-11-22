/**
 * Types for the dataset registry (see `registry.ts`).
 *
 * The ETL imports the registry too, and runs under Node's type stripping,
 * so this file uses erasable TypeScript only and no `@/` imports.
 */

/** How the values of a dataset can be combined over time on the map. */
export type PeriodChoice = "latest" | "12w" | "ytd";

/** The kinds of area a dataset can be mapped at. */
export type AreaLevel = "nation" | "region" | "lower_tier_local_authority" | "country";

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

/**
 * A box on the map as `[[west, south], [east, north]]`, in degrees of
 * longitude and latitude.
 */
export type LngLatBounds = readonly [readonly [number, number], readonly [number, number]];

/**
 * A place that a dataset covers as a whole, with the row in the `areas` table
 * that holds its figures. Its code scheme can differ from the scheme of the
 * dataset's own areas: the United States is `USA` in `iso3166-1-alpha3`, and
 * its states are `US-AL` and so on in `iso3166-2`.
 */
export type Place = {
  /** What it is called, such as "England". */
  name: string;
  /** Its part of an address, such as `england`. */
  slug: string;
  /** Its code in the `areas` table, such as `E92000001`. */
  code: string;
  /** The code scheme of `code`, such as `ons`. */
  scheme: string;
};

/** The ways a dataset can be looked at, each with a page of its own. */
export type View = "map" | "chart" | "table";

/** One thing that can be shown on the map. */
export type DatasetDef = {
  /**
   * Stable, URL-safe identifier, used for cache keys and by the ETL. It was
   * the `d` in the old `/map?d=covid-19-rate` address, which redirects to the
   * dataset's page (see `slug`).
   */
  id: string;
  diseaseSlug: string;
  /**
   * The dataset's part of its pages' URLs, such as `rate-by-local-authority`
   * in `/diseases/covid-19/rate-by-local-authority`. Unique within a disease.
   */
  slug: string;
  /** The short name for breadcrumbs and headings, such as "Rate by local authority". */
  name: string;
  /**
   * The views that have a page for this dataset. Empty until the dataset
   * pages are built; a view is added here when its page exists, and the
   * tabs and the sitemap follow.
   */
  views: readonly View[];
  /** The text in the dataset picker. Unique, so it is clear when closed. */
  label: string;
  /** One sentence on what the dataset shows, for lists and the page description. British English. */
  description: string;
  /** How to read a value, for the dataset page: what it counts and over what period. British English. */
  howToRead: string;
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
  /**
   * Shown on the map and table pages when the dataset offers only one
   * period, to say why there is no choice. British English.
   */
  periodNote?: string;
  /**
   * How the chart page of this dataset works. `all-areas` draws England and
   * every region, for a dataset with few areas. `pick-areas` is for a dataset
   * with many areas, where England is always drawn and the visitor chooses up
   * to three areas to compare with it.
   */
  chart: { mode: "all-areas" | "pick-areas" };
  map: {
    areaLevel: AreaLevel;
    /** The static boundary file for these areas. */
    boundaryUrl: string;
    /** The part of the world the map opens on: the dataset's places, with some room around them. */
    bounds: LngLatBounds;
    /** The farthest the map can be moved: it stops the visitor getting lost far from the data. Contains `bounds`. */
    maxBounds: LngLatBounds;
    /** The `code_scheme` of the codes of these areas in the `areas` table, such as `ons`. */
    areaScheme: string;
    /** What the areas are called, in the plural. */
    areaNoun: string;
    /** What one area is called, such as "local authority". */
    areaNounOne: string;
  };
  scale: ScaleConfig;
  /**
   * The place the data covers as a whole, such as England. Its `name` is used
   * in the coverage line and wherever the whole place is named (the charts,
   * the headline). Its row in the `areas` table (`scheme` and `code`) holds the
   * dataset's national figures, and is what every chart compares areas with.
   */
  place: Place;
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
  /**
   * The chart on the disease page shows the headline dataset's metric for its
   * whole place (England) and the areas at `areaLevel` (the regions), one
   * point a week, from `since` (`YYYY-MM-DD`). The areas are of the headline
   * dataset's `map.areaScheme`. `areaNoun` is what they are called in the
   * plural ("regions", in the chart's checkboxes) and `areasLabel` names them
   * for people using a screen reader ("UKHSA regions").
   */
  chart: { since: string; areaLevel: AreaLevel; areaNoun: string; areasLabel: string };
};
