/**
 * What each map layer shows, and how its values and periods are written.
 * Safe to import from both server and client code.
 */
import type { LayerKey } from "./types";

/** Settings for one layer. */
export type LayerConfig = {
  key: LayerKey;
  /** The label of the layer toggle. */
  label: string;
  /** A short heading for the table caption and the map's accessible name. */
  title: string;
  /** `rate` values can have decimals; `count` values are whole numbers. */
  valueKind: "rate" | "count";
  /** The static boundary file for this layer's areas. */
  boundaryUrl: string;
  /** What the areas are called, in the plural. */
  areaNoun: string;
  /** The heading of the value column in the table. */
  valueHeading: string;
  /**
   * The `sources` rows to credit when this layer is shown: its own data
   * source, then the one for the boundaries that are drawn.
   */
  sourceSlugs: string[];
};

export const LAYERS: Record<LayerKey, LayerConfig> = {
  covid: {
    key: "covid",
    label: "COVID-19 rate by local authority",
    title: "COVID-19 cases per 100,000 people, by local authority",
    valueKind: "rate",
    boundaryUrl: "/boundaries/lad-dec-2022.json",
    areaNoun: "local authorities",
    valueHeading: "Cases per 100,000 (7 days)",
    sourceSlugs: ["ukhsa", "ons-geography"],
  },
  measles: {
    key: "measles",
    label: "Measles cases by region",
    title: "Measles cases, by UKHSA region",
    valueKind: "count",
    boundaryUrl: "/boundaries/rgn-dec-2022.json",
    areaNoun: "regions",
    valueHeading: "Cases (week)",
    sourceSlugs: ["ukhsa", "ons-geography"],
  },
};

export const LAYER_KEYS = Object.keys(LAYERS) as LayerKey[];

const numberFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

/** Formats a number for display, with thousands separators and at most one decimal place. */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Formats a layer's value with its unit, such as "123.4 per 100,000" or "3 cases". */
export function formatValue(layer: LayerKey, value: number): string {
  if (layer === "covid") return `${formatNumber(value)} per 100,000`;
  return `${formatNumber(value)} ${value === 1 ? "case" : "cases"}`;
}

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayMonthFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** Formats a `YYYY-MM-DD` date as "14 November 2026". */
export function formatDay(day: string): string {
  return dayFormat.format(parseDay(day));
}

/** Formats two dates as one range, such as "2 to 8 November 2026". */
export function formatDayRange(start: string, end: string): string {
  const from = parseDay(start);
  const to = parseDay(end);
  if (from.getUTCFullYear() !== to.getUTCFullYear()) {
    return `${formatDay(start)} to ${formatDay(end)}`;
  }
  const sameMonth = from.getUTCMonth() === to.getUTCMonth();
  const fromText = sameMonth
    ? String(from.getUTCDate())
    : dayMonthFormat.format(from);
  return `${fromText} to ${formatDay(end)}`;
}

/** Describes a period in words, such as "7 days to 14 November 2026". */
export function formatPeriod(layer: LayerKey, start: string, end: string): string {
  return layer === "covid"
    ? `7 days to ${formatDay(end)}`
    : `Week of onset ${formatDayRange(start, end)}`;
}
