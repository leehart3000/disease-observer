"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { clamp, dayToMs, linePath, monthTicks, nearestIndex, yAxis } from "@/lib/chart-math";
import { getDataset } from "@/lib/datasets/registry";
import { formatNumber, formatPeriod, formatValue } from "@/lib/format";
import type { DiseaseSeries } from "@/lib/series-types";
import { ChartTable } from "./ChartTable";

/** Room around the plot for the axis labels. */
const MARGIN = { top: 10, right: 12, bottom: 26, left: 44 };
/** The size used for the first render, on the server and in the browser. */
const DEFAULT_SIZE = { w: 640, h: 320 };

/** The time ranges a chart offers: the last 12 months, or the whole series. */
export type ChartRange = "12m" | "all";

/** A line the visitor has highlighted, and the colour slot (1 to 3) it uses. */
export type Highlight = { code: string; slot: number };

/** The colour of a highlight slot. The three are checked together in both themes. */
export const slotColour = (slot: number) => `var(--chart-${slot})`;

/** The index of the first week of the last 12 months, counting back from the latest week. */
function firstIndexOfLastYear(ends: readonly string[]): number {
  const latest = new Date(`${ends[ends.length - 1]}T00:00:00Z`);
  latest.setUTCFullYear(latest.getUTCFullYear() - 1);
  const cutoff = latest.toISOString().slice(0, 10);
  const index = ends.findIndex((end) => end > cutoff);
  return index === -1 ? 0 : index;
}

