/**
 * The colour scale for the map: viridis, in a handful of stepped classes.
 * Safe to import from both server and client code.
 */
import type { ScaleConfig } from "../datasets/types.ts";
import { formatNumber } from "../format.ts";

/** Viridis at nine evenly spaced points, dark purple (low) to yellow (high). */
const VIRIDIS = [
  "#440154",
  "#472d7b",
  "#3b528b",
  "#2c728e",
  "#21908c",
  "#27ad81",
  "#5dc863",
  "#aadc32",
  "#fde725",
] as const;

function channels(hex: string): number[] {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

/** The viridis colour at a position from 0 (low) to 1 (high), as a hex string. */
export function viridisAt(position: number): string {
  const scaled = Math.min(Math.max(position, 0), 1) * (VIRIDIS.length - 1);
  const lower = Math.floor(scaled);
  const upper = Math.min(lower + 1, VIRIDIS.length - 1);
  const fraction = scaled - lower;
  const from = channels(VIRIDIS[lower]);
  const to = channels(VIRIDIS[upper]);
  const mixed = from.map((channel, i) => Math.round(channel + (to[i] - channel) * fraction));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** One stepped class: its colour and the text that describes its range. */
export type LegendClass = { colour: string; label: string };

/** A stepped colour scale. */
export type Scale = {
  /** The lower bound of every class except the first, in ascending order. */
  thresholds: number[];
  classes: LegendClass[];
  /** The colour for a value. */
  colourFor: (value: number) => string;
};

/** The value at a quantile (0 to 1) of an ascending list, by nearest rank. */
function quantile(sorted: number[], fraction: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(fraction * sorted.length));
  return sorted[index];
}

/** Works out where the classes start. Thresholds are strictly ascending. */
function chooseThresholds(values: number[], config: ScaleConfig): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const thresholds: number[] = [];
  let classesLeft = config.classes;

  let positives = sorted;
  if (config.zeroClass && sorted[0] === 0) {
    // Zero gets a class of its own.
    thresholds.push(1);
    classesLeft -= 1;
    positives = sorted.filter((value) => value > 0);
  }

  for (let i = 1; i < classesLeft && positives.length > 0; i += 1) {
    const raw = quantile(positives, i / classesLeft);
    // Class boundaries are rounded so the legend reads cleanly.
    const rounded = config.rounding === "2sf" ? Number(raw.toPrecision(2)) : Math.ceil(raw);
    const previous = thresholds[thresholds.length - 1] ?? -Infinity;
    if (rounded > previous && rounded > sorted[0] && rounded <= sorted[sorted.length - 1]) {
      thresholds.push(rounded);
    }
  }
  return thresholds;
}

/** Describes the range of one class in words. */
function labelFor(index: number, thresholds: number[], config: ScaleConfig): string {
  const low = index === 0 ? undefined : thresholds[index - 1];
  const high = index === thresholds.length ? undefined : thresholds[index];
  if (low === undefined) {
    if (config.zeroClass && high === 1) return "0";
    return `Under ${formatNumber(high!)}`;
  }
  if (high === undefined) return `${formatNumber(low)} or more`;
  if (config.rounding === "integer") {
    return high - 1 === low ? formatNumber(low) : `${formatNumber(low)} to ${formatNumber(high - 1)}`;
  }
  return `${formatNumber(low)} to under ${formatNumber(high)}`;
}

/**
 * Builds the colour scale for a set of values, with the settings of the
 * dataset. There are at most `config.classes` classes, fewer if the values
 * don't vary enough. If `config.zeroClass` is set, zero is its own class.
 */
export function buildScale(values: number[], config: ScaleConfig): Scale {
  const thresholds = chooseThresholds(values, config);
  const count = thresholds.length + 1;
  const classes: LegendClass[] = Array.from({ length: count }, (_, index) => ({
    colour: viridisAt(count === 1 ? 0.5 : index / (count - 1)),
    label: count === 1 ? "All values" : labelFor(index, thresholds, config),
  }));
  return {
    thresholds,
    classes,
    colourFor(value) {
      let index = 0;
      while (index < thresholds.length && value >= thresholds[index]) index += 1;
      return classes[index].colour;
    },
  };
}
