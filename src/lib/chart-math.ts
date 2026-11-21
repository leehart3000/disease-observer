/**
 * Pure helpers for the line chart: scales, ticks and paths. Nothing here
 * touches the DOM, so it is the same on the server and in the browser.
 */

/** The time of a `YYYY-MM-DD` date, in milliseconds (UTC). */
export function dayToMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/** A "nice" step for about `target` ticks over `max`: 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(max: number, target: number): number {
  const rough = max / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  for (const multiple of [1, 2, 2.5, 5, 10]) {
    if (multiple * power >= rough) return multiple * power;
  }
  return 10 * power;
}

/**
 * The y axis: it starts at zero and ends at a round number at or above
 * `max`, with ticks a round step apart.
 */
export function yAxis(max: number, targetTicks = 4): { max: number; ticks: number[] } {
  if (!(max > 0)) return { max: 1, ticks: [0, 1] };
  const step = niceStep(max, targetTicks);
  const count = Math.ceil(max / step - 1e-9);
  const ticks = Array.from({ length: count + 1 }, (_, i) => Math.round(i * step * 1e6) / 1e6);
  return { max: ticks[ticks.length - 1], ticks };
}

const monthYear = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Month ticks for the x axis, such as "Jan 2023", every 3, 6 or 12 months
 * (at the start of January, April, July and October for 3), using the
 * smallest step that fits in `maxTicks`.
 */
export function monthTicks(
  startMs: number,
  endMs: number,
  maxTicks: number,
): Array<{ ms: number; label: string }> {
  for (const step of [3, 6, 12, 24, 60]) {
    const ticks: Array<{ ms: number; label: string }> = [];
    const first = new Date(startMs);
    let year = first.getUTCFullYear();
    let month = Math.ceil(first.getUTCMonth() / step) * step;
    for (;;) {
      year += Math.floor(month / 12);
      month %= 12;
      const ms = Date.UTC(year, month, 1);
      if (ms > endMs) break;
      if (ms >= startMs) ticks.push({ ms, label: monthYear.format(ms) });
      month += step;
    }
    if (ticks.length <= Math.max(maxTicks, 1)) return ticks;
  }
  return [];
}

/**
 * An SVG path through `points`. A `null` y leaves a gap, so the line
 * restarts after it.
 */
export function linePath(points: ReadonlyArray<readonly [number, number | null]>): string {
  let path = "";
  let drawing = false;
  for (const [x, y] of points) {
    if (y === null) {
      drawing = false;
      continue;
    }
    path += `${drawing ? "L" : "M"}${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    drawing = true;
  }
  return path;
}

/** The index of the value in `sorted` (ascending) that is nearest to `x`. */
export function nearestIndex(sorted: readonly number[], x: number): number {
  let low = 0;
  let high = sorted.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sorted[mid] < x) low = mid + 1;
    else high = mid;
  }
  if (low > 0 && Math.abs(sorted[low - 1] - x) <= Math.abs(sorted[low] - x)) return low - 1;
  return low;
}

/** Keeps `value` between `min` and `max`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