/** The longest-day format used in the chart's description: "November 2026". */
function monthAndYear(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The drawing part of a line chart: the readout, the plot (a keyboard
 * slider that can also be pointed at) and the table of the same weeks. It
 * draws the whole place (England) in the text colour, the highlighted lines on top in their
 * own colours, and every other line thin and muted. It has no controls: the
 * range and the highlights are chosen by whatever wraps it.
 *
 * The lines and axes are in the server-rendered HTML. After it loads, the
 * chart measures its box and draws itself at that size.
 *
 * @param series - The whole place first, then the other areas.
 * @param highlights - The lines to draw on top (at most three, each with its own colour slot).
 * @param range - The weeks to show.
 */
export function LineChartPlot({
  series,
  diseaseName,
  highlights,
  range,
  scope,
}: {
  series: DiseaseSeries;
  diseaseName: string;
  highlights: readonly Highlight[];
  range: ChartRange;
  /** Which places the chart shows, for its accessible name, such as "England and UKHSA regions". */
  scope: string;
}) {
  const dataset = getDataset(series.datasetId);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [requestedActive, setRequestedActive] = useState(series.periods.length - 1);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      if (w > 0 && h > 0) setSize((old) => (old.w === w && old.h === h ? old : { w, h }));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const [whole, ...others] = series.lines;
  const last = series.periods.length - 1;
  // The first week on the chart. The y axis, the x axis and the table follow it.
  const from = useMemo(
    () => (range === "all" ? 0 : firstIndexOfLastYear(series.periods.map((period) => period.end))),
    [range, series],
  );
  const active = clamp(requestedActive, from, last);

  const geometry = useMemo(() => {
    const times = series.periods.slice(from).map((period) => dayToMs(period.end));
    const plotW = size.w - MARGIN.left - MARGIN.right;
    const plotH = size.h - MARGIN.top - MARGIN.bottom;
    const allValues = series.lines.flatMap((line) =>
      line.values.slice(from).filter((value) => value !== null),
    );
    const axis = yAxis(Math.max(0, ...allValues));
    const span = times[times.length - 1] - times[0] || 1;
    const x = (ms: number) => MARGIN.left + ((ms - times[0]) / span) * plotW;
    const y = (value: number) => MARGIN.top + plotH - (value / axis.max) * plotH;
    return {
      plotH,
      axis,
      x,
      y,
      xs: times.map(x),
      xTicks: monthTicks(times[0], times[times.length - 1], Math.floor(plotW / 80)),
    };
  }, [series, size, from]);

  if (!dataset || !whole) return null;

  const pathOf = (values: Array<number | null>) =>
    linePath(
      values
        .slice(from)
        .map((value, index) => [geometry.xs[index], value === null ? null : geometry.y(value)]),
    );

  const highlighted = highlights.flatMap(({ code, slot }) => {
    const line = others.find((entry) => entry.code === code);
    return line ? [{ line, slot }] : [];
  });
  const highlightedCodes = new Set(highlighted.map(({ line }) => line.code));

  /** The sentence for one week: its period, the whole place's value and the highlighted lines'. */
  function describe(index: number): string {
    const period = series.periods[index];
    const parts = [whole, ...highlighted.map(({ line }) => line)].map((line) => {
      const value = line.values[index];
      return `${line.name} ${value === null ? "no figure" : formatValue(dataset!, value)}`;
    });
    const provisional = period.provisional ? " (provisional)" : "";
    return `${formatPeriod(dataset!, period.start, period.end)}${provisional}: ${parts.join(", ")}`;
  }

  const latestValue = whole.values[last];
  const summary =
    `${diseaseName}, ${dataset.columnHeading.latest.toLowerCase()}, weekly, ${scope}, ` +
    `${monthAndYear(series.periods[from].end)} to ${monthAndYear(series.periods[last].end)}.` +
    (latestValue === null ? "" : ` Latest ${formatValue(dataset, latestValue)} for ${dataset.place.name}.`);

  function moveTo(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setRequestedActive(from + nearestIndex(geometry.xs, event.clientX - rect.left));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageDown: -4, PageUp: 4 };
    let next: number | undefined;
    if (event.key in steps) next = active + steps[event.key];
    else if (event.key === "Home") next = from;
    else if (event.key === "End") next = last;
    if (next === undefined) return;
    event.preventDefault();
    setRequestedActive(clamp(next, from, last));
  }

  const markerX = geometry.xs[active - from];
  const axisText = { fill: "var(--muted)", fontSize: 11 } as const;

  return (
    <>
      <p className="mt-3 min-h-12 text-sm" data-testid="chart-readout">
        {describe(active)}
      </p>

      <div
        ref={boxRef}
        role="slider"
        tabIndex={0}
        aria-label={`${summary} Use the left and right arrow keys to move between weeks.`}
        aria-valuemin={0}
        aria-valuemax={last - from}
        aria-valuenow={active - from}
        aria-valuetext={describe(active)}
        onKeyDown={onKeyDown}
        onPointerDown={moveTo}
        onPointerMove={moveTo}
        className="aspect-[4/3] w-full cursor-crosshair touch-pan-y rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:aspect-[2/1]"
      >
        <svg
          viewBox={`0 0 ${size.w} ${size.h}`}
          width={size.w}
          height={size.h}
          aria-hidden="true"
          focusable="false"
          className="block max-w-full"
        >
          {geometry.axis.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={size.w - MARGIN.right}
                y1={geometry.y(tick)}
                y2={geometry.y(tick)}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text x={MARGIN.left - 6} y={geometry.y(tick)} textAnchor="end" dominantBaseline="middle" style={axisText}>
                {formatNumber(tick, dataset.decimals)}
              </text>
            </g>
          ))}
          {geometry.xTicks.map((tick) => (
            <text
              key={tick.ms}
              x={geometry.x(tick.ms)}
              y={size.h - 6}
              textAnchor="middle"
              style={axisText}
            >
              {tick.label}
            </text>
          ))}

          {/* Drawn from the back to the front: muted lines, the whole place, then the highlighted lines. */}
          {others
            .filter((line) => !highlightedCodes.has(line.code))
            .map((line) => (
              <path
                key={line.code}
                d={pathOf(line.values)}
                fill="none"
                stroke="var(--muted)"
                strokeOpacity={0.5}
                strokeWidth={1}
                strokeLinejoin="round"
              />
            ))}
          <path
            d={pathOf(whole.values)}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {highlighted.map(({ line, slot }) => (
            <path
              key={line.code}
              d={pathOf(line.values)}
              fill="none"
              stroke={slotColour(slot)}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          <line
            x1={markerX}
            x2={markerX}
            y1={MARGIN.top}
            y2={MARGIN.top + geometry.plotH}
            stroke="var(--muted)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          {[
            { line: whole, colour: "var(--ink)" },
            ...highlighted.map(({ line, slot }) => ({ line, colour: slotColour(slot) })),
          ].map(({ line, colour }) => {
            const value = line.values[active];
            return value === null ? null : (
              <circle
                key={line.code}
                cx={markerX}
                cy={geometry.y(value)}
                r={4.5}
                fill={colour}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            );
          })}
        </svg>
      </div>

      <ChartTable series={series} from={from} />
    </>
  );
}
