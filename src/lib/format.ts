/**
 * How numbers, values and periods are written for display (British
 * English, en-GB). Safe to import from both server and client code.
 */
import type { DatasetDef, PeriodChoice } from "./datasets/types.ts";

const numberFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

/** Formats a number for display, with thousands separators and at most one decimal place. */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Formats a value with its unit, such as "123.4 per 100,000" or "3 cases". */
export function formatValue(dataset: DatasetDef, value: number): string {
  if (dataset.valueKind === "rate") return `${formatNumber(value)} ${dataset.unit.label}`;
  const noun = value === 1 ? dataset.unit.one : dataset.unit.many;
  return `${formatNumber(value)} ${noun ?? dataset.unit.label}`;
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
  const fromText = sameMonth ? String(from.getUTCDate()) : dayMonthFormat.format(from);
  return `${fromText} to ${formatDay(end)}`;
}

/** The choices of period, as they are written on the picker. */
export const PERIOD_LABELS: Record<PeriodChoice, string> = {
  latest: "Latest week",
  "12w": "Last 12 weeks",
  ytd: "Year to date",
};

/**
 * Describes a period in words: "7 days to 14 November 2026", "Week of onset 9
 * to 15 November 2026", or, for a total over several weeks, "Total for weeks
 * of onset 24 August to 15 November 2026".
 *
 * @param period - Which period the dates are for. Only the latest period is a single week.
 */
export function formatPeriod(
  dataset: DatasetDef,
  start: string,
  end: string,
  period: PeriodChoice = "latest",
): string {
  if (dataset.periodStyle === "trailing-week") return `7 days to ${formatDay(end)}`;
  return period === "latest"
    ? `Week of onset ${formatDayRange(start, end)}`
    : `Total for weeks of onset ${formatDayRange(start, end)}`;
}

/** The heading of the value column for a period, falling back to the latest period's. */
export function columnHeading(dataset: DatasetDef, period: PeriodChoice): string {
  return dataset.columnHeading[period] ?? dataset.columnHeading.latest;
}

/** "11 of 12 weeks" for an area that has fewer weeks than the period, or `null` if it has them all. */
export function formatCoverage(weeks: number, expected: number): string | null {
  return weeks < expected ? `${weeks} of ${expected} weeks reported` : null;
}
