/**
 * How numbers, values and periods are written for display (British
 * English, en-GB). Safe to import from both server and client code.
 */
import type { DatasetDef } from "./datasets/types.ts";

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

/** Describes a period in words, such as "7 days to 14 November 2026". */
export function formatPeriod(dataset: DatasetDef, start: string, end: string): string {
  return dataset.periodStyle === "trailing-week"
    ? `7 days to ${formatDay(end)}`
    : `Week of onset ${formatDayRange(start, end)}`;
}
